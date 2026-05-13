const fs = require('fs');
const path = require('path');
const {
  replaceAnnouncementProductDetails
} = require('./announcementAttachmentParser');
const {
  parseFlightInspectionText,
  ensureFlightInspectionDetailTable,
  replaceFlightInspectionDetails
} = require('./flightInspectionAttachmentParser');
const {
  syncCompaniesFromAnnouncementDetails,
  syncCompaniesFromFlightInspectionDetails,
  deriveProvince,
  deleteOrphanCompanies,
  getSupervisionRelatedCompanyIds,
  removeAnnouncementCompanySampling
} = require('./companySamplingSync');
const { syncInspectionsFromAnnouncementDetails } = require('./announcementInspectionSync');
const { linkFoodInspectionToPublishedAnnouncement } = require('./foodInspectionStore');

const {

  replaceUnqualifiedProductsFromAnnouncementDetails,
  replaceUnqualifiedProductsFromFlightInspectionDetails,
  normalizeProductType,
  normalizeAnnouncementType,
  getProductTypeLabel,
  getAnnouncementTypeLabel
} = require('./unqualifiedProducts');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_STAGING_SOURCE_DIR = path.join(PROJECT_ROOT, 'data_get', 'output', 'items');

const STAGING_DETAIL_FIELDS = [
  'sequence_no',
  'product_name',
  'company_names',
  'company_addresses',
  'manufacturer_name',
  'manufacturer_address',
  'operator_name',
  'operator_address',
  'sample_unit_name',
  'sample_unit_address',
  'package_spec',
  'batch_no',
  'production_date',
  'expiry_date',
  'product_region',
  'registration_no',
  'production_license_no',
  'inspection_institution',
  'unqualified_items',
  'inspection_result',
  'requirement',
  'remarks',
  'is_counterfeit'
];

const SUPPORTED_PARSE_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx']);
const DEFAULT_WORKSPACE_CACHE_KEY = 'announcement-staging-workspace';
const TRACEBACK_TYPE_LABELS = {
  duplicate: '重复导入',
  parse_failed: '附件解析失败',
  import_failed: '导入异常',
  published_incorrect: '已导入有误',
  manual_reject: '核验打回'
};


function normalizeText(value) {

  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/\u0007/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeMultilineText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .replace(/\u0007/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeNullableText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeNullableMultilineText(value) {
  const normalized = normalizeMultilineText(value);
  return normalized || null;
}

function splitCompanyValues(value) {
  return String(value || '')
    .split(/\r?\n|；|;/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function normalizeInspectionCount(value, fallback = 0) {
  const count = Number.parseInt(value, 10);
  return Number.isNaN(count) ? fallback : count;
}

function extractAnnouncementInfo(content = '') {
  const info = {
    inspection_unit: null,
    inspection_count: 0
  };

  const unitMatch = String(content || '').match(/经(.+?)等?(单位|所|中心|院)检验/);
  if (unitMatch) {
    info.inspection_unit = normalizeNullableText(unitMatch[1]);
  }

  const countMatch = String(content || '').match(/(\d+)批次.*?(不符合规定|不合格|有问题)/);
  if (countMatch) {
    info.inspection_count = Number.parseInt(countMatch[1], 10) || 0;
  }

  return info;
}

function normalizeDateValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const exactDateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  if (exactDateMatch) {
    return exactDateMatch[1];
  }

  const chineseDateMatch = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseDateMatch) {
    const [, year, month, day] = chineseDateMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const slashDateMatch = normalized.match(/(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
  if (slashDateMatch) {
    const [, year, month, day] = slashDateMatch;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

function parseJsonSafely(value, fallbackValue = null) {
  if (!value) {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
}

function listJsonFilesFromDirectory(directoryPath = DEFAULT_STAGING_SOURCE_DIR) {
  const normalizedDirectoryPath = path.resolve(directoryPath);
  if (!fs.existsSync(normalizedDirectoryPath)) {
    return {
      source_dir: normalizedDirectoryPath,
      file_names: []
    };
  }

  const fileNames = fs.readdirSync(normalizedDirectoryPath)
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));

  return {
    source_dir: normalizedDirectoryPath,
    file_names: fileNames
  };
}

function calculateProgressPercent(completedCount, totalCount) {
  const total = Number(totalCount || 0);
  const completed = Number(completedCount || 0);
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(((completed / total) * 100).toFixed(1))));
}

function removeImportedJsonFile(filePath) {
  const absoluteFilePath = path.resolve(filePath);
  if (!fs.existsSync(absoluteFilePath)) {
    return {
      deleted: true,
      message: null
    };
  }

  try {
    fs.unlinkSync(absoluteFilePath);
    return {
      deleted: true,
      message: null
    };
  } catch (error) {
    return {
      deleted: false,
      message: error.message || '删除 JSON 文件失败'
    };
  }
}

function buildImportFailedTracebackPayload(filePath, reason, fileName = path.basename(filePath)) {
  const absoluteFilePath = path.resolve(filePath);
  const defaultTitle = path.basename(fileName, path.extname(fileName)) || fileName || '导入异常记录';

  let rawText = '';
  let payload = null;

  try {
    rawText = fs.readFileSync(absoluteFilePath, 'utf-8');
    payload = parseJsonSafely(rawText, null);
  } catch (error) {
    rawText = '';
    payload = null;
  }

  const normalizedPayload = /** @type {Record<string, any>} */ (payload && typeof payload === 'object' ? payload : {});

  const productType = inferProductTypeFromPayload(normalizedPayload);
  const announcementType = inferAnnouncementTypeFromPayload(normalizedPayload);
  const attachments = Array.isArray(normalizedPayload.attachments) ? normalizedPayload.attachments : [];
  const contentText = normalizeNullableMultilineText(
    normalizedPayload.content_text || normalizedPayload.content || normalizedPayload.content_preview
  );

  return {
    source_json_file: absoluteFilePath,
    source_detail_url: normalizeNullableText(normalizedPayload.source_detail_url || normalizedPayload.detail_url),
    source_page: normalizeNullableText(normalizedPayload.source_page),
    title: normalizeNullableText(normalizedPayload.title) || defaultTitle,
    announcement_no: normalizeNullableText(normalizedPayload.announcement_no),
    product_type: productType,
    announcement_type: announcementType,
    attachment_count: attachments.length,
    parsed_detail_count: 0,
    counterfeit_count: 0,
    content: contentText,
    raw_payload: rawText || JSON.stringify({ file_name: fileName, reason: normalizeText(reason) || '导入异常' }),
    attachment_preview: [],
    attachment_validation: {
      blocking: true,
      message: normalizeText(reason) || '导入异常',
      detail_count: 0,
      attachment_count: attachments.length,
      parseable_attachment_count: 0,
      success_attachment_count: 0,
      failed_attachment_count: attachments.length,
      failed_attachment_names: attachments
        .map((attachment) => normalizeNullableText(attachment?.attachment_name || attachment?.name))
        .filter(Boolean)
        .slice(0, 10)
    }
  };
}

function buildUploadSourceIdentifier(relativePath, fileName) {
  const sourceText = normalizeNullableText(relativePath) || normalizeNullableText(fileName) || 'unknown.json';
  return `upload:${sourceText.replace(/\\/g, '/')}`;
}

function buildAuditPayload(importOptions = {}) {
  const auditContext = importOptions.auditContext || {};
  return {
    imported_by_user_id: auditContext.user_id || null,
    imported_by_username: normalizeNullableText(auditContext.username),
    imported_at: auditContext.imported_at || null,
    import_source: normalizeNullableText(auditContext.import_source) || 'server_directory',
    source_file_name: normalizeNullableText(importOptions.sourceFileName),
    source_relative_path: normalizeNullableText(importOptions.sourceRelativePath)
  };
}

function resolveTypeInfo(productType, announcementType) {


  const normalizedProductType = normalizeProductType(productType);
  const normalizedAnnouncementType = normalizeAnnouncementType(announcementType);

  return {
    product_type: normalizedProductType,
    announcement_type: normalizedAnnouncementType,
    product_type_label: getProductTypeLabel(normalizedProductType),
    announcement_type_label: getAnnouncementTypeLabel(normalizedAnnouncementType),
    target_table: normalizedAnnouncementType === 'flight_inspection' ? 'supervisions' : 'announcements'
  };
}

function readRecordedProductType(payload = {}) {
  return normalizeNullableText(
    payload.product_type
    || payload?._import_meta?.product_type
    || payload?.crawl_record?.product_type
    || payload?.source_record?.product_type
    || payload?.source_meta?.product_type
  );
}

function inferProductTypeFromPayload(payload = {}) {
  const explicitProductType = readRecordedProductType(payload);
  if (explicitProductType) {
    return normalizeProductType(explicitProductType);
  }

  const text = normalizeText([
    payload.title,
    payload.announcement_no,
    payload.content_text,
    payload.content,
    payload.source_page,
    payload.detail_url,
    payload.source_detail_url
  ].filter(Boolean).join(' '));


  if (/医疗器械|器械监督|器械抽检/.test(text)) {
    return 'medical_device';
  }

  if (/食品|食用|餐饮|保健食品/.test(text)) {
    return 'food';
  }

  return 'cosmetics';
}

function inferAnnouncementTypeFromPayload(payload = {}) {
  const explicitAnnouncementType = normalizeNullableText(payload.announcement_type || payload?._import_meta?.announcement_type);
  if (explicitAnnouncementType) {
    return normalizeAnnouncementType(explicitAnnouncementType);
  }

  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const hasFlightInspectionRows = attachments.some((attachment) => {
    const rows = Array.isArray(attachment?.parse_result?.rows) ? attachment.parse_result.rows : [];
    return rows.some((row) => normalizeText(row.company_name || row.title || row.defects_and_problems));
  });

  if (hasFlightInspectionRows) {
    return 'flight_inspection';
  }

  const text = normalizeText([
    payload.title,
    payload.announcement_no,
    payload.content_text,
    payload.content
  ].filter(Boolean).join(' '));

  if (/飞行检查|飞检|监督检查/.test(text)) {
    return 'flight_inspection';
  }

  return 'sampling';
}

function resolvePayloadTypeInfo(payload = {}, importOptions = {}) {
  return resolveTypeInfo(
    importOptions.product_type || payload.product_type || payload?._import_meta?.product_type || inferProductTypeFromPayload(payload),
    importOptions.announcement_type || payload.announcement_type || payload?._import_meta?.announcement_type || inferAnnouncementTypeFromPayload(payload)
  );
}

function mergeImportMetaIntoPayload(payload = {}, importOptions = {}) {
  const typeInfo = resolvePayloadTypeInfo(payload, importOptions);

  return {
    ...payload,
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    _import_meta: {
      ...(payload._import_meta || {}),
      product_type: typeInfo.product_type,
      announcement_type: typeInfo.announcement_type,
      product_type_label: typeInfo.product_type_label,
      announcement_type_label: typeInfo.announcement_type_label
    }
  };
}

function getBatchTypeInfo(batch = {}, rawPayload = {}) {
  return resolveTypeInfo(
    batch.product_type || rawPayload.product_type || rawPayload?._import_meta?.product_type || inferProductTypeFromPayload(rawPayload),
    batch.announcement_type || rawPayload.announcement_type || rawPayload?._import_meta?.announcement_type || inferAnnouncementTypeFromPayload(rawPayload)
  );
}


function normalizeDetailRow(row = {}, index = 0) {
  const sequenceNo = Number.parseInt(row.sequence_no, 10);
  const remarks = normalizeNullableText(row.remarks) || '/';
  const isCounterfeit = row.is_counterfeit === 1 || row.is_counterfeit === '1' || row.is_counterfeit === true
    ? 1
    : (/假冒|真实性异议|未生产或者进口过该批次抽检不符合规定产品/.test(remarks) ? 1 : 0);

  return {
    sequence_no: Number.isNaN(sequenceNo) ? index + 1 : sequenceNo,
    product_name: normalizeNullableText(row.product_name),
    company_names: normalizeNullableMultilineText(row.company_names),
    company_addresses: normalizeNullableMultilineText(row.company_addresses),
    manufacturer_name: normalizeNullableText(row.manufacturer_name),
    manufacturer_address: normalizeNullableMultilineText(row.manufacturer_address),
    operator_name: normalizeNullableText(row.operator_name || row.sample_unit_name),
    operator_address: normalizeNullableMultilineText(row.operator_address || row.sample_unit_address),
    sample_unit_name: normalizeNullableText(row.sample_unit_name),
    sample_unit_address: normalizeNullableMultilineText(row.sample_unit_address),
    package_spec: normalizeNullableText(row.package_spec),
    batch_no: normalizeNullableText(row.batch_no),
    production_date: normalizeNullableText(row.production_date),
    expiry_date: normalizeNullableText(row.expiry_date),
    product_region: normalizeNullableText(row.product_region),
    registration_no: normalizeNullableText(row.registration_no),
    production_license_no: normalizeNullableText(row.production_license_no),
    inspection_institution: normalizeNullableText(row.inspection_institution),
    unqualified_items: normalizeNullableMultilineText(row.unqualified_items),
    inspection_result: normalizeNullableMultilineText(row.inspection_result),
    requirement: normalizeNullableMultilineText(row.requirement),
    remarks: normalizeNullableMultilineText(remarks) || '/',
    is_counterfeit: isCounterfeit
  };
}

function normalizeFlightInspectionRow(row = {}, index = 0, attachment = {}, attachmentIndex = 0) {
  const sequenceNo = Number.parseInt(row.sequence_no, 10);

  return {
    sequence_no: Number.isNaN(sequenceNo) ? index + 1 : sequenceNo,
    title: normalizeNullableText(row.title) || normalizeNullableText(row.product_name) || normalizeNullableText(row.company_name) || `企业明细${index + 1}`,
    company_name: normalizeNullableText(row.company_name) || splitCompanyValues(row.company_names)[0] || null,
    production_license_no: normalizeNullableText(row.production_license_no || row.license_code),
    social_credit_code: normalizeNullableText(row.social_credit_code || row.credit_code),
    company_address: normalizeNullableMultilineText(row.company_address || row.company_addresses),
    inspection_unit: normalizeNullableText(row.inspection_unit || row.inspect_org || row.inspection_institution),
    inspection_basis: normalizeNullableMultilineText(row.inspection_basis || row.inspect_basis || row.requirement),
    defects_and_problems: normalizeNullableMultilineText(row.defects_and_problems || row.defect_problem || row.unqualified_items || row.inspection_result),
    handling_measures: normalizeNullableMultilineText(row.handling_measures || row.measure || row.remarks),
    publish_date: normalizeDateValue(row.publish_date || row.publish_date_text),
    publish_date_text: normalizeNullableText(row.publish_date_text || row.publish_date),
    raw_text: normalizeNullableMultilineText(row.raw_text || row.content),
    attachment_name: normalizeNullableText(row.attachment_name || attachment.attachment_name) || `附件${attachmentIndex + 1}`,
    attachment_path: normalizeNullableText(row.attachment_path || attachment.local_path || attachment.attachment_url)
  };
}

function collectParsedRows(payload = {}) {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const rows = [];

  attachments.forEach((attachment) => {
    const parsedRows = Array.isArray(attachment?.parse_result?.rows) ? attachment.parse_result.rows : [];
    parsedRows.forEach((row, index) => {
      const normalizedRow = normalizeDetailRow(row, index);
      if (normalizedRow.product_name) {
        rows.push(normalizedRow);
      }
    });
  });

  return rows;
}

function collectFlightInspectionRows(payload = {}) {
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const rows = [];

  attachments.forEach((attachment, attachmentIndex) => {
    const parsedRows = Array.isArray(attachment?.parse_result?.rows) ? attachment.parse_result.rows : [];
    parsedRows.forEach((row, index) => {
      const normalizedRow = normalizeFlightInspectionRow(row, index, attachment, attachmentIndex);
      if (normalizedRow.company_name || normalizedRow.title || normalizedRow.defects_and_problems) {
        rows.push(normalizedRow);
      }
    });
  });

  if (rows.length === 0) {
    const fallback = parseFlightInspectionText(payload.content_text || payload.content || '');
    if (fallback) {
      rows.push(normalizeFlightInspectionRow(fallback, 0, { attachment_name: '正文解析' }, 0));
    }
  }

  return rows.map((row, index) => ({
    ...row,
    sequence_no: index + 1
  }));
}

function collectBatchRows(payload = {}, announcementType = 'sampling') {
  return announcementType === 'flight_inspection'
    ? collectFlightInspectionRows(payload)
    : collectParsedRows(payload);
}

function buildAttachmentPreview(rawPayload = {}, typeInfo = resolveTypeInfo()) {
  const attachments = Array.isArray(rawPayload?.attachments) ? rawPayload.attachments : [];

  if (typeInfo.announcement_type === 'flight_inspection') {
    const flightAttachments = attachments.map((attachment, attachmentIndex) => {
      const rawRows = Array.isArray(attachment?.parse_result?.rows) ? attachment.parse_result.rows : [];
    const rows = rawRows
        .map((row, rowIndex) => ({
          ...normalizeFlightInspectionRow(row, rowIndex, attachment, attachmentIndex),
          __attachment_index: attachmentIndex + 1,
          __row_index: rowIndex
        }))
        .filter((row) => row.company_name || row.title || row.defects_and_problems);

      return {
        index: attachmentIndex + 1,
        attachment_name: normalizeNullableText(attachment?.attachment_name) || `附件${attachmentIndex + 1}`,
        attachment_url: normalizeNullableText(attachment?.attachment_url),
        local_path: normalizeNullableText(attachment?.local_path),
        file_ext: normalizeNullableText(attachment?.file_ext),
        supported: Boolean(attachment?.parse_result?.supported),
        attachment_type: normalizeNullableText(attachment?.parse_result?.attachment_type),
        parsed_count: rows.length,
        counterfeit_count: 0,
        parse_message: normalizeNullableText(attachment?.parse_result?.message),
        rows
      };
    });

    if (flightAttachments.length === 0) {
      const fallbackRows = collectFlightInspectionRows(rawPayload);
      if (fallbackRows.length > 0) {
        return [{
          index: 1,
          attachment_name: '正文解析',
          attachment_url: null,
          local_path: null,
          file_ext: null,
          supported: true,
          attachment_type: 'content',
          parsed_count: fallbackRows.length,
          counterfeit_count: 0,
          parse_message: null,
          rows: fallbackRows
        }];
      }
    }

    return flightAttachments;
  }

  return attachments.map((attachment, attachmentIndex) => {
    const rawRows = Array.isArray(attachment?.parse_result?.rows) ? attachment.parse_result.rows : [];
    const rows = rawRows
      .map((row, rowIndex) => ({
        ...normalizeDetailRow(row, rowIndex),
        __attachment_index: attachmentIndex + 1,
        __row_index: rowIndex
      }))
      .filter((row) => row.product_name);

    return {
      index: attachmentIndex + 1,
      attachment_name: normalizeNullableText(attachment?.attachment_name) || `附件${attachmentIndex + 1}`,
      attachment_url: normalizeNullableText(attachment?.attachment_url),
      local_path: normalizeNullableText(attachment?.local_path),
      file_ext: normalizeNullableText(attachment?.file_ext),
      supported: Boolean(attachment?.parse_result?.supported),
      attachment_type: normalizeNullableText(attachment?.parse_result?.attachment_type),
      parsed_count: rows.length,
      counterfeit_count: rows.filter((row) => row.is_counterfeit).length,
      parse_message: normalizeNullableText(attachment?.parse_result?.message),
      rows
    };
  });
}

function buildAttachmentValidation(rawPayload = {}, items = [], attachmentPreview = []) {

  const attachments = Array.isArray(rawPayload.attachments) ? rawPayload.attachments : [];
  const parseableAttachmentCount = attachments.filter((attachment) => {
    const fileExt = String(attachment?.file_ext || '').toLowerCase();
    return SUPPORTED_PARSE_EXTENSIONS.has(fileExt);
  }).length;
  const successfulAttachments = attachmentPreview.filter((attachment) => Number(attachment.parsed_count || 0) > 0);
  const failedAttachments = attachmentPreview.filter((attachment) => Number(attachment.parsed_count || 0) <= 0);
  const failedAttachmentNames = failedAttachments
    .map((attachment) => attachment.attachment_name)
    .filter(Boolean)
    .slice(0, 10);
  const detailCount = Number(items.length || 0);
  const blockingByAttachment = attachments.length > 0 && successfulAttachments.length <= 0;
  const blockingByDetail = detailCount <= 0;
  const blocking = blockingByAttachment || blockingByDetail;

  let message = null;
  if (blockingByAttachment) {
    message = failedAttachmentNames.length > 0
      ? `附件未解析成功（${failedAttachmentNames.join('、')}），已保留到导入检查模块，需人工核验正文与附件`
      : '附件未解析成功，已保留到导入检查模块，需人工核验正文与附件';
  } else if (blockingByDetail) {
    message = attachments.length > 0
      ? '附件暂未解析出有效产品/问题项，已保留到导入检查模块，需人工决定是否导入正式库'
      : '当前通告暂无可用附件解析结果，已保留到导入检查模块，需人工决定是否导入正式库';
  }

  return {
    blocking,
    message,
    detail_count: detailCount,
    attachment_count: attachments.length,
    parseable_attachment_count: parseableAttachmentCount,
    success_attachment_count: successfulAttachments.length,
    failed_attachment_count: failedAttachments.length,
    failed_attachment_names: failedAttachmentNames
  };
}


function buildCompanyPreview(items = [], typeInfo = resolveTypeInfo()) {
  if (typeInfo.announcement_type === 'flight_inspection') {

    const companyMap = new Map();

    items.forEach((item) => {
      const companyName = normalizeText(item.company_name);
      if (!companyName) {
        return;
      }

      const companyAddress = normalizeNullableText(item.company_address);
      const key = `${companyName}__${companyAddress || ''}`;
      const province = deriveProvince(null, companyAddress);

      if (!companyMap.has(key)) {
        companyMap.set(key, {
          company_name: companyName,
          company_address: companyAddress,
          province: province || null,
          product_names: new Set(),
          product_count: 0,
          counterfeit_count: 0
        });
      }

      const company = companyMap.get(key);
      if (item.title) {
        company.product_names.add(item.title);
      }
      company.product_count = company.product_names.size;
    });

    return Array.from(companyMap.values())
      .map((company) => ({
        company_name: company.company_name,
        company_address: company.company_address,
        province: company.province,
        product_count: company.product_count,
        counterfeit_count: company.counterfeit_count,
        product_names: Array.from(company.product_names).slice(0, 8).join('、')
      }))
      .sort((left, right) => right.product_count - left.product_count || left.company_name.localeCompare(right.company_name, 'zh-CN'));
  }

  const companyMap = new Map();

  items.forEach((item) => {
    const companyNames = splitCompanyValues(item.company_names);
    const companyAddresses = splitCompanyValues(item.company_addresses);
    const defaultAddress = companyAddresses[0] || normalizeNullableText(item.company_addresses);

    companyNames.forEach((companyName, index) => {
      const companyAddress = companyAddresses[index] || defaultAddress || null;
      const key = `${companyName}__${companyAddress || ''}`;
      const province = deriveProvince(item.product_region, companyAddress);

      if (!companyMap.has(key)) {
        companyMap.set(key, {
          company_name: companyName,
          company_address: companyAddress,
          province: province || null,
          product_names: new Set(),
          product_count: 0,
          counterfeit_count: 0
        });
      }

      const company = companyMap.get(key);
      if (item.product_name) {
        company.product_names.add(item.product_name);
      }
      company.product_count = company.product_names.size;
      if (item.is_counterfeit) {
        company.counterfeit_count += 1;
      }
    });
  });

  return Array.from(companyMap.values())
    .map((company) => ({
      company_name: company.company_name,
      company_address: company.company_address,
      province: company.province,
      product_count: company.product_count,
      counterfeit_count: company.counterfeit_count,
      product_names: Array.from(company.product_names).slice(0, 8).join('、')
    }))
    .sort((left, right) => right.product_count - left.product_count || left.company_name.localeCompare(right.company_name, 'zh-CN'));
}

async function ensureColumnExists(connection, tableName, columnName, definition) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureIndexExists(connection, tableName, indexName, createSql) {
  const [rows] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    await connection.query(createSql);
  }
}

async function ensureForeignKey(connection, tableName, constraintName, definitionSql) {
  const [rows] = await connection.query(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      LIMIT 1
    `,
    [tableName, constraintName]
  );

  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definitionSql}`);
  }
}

async function dropForeignKeyIfDeleteRuleMismatch(connection, tableName, constraintName, expectedDeleteRule) {
  const [rows] = await connection.query(
    `
      SELECT DELETE_RULE
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
      LIMIT 1
    `,
    [tableName, constraintName]
  );

  const deleteRule = rows[0]?.DELETE_RULE ? String(rows[0].DELETE_RULE).toUpperCase() : '';
  if (deleteRule && deleteRule !== String(expectedDeleteRule || '').toUpperCase()) {
    await connection.query(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${constraintName}`);
  }
}

async function ensureAnnouncementTablePublishColumns(connection) {
  await ensureColumnExists(connection, 'announcements', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER attachment_name");
  await ensureColumnExists(connection, 'announcements', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'sampling' AFTER product_type");
  await ensureColumnExists(connection, 'announcements', 'source_detail_url', 'VARCHAR(500) NULL AFTER announcement_type');
  await ensureColumnExists(connection, 'announcements', 'source_page', 'VARCHAR(500) NULL AFTER source_detail_url');
  await ensureColumnExists(connection, 'announcements', 'source_json_file', 'VARCHAR(500) NULL AFTER source_page');
  await ensureIndexExists(connection, 'announcements', 'idx_announcements_product_type', 'ALTER TABLE announcements ADD INDEX idx_announcements_product_type (product_type)');
  await ensureIndexExists(connection, 'announcements', 'idx_announcements_announcement_type', 'ALTER TABLE announcements ADD INDEX idx_announcements_announcement_type (announcement_type)');
  await ensureIndexExists(connection, 'announcements', 'idx_announcements_source_detail_url', 'ALTER TABLE announcements ADD INDEX idx_announcements_source_detail_url (source_detail_url(191))');
}


async function ensureSupervisionAttachmentsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS supervision_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supervision_id INT NOT NULL,
      attachment_name VARCHAR(255) NOT NULL,
      attachment_path VARCHAR(500) NOT NULL,
      attachment_type VARCHAR(50),
      sort_order INT DEFAULT 0,
      parse_supported TINYINT(1) DEFAULT 0,
      parse_message VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supervision_attachments_supervision (supervision_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureSupervisionTablePublishColumns(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS supervisions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      company_name VARCHAR(255),
      production_license_no VARCHAR(255),
      company_address TEXT,
      supervision_date DATE,
      publish_date DATE,
      supervision_unit VARCHAR(100),
      inspection_basis LONGTEXT,
      defects_and_problems LONGTEXT,
      handling_measures LONGTEXT,
      attachment_path VARCHAR(500),
      attachment_name VARCHAR(200),
      region VARCHAR(100),
      level ENUM('national', 'provincial', 'municipal') NOT NULL DEFAULT 'national',
      supervision_type VARCHAR(50),
      content LONGTEXT,
      rectification_deadline DATE,
      status ENUM('ongoing', 'completed', 'pending_rectification') DEFAULT 'ongoing',
      source VARCHAR(100),
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_supervisions_company_name (company_name),
      INDEX idx_supervisions_publish_date (publish_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(connection, 'supervisions', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER supervision_type");
  await ensureColumnExists(connection, 'supervisions', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'flight_inspection' AFTER product_type");
  await ensureColumnExists(connection, 'supervisions', 'source_detail_url', 'VARCHAR(500) NULL AFTER announcement_type');
  await ensureColumnExists(connection, 'supervisions', 'source_page', 'VARCHAR(500) NULL AFTER source_detail_url');
  await ensureColumnExists(connection, 'supervisions', 'source_json_file', 'VARCHAR(500) NULL AFTER source_page');
  await ensureIndexExists(connection, 'supervisions', 'idx_supervisions_product_type', 'ALTER TABLE supervisions ADD INDEX idx_supervisions_product_type (product_type)');
  await ensureIndexExists(connection, 'supervisions', 'idx_supervisions_announcement_type', 'ALTER TABLE supervisions ADD INDEX idx_supervisions_announcement_type (announcement_type)');
  await ensureIndexExists(connection, 'supervisions', 'idx_supervisions_source_detail_url', 'ALTER TABLE supervisions ADD INDEX idx_supervisions_source_detail_url (source_detail_url(191))');
  await ensureFlightInspectionDetailTable(connection);
  await ensureSupervisionAttachmentsTable(connection);
}


async function ensureAnnouncementPublishBackupColumns(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_publish_backups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staging_batch_id INT NOT NULL,
      announcement_id INT NULL,
      supervision_id INT NULL,
      title VARCHAR(255) NOT NULL,
      announcement_no VARCHAR(100) NULL,
      publish_date DATE NULL,
      inspection_unit VARCHAR(500) NULL,
      inspection_count INT DEFAULT 0,
      detail_count INT DEFAULT 0,
      primary_attachment_name VARCHAR(255) NULL,
      primary_attachment_path VARCHAR(1000) NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
      source_detail_url VARCHAR(500) NULL,
      source_page VARCHAR(500) NULL,
      source_json_file VARCHAR(500) NULL,
      payload_json LONGTEXT NOT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_publish_backup_stage (staging_batch_id),
      INDEX idx_publish_backup_announcement (announcement_id),
      INDEX idx_publish_backup_supervision (supervision_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [announcementIdColumns] = await connection.query("SHOW COLUMNS FROM announcement_publish_backups LIKE 'announcement_id'");
  if (announcementIdColumns[0]?.Null === 'NO') {
    await connection.query('ALTER TABLE announcement_publish_backups MODIFY COLUMN announcement_id INT NULL');
  }

  await ensureColumnExists(connection, 'announcement_publish_backups', 'supervision_id', 'INT NULL AFTER announcement_id');
  await ensureColumnExists(connection, 'announcement_publish_backups', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER primary_attachment_path");
  await ensureColumnExists(connection, 'announcement_publish_backups', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'sampling' AFTER product_type");
  await ensureColumnExists(connection, 'announcement_publish_backups', 'source_detail_url', 'VARCHAR(500) NULL AFTER announcement_type');
  await ensureColumnExists(connection, 'announcement_publish_backups', 'source_page', 'VARCHAR(500) NULL AFTER source_detail_url');
  await ensureColumnExists(connection, 'announcement_publish_backups', 'source_json_file', 'VARCHAR(500) NULL AFTER source_page');
  await ensureIndexExists(connection, 'announcement_publish_backups', 'idx_publish_backup_supervision', 'ALTER TABLE announcement_publish_backups ADD INDEX idx_publish_backup_supervision (supervision_id)');


  await dropForeignKeyIfDeleteRuleMismatch(
    connection,
    'announcement_publish_backups',
    'fk_publish_backup_stage',
    'SET NULL'
  );
  const [stagingBatchIdColumns] = await connection.query("SHOW COLUMNS FROM announcement_publish_backups LIKE 'staging_batch_id'");
  if (stagingBatchIdColumns[0]?.Null === 'NO') {
    await connection.query('ALTER TABLE announcement_publish_backups MODIFY COLUMN staging_batch_id INT NULL');
  }
  await ensureForeignKey(
    connection,
    'announcement_publish_backups',
    'fk_publish_backup_stage',
    'FOREIGN KEY (staging_batch_id) REFERENCES announcement_staging_batches(id) ON DELETE SET NULL'
  );
  await ensureForeignKey(
    connection,
    'announcement_publish_backups',
    'fk_publish_backup_announcement',
    'FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE'
  );
}

async function ensureAnnouncementTracebackTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_staging_tracebacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trace_type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      announcement_no VARCHAR(100) NULL,
      source_json_file VARCHAR(500) NOT NULL,
      source_detail_url VARCHAR(500) NULL,
      source_page VARCHAR(500) NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
      reason VARCHAR(500) NOT NULL,
      attachment_summary_json LONGTEXT NULL,
      raw_payload LONGTEXT NULL,
      existing_batch_id INT NULL,
      existing_announcement_id INT NULL,
      existing_supervision_id INT NULL,
      imported_by_user_id INT NULL,
      imported_by_username VARCHAR(50) NULL,
      imported_at DATETIME NULL,
      import_source VARCHAR(50) NOT NULL DEFAULT 'server_directory',
      source_file_name VARCHAR(255) NULL,
      source_relative_path VARCHAR(500) NULL,
      handled_status ENUM('pending', 'resolved') DEFAULT 'pending',
      handled_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tracebacks_status_type (handled_status, trace_type),
      INDEX idx_tracebacks_existing_batch (existing_batch_id),
      INDEX idx_tracebacks_source_json_file (source_json_file(191)),
      INDEX idx_tracebacks_source_detail_url (source_detail_url(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'imported_by_user_id', 'INT NULL AFTER existing_supervision_id');
  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'imported_by_username', 'VARCHAR(50) NULL AFTER imported_by_user_id');
  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'imported_at', 'DATETIME NULL AFTER imported_by_username');
  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'import_source', "VARCHAR(50) NOT NULL DEFAULT 'server_directory' AFTER imported_at");
  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'source_file_name', 'VARCHAR(255) NULL AFTER import_source');
  await ensureColumnExists(connection, 'announcement_staging_tracebacks', 'source_relative_path', 'VARCHAR(500) NULL AFTER source_file_name');
}

async function ensureAnnouncementWorkspaceCacheTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_staging_workspace_cache (
      cache_key VARCHAR(100) PRIMARY KEY,
      payload_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureAnnouncementStagingSchema(connection) {

  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_staging_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_sequence INT NULL,
      source_json_file VARCHAR(500) NOT NULL,
      source_detail_url VARCHAR(500) NULL,
      source_page VARCHAR(500) NULL,
      title VARCHAR(255) NOT NULL,
      announcement_no VARCHAR(100) NULL,
      publish_date DATE NULL,
      content LONGTEXT NULL,
      inspection_unit VARCHAR(500) NULL,
      inspection_count INT DEFAULT 0,
      attachment_count INT DEFAULT 0,
      parsed_detail_count INT DEFAULT 0,
      counterfeit_count INT DEFAULT 0,
      primary_attachment_name VARCHAR(255) NULL,
      primary_attachment_path VARCHAR(1000) NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
      raw_payload LONGTEXT NULL,
      status ENUM('pending', 'confirmed') DEFAULT 'pending',
      published_announcement_id INT NULL,
      published_supervision_id INT NULL,
      imported_by_user_id INT NULL,
      imported_by_username VARCHAR(50) NULL,
      imported_at DATETIME NULL,
      import_source VARCHAR(50) NOT NULL DEFAULT 'server_directory',
      source_file_name VARCHAR(255) NULL,
      source_relative_path VARCHAR(500) NULL,
      confirmed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_staging_source_json_file (source_json_file),
      INDEX idx_staging_status_publish_date (status, publish_date),
      INDEX idx_staging_announcement_no (announcement_no),
      INDEX idx_staging_published_announcement (published_announcement_id),
      INDEX idx_staging_published_supervision (published_supervision_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(connection, 'announcement_staging_batches', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER primary_attachment_path");
  await ensureColumnExists(connection, 'announcement_staging_batches', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'sampling' AFTER product_type");
  await ensureColumnExists(connection, 'announcement_staging_batches', 'published_supervision_id', 'INT NULL AFTER published_announcement_id');
  await ensureColumnExists(connection, 'announcement_staging_batches', 'imported_by_user_id', 'INT NULL AFTER published_supervision_id');
  await ensureColumnExists(connection, 'announcement_staging_batches', 'imported_by_username', 'VARCHAR(50) NULL AFTER imported_by_user_id');
  await ensureColumnExists(connection, 'announcement_staging_batches', 'imported_at', 'DATETIME NULL AFTER imported_by_username');
  await ensureColumnExists(connection, 'announcement_staging_batches', 'import_source', "VARCHAR(50) NOT NULL DEFAULT 'server_directory' AFTER imported_at");
  await ensureColumnExists(connection, 'announcement_staging_batches', 'source_file_name', 'VARCHAR(255) NULL AFTER import_source');
  await ensureColumnExists(connection, 'announcement_staging_batches', 'source_relative_path', 'VARCHAR(500) NULL AFTER source_file_name');
  await ensureIndexExists(connection, 'announcement_staging_batches', 'idx_staging_product_type', 'ALTER TABLE announcement_staging_batches ADD INDEX idx_staging_product_type (product_type)');
  await ensureIndexExists(connection, 'announcement_staging_batches', 'idx_staging_announcement_type', 'ALTER TABLE announcement_staging_batches ADD INDEX idx_staging_announcement_type (announcement_type)');
  await ensureIndexExists(connection, 'announcement_staging_batches', 'idx_staging_published_supervision', 'ALTER TABLE announcement_staging_batches ADD INDEX idx_staging_published_supervision (published_supervision_id)');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS announcement_staging_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staging_batch_id INT NOT NULL,
      sequence_no INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      company_names TEXT NULL,
      company_addresses TEXT NULL,
      manufacturer_name VARCHAR(500) NULL,
      manufacturer_address TEXT NULL,
      operator_name VARCHAR(500) NULL,
      operator_address TEXT NULL,
      sample_unit_name VARCHAR(500) NULL,
      sample_unit_address TEXT NULL,
      package_spec VARCHAR(255) NULL,
      batch_no VARCHAR(255) NULL,
      production_date VARCHAR(100) NULL,
      expiry_date VARCHAR(255) NULL,
      product_region VARCHAR(255) NULL,
      registration_no VARCHAR(255) NULL,
      production_license_no VARCHAR(255) NULL,
      inspection_institution VARCHAR(255) NULL,
      unqualified_items LONGTEXT NULL,
      inspection_result LONGTEXT NULL,
      requirement LONGTEXT NULL,
      remarks LONGTEXT NULL,
      is_counterfeit TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_staging_item_batch_sequence (staging_batch_id, sequence_no),
      INDEX idx_staging_item_product (product_name),
      INDEX idx_staging_item_counterfeit (is_counterfeit),
      CONSTRAINT fk_staging_item_batch
        FOREIGN KEY (staging_batch_id) REFERENCES announcement_staging_batches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(connection, 'announcement_staging_items', 'manufacturer_name', 'VARCHAR(500) NULL AFTER company_addresses');
  await ensureColumnExists(connection, 'announcement_staging_items', 'manufacturer_address', 'TEXT NULL AFTER manufacturer_name');
  await ensureColumnExists(connection, 'announcement_staging_items', 'operator_name', 'VARCHAR(500) NULL AFTER manufacturer_address');
  await ensureColumnExists(connection, 'announcement_staging_items', 'operator_address', 'TEXT NULL AFTER operator_name');

  await ensureAnnouncementTablePublishColumns(connection);
  await ensureSupervisionTablePublishColumns(connection);
  await ensureAnnouncementPublishBackupColumns(connection);
  await ensureAnnouncementTracebackTables(connection);
  await ensureAnnouncementWorkspaceCacheTable(connection);
}


async function replaceStagingItems(connection, stagingBatchId, items = [], announcementType = 'sampling') {
  await connection.query('DELETE FROM announcement_staging_items WHERE staging_batch_id = ?', [stagingBatchId]);

  if (!items.length || announcementType !== 'sampling') {
    return;
  }

  const sql = `
    INSERT INTO announcement_staging_items (
      staging_batch_id,
      ${STAGING_DETAIL_FIELDS.join(', ')}
    ) VALUES (?, ${STAGING_DETAIL_FIELDS.map(() => '?').join(', ')})
  `;

  for (const item of items) {
    const values = [stagingBatchId, ...STAGING_DETAIL_FIELDS.map((field) => item[field] ?? null)];
    await connection.query(sql, values);
  }
}

async function findExistingStagingBatch(connection, batchPayload = {}) {
  const conditions = [];
  const params = [];

  if (batchPayload.source_detail_url) {
    conditions.push('source_detail_url = ?');
    params.push(batchPayload.source_detail_url);
  }

  if (batchPayload.source_json_file) {
    conditions.push('source_json_file = ?');
    params.push(batchPayload.source_json_file);
  }

  if (batchPayload.announcement_no) {
    conditions.push('announcement_no = ?');
    params.push(batchPayload.announcement_no);
  }

  if (batchPayload.title) {
    conditions.push('(title = ? AND publish_date <=> ?)');
    params.push(batchPayload.title, batchPayload.publish_date || null);
  }

  if (!conditions.length) {
    return null;
  }

  const [rows] = await connection.query(
    `
      SELECT id, status, title, published_announcement_id, published_supervision_id
      FROM announcement_staging_batches
      WHERE status = 'pending'
        AND (${conditions.map((condition) => `(${condition})`).join(' OR ')})
      ORDER BY id DESC
      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function findExistingPublishedRecord(connection, batchPayload = {}) {
  const typeInfo = getBatchTypeInfo(batchPayload, parseJsonSafely(batchPayload.raw_payload, {}));
  const targetTable = typeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements';
  const idField = targetTable === 'supervisions' ? 'supervision_id' : 'announcement_id';
  const conditions = [];
  const params = [];

  if (batchPayload.source_detail_url) {
    conditions.push('source_detail_url = ?');
    params.push(batchPayload.source_detail_url);
  }

  if (batchPayload.source_json_file) {
    conditions.push('source_json_file = ?');
    params.push(batchPayload.source_json_file);
  }

  if (batchPayload.announcement_no) {
    conditions.push('announcement_no = ?');
    params.push(batchPayload.announcement_no);
  }

  if (batchPayload.title) {
    conditions.push('(title = ? AND publish_date <=> ?)');
    params.push(batchPayload.title, batchPayload.publish_date || null);
  }

  if (!conditions.length) {
    return null;
  }

  const [rows] = await connection.query(
    `
      SELECT id, title
      FROM ${targetTable}
      WHERE ${conditions.map((condition) => `(${condition})`).join(' OR ')}
      ORDER BY id DESC
      LIMIT 1
    `,
    params
  );

  if (!rows[0]) {
    return null;
  }

  return {
    target_table: targetTable,
    [idField]: Number(rows[0].id),
    title: rows[0].title
  };
}

async function clearAnnouncementTracebacksBySource(connection, batchPayload = {}, traceTypes = []) {
  if (!Array.isArray(traceTypes) || traceTypes.length === 0) {
    return;
  }

  const sourceConditions = [];
  const params = [...traceTypes];

  if (batchPayload.source_detail_url) {
    sourceConditions.push('source_detail_url = ?');
    params.push(batchPayload.source_detail_url);
  }

  if (batchPayload.source_json_file) {
    sourceConditions.push('source_json_file = ?');
    params.push(batchPayload.source_json_file);
  }

  if (!sourceConditions.length) {
    return;
  }

  await connection.query(
    `
      DELETE FROM announcement_staging_tracebacks
      WHERE trace_type IN (${traceTypes.map(() => '?').join(', ')})
        AND (${sourceConditions.join(' OR ')})
    `,
    params
  );
}

function buildTracebackAttachmentSummary(batchPayload = {}) {
  return {
    attachment_count: Number(batchPayload.attachment_count || 0),
    parsed_detail_count: Number(batchPayload.parsed_detail_count || 0),
    attachment_validation: batchPayload.attachment_validation || null,
    attachments: Array.isArray(batchPayload.attachment_preview) ? batchPayload.attachment_preview : []
  };
}

async function upsertAnnouncementTraceback(connection, options = {}) {
  await ensureAnnouncementTracebackTables(connection);

  const {
    trace_type,
    batchPayload = {},
    reason,
    existing_batch_id = null,
    existing_announcement_id = null,
    existing_supervision_id = null
  } = options;

  const sourceJsonFile = batchPayload.source_json_file;
  const sourceDetailUrl = batchPayload.source_detail_url || null;
  const sourcePage = batchPayload.source_page || null;
  const attachmentSummaryJson = JSON.stringify(buildTracebackAttachmentSummary(batchPayload));
  const rawPayload = batchPayload.raw_payload || null;
  const importedByUserId = batchPayload.imported_by_user_id || null;
  const importedByUsername = batchPayload.imported_by_username || null;
  const importedAt = batchPayload.imported_at || null;
  const importSource = batchPayload.import_source || 'server_directory';
  const sourceFileName = batchPayload.source_file_name || null;
  const sourceRelativePath = batchPayload.source_relative_path || null;

  const [existingRows] = await connection.query(
    `
      SELECT id
      FROM announcement_staging_tracebacks
      WHERE trace_type = ?
        AND (
          (source_detail_url IS NOT NULL AND source_detail_url = ?)
          OR source_json_file = ?
        )
      ORDER BY id DESC
      LIMIT 1
    `,
    [trace_type, sourceDetailUrl, sourceJsonFile]
  );

  if (existingRows.length > 0) {
    await connection.query(
      `
        UPDATE announcement_staging_tracebacks
        SET title = ?, announcement_no = ?, source_json_file = ?, source_detail_url = ?, source_page = ?,
            product_type = ?, announcement_type = ?, reason = ?, attachment_summary_json = ?, raw_payload = ?,
            existing_batch_id = ?, existing_announcement_id = ?, existing_supervision_id = ?,
            imported_by_user_id = ?, imported_by_username = ?, imported_at = ?, import_source = ?,
            source_file_name = ?, source_relative_path = ?,
            handled_status = 'pending', handled_at = NULL
        WHERE id = ?
      `,
      [
        batchPayload.title,
        batchPayload.announcement_no,
        sourceJsonFile,
        sourceDetailUrl,
        sourcePage,
        batchPayload.product_type,
        batchPayload.announcement_type,
        reason,
        attachmentSummaryJson,
        rawPayload,
        existing_batch_id,
        existing_announcement_id,
        existing_supervision_id,
        importedByUserId,
        importedByUsername,
        importedAt,
        importSource,
        sourceFileName,
        sourceRelativePath,
        existingRows[0].id
      ]
    );
    return Number(existingRows[0].id);
  }

  const [result] = await connection.query(
    `
      INSERT INTO announcement_staging_tracebacks (
        trace_type,
        title,
        announcement_no,
        source_json_file,
        source_detail_url,
        source_page,
        product_type,
        announcement_type,
        reason,
        attachment_summary_json,
        raw_payload,
        existing_batch_id,
        existing_announcement_id,
        existing_supervision_id,
        imported_by_user_id,
        imported_by_username,
        imported_at,
        import_source,
        source_file_name,
        source_relative_path,
        handled_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
    [
      trace_type,
      batchPayload.title,
      batchPayload.announcement_no,
      sourceJsonFile,
      sourceDetailUrl,
      sourcePage,
      batchPayload.product_type,
      batchPayload.announcement_type,
      reason,
      attachmentSummaryJson,
      rawPayload,
      existing_batch_id,
      existing_announcement_id,
      existing_supervision_id,
      importedByUserId,
      importedByUsername,
      importedAt,
      importSource,
      sourceFileName,
      sourceRelativePath
    ]
  );

  return Number(result.insertId);
}

async function listAnnouncementStagingTracebacks(connection, filters = {}) {
  await ensureAnnouncementStagingSchema(connection);

  const conditions = ['1=1'];
  const params = [];

  if (filters.id) {
    conditions.push('id = ?');
    params.push(Number(filters.id));
  }

  if (filters.handled_status) {
    conditions.push('handled_status = ?');
    params.push(filters.handled_status);
  }


  if (filters.trace_type) {
    conditions.push('trace_type = ?');
    params.push(filters.trace_type);
  }

  if (filters.product_type) {
    conditions.push('product_type = ?');
    params.push(normalizeProductType(filters.product_type));
  }

  const keyword = normalizeText(filters.keyword);
  if (keyword) {
    conditions.push(`(
      title LIKE ? OR
      announcement_no LIKE ? OR
      source_detail_url LIKE ? OR
      reason LIKE ? OR
      COALESCE(source_json_file, '') LIKE ? OR
      COALESCE(imported_by_username, '') LIKE ?
    )`);
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 50, 1), 200);
  const [rows] = await connection.query(
    `
      SELECT *
      FROM announcement_staging_tracebacks
      WHERE ${conditions.join(' AND ')}
      ORDER BY CASE WHEN handled_status = 'pending' THEN 0 ELSE 1 END ASC, updated_at DESC, id DESC
      LIMIT ?
    `,
    [...params, limit]
  );

  return rows.map((row) => ({
    ...row,
    product_type_label: getProductTypeLabel(row.product_type),
    announcement_type_label: getAnnouncementTypeLabel(row.announcement_type),
    trace_type_label: TRACEBACK_TYPE_LABELS[row.trace_type] || row.trace_type,
    attachment_summary: parseJsonSafely(row.attachment_summary_json, null)
  }));
}

async function markAnnouncementStagingTracebackResolved(connection, tracebackId) {
  await ensureAnnouncementStagingSchema(connection);
  await connection.query(
    `
      UPDATE announcement_staging_tracebacks
      SET handled_status = 'resolved', handled_at = NOW()
      WHERE id = ?
    `,
    [tracebackId]
  );
}

async function deleteAnnouncementStagingTraceback(connection, tracebackId) {
  await ensureAnnouncementStagingSchema(connection);

  const [tracebackRows] = await connection.query(
    'SELECT * FROM announcement_staging_tracebacks WHERE id = ? LIMIT 1',
    [tracebackId]
  );
  const traceback = tracebackRows[0] || null;
  if (!traceback) {
    return {
      deleted: false,
      deleted_staging_batch_count: 0,
      deleted_staging_item_count: 0,
      deleted_traceback_count: 0
    };
  }

  const batchConditions = [];
  const batchParams = [];

  if (traceback.existing_batch_id) {
    batchConditions.push('id = ?');
    batchParams.push(traceback.existing_batch_id);
  }
  if (traceback.source_json_file) {
    batchConditions.push('source_json_file = ?');
    batchParams.push(traceback.source_json_file);
  }
  if (traceback.source_detail_url) {
    batchConditions.push('source_detail_url = ?');
    batchParams.push(traceback.source_detail_url);
  }
  if (traceback.announcement_no) {
    batchConditions.push('announcement_no = ?');
    batchParams.push(traceback.announcement_no);
  }

  let deletedStagingBatchCount = 0;
  let deletedStagingItemCount = 0;
  let stagingBatchIds = [];

  if (batchConditions.length > 0) {
    const [batchRows] = await connection.query(
      `
        SELECT id
        FROM announcement_staging_batches
        WHERE status = 'pending'
          AND published_announcement_id IS NULL
          AND published_supervision_id IS NULL
          AND (${batchConditions.map((condition) => `(${condition})`).join(' OR ')})
      `,
      batchParams
    );
    stagingBatchIds = batchRows.map((row) => Number(row.id)).filter(Boolean);
  }

  if (stagingBatchIds.length > 0) {
    const placeholders = stagingBatchIds.map(() => '?').join(', ');

    const [itemDeleteResult] = await connection.query(
      `DELETE FROM announcement_staging_items WHERE staging_batch_id IN (${placeholders})`,
      stagingBatchIds
    );
    deletedStagingItemCount = Number(itemDeleteResult.affectedRows || 0);

    // Older databases may not have a working cascade, so clear dependent temporary rows explicitly.
    await connection.query(
      `DELETE FROM announcement_publish_backups WHERE staging_batch_id IN (${placeholders})`,
      stagingBatchIds
    );

    const [batchDeleteResult] = await connection.query(
      `
        DELETE FROM announcement_staging_batches
        WHERE id IN (${placeholders})
          AND status = 'pending'
          AND published_announcement_id IS NULL
          AND published_supervision_id IS NULL
      `,
      stagingBatchIds
    );
    deletedStagingBatchCount = Number(batchDeleteResult.affectedRows || 0);
  }

  const tracebackConditions = ['id = ?'];
  const tracebackParams = [tracebackId];

  if (stagingBatchIds.length > 0) {
    tracebackConditions.push(`existing_batch_id IN (${stagingBatchIds.map(() => '?').join(', ')})`);
    tracebackParams.push(...stagingBatchIds);
  }

  const [tracebackDeleteResult] = await connection.query(
    `
      DELETE FROM announcement_staging_tracebacks
      WHERE ${tracebackConditions.map((condition) => `(${condition})`).join(' OR ')}
    `,
    tracebackParams
  );

  return {
    deleted: Number(tracebackDeleteResult.affectedRows || 0) > 0,
    deleted_staging_batch_count: deletedStagingBatchCount,
    deleted_staging_item_count: deletedStagingItemCount,
    deleted_traceback_count: Number(tracebackDeleteResult.affectedRows || 0)
  };
}

async function getAnnouncementWorkspaceCache(connection, cacheKey = DEFAULT_WORKSPACE_CACHE_KEY) {

  await ensureAnnouncementStagingSchema(connection);
  const [rows] = await connection.query(
    'SELECT cache_key, payload_json, updated_at FROM announcement_staging_workspace_cache WHERE cache_key = ? LIMIT 1',
    [cacheKey]
  );

  if (!rows[0]) {
    return null;
  }

  return {
    cache_key: rows[0].cache_key,
    payload: parseJsonSafely(rows[0].payload_json, {}),
    updated_at: rows[0].updated_at || null
  };
}

async function saveAnnouncementWorkspaceCache(connection, payload = {}, cacheKey = DEFAULT_WORKSPACE_CACHE_KEY) {
  await ensureAnnouncementStagingSchema(connection);
  const payloadJson = JSON.stringify(payload || {});
  await connection.query(
    `
      INSERT INTO announcement_staging_workspace_cache (cache_key, payload_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = CURRENT_TIMESTAMP
    `,
    [cacheKey, payloadJson]
  );

  return getAnnouncementWorkspaceCache(connection, cacheKey);
}

function buildStagingBatchPayload(sourceJsonFile, payload = {}, importOptions = {}) {

  const mergedPayload = mergeImportMetaIntoPayload(payload, importOptions);
  const typeInfo = resolvePayloadTypeInfo(mergedPayload, importOptions);
  const auditPayload = buildAuditPayload(importOptions);

  const rows = collectBatchRows(mergedPayload, typeInfo.announcement_type);
  const extracted = extractAnnouncementInfo(mergedPayload.content_text || mergedPayload.content || '');
  const attachments = Array.isArray(mergedPayload.attachments) ? mergedPayload.attachments : [];
  const primaryAttachment = attachments[0] || {};
  const firstFlightRow = rows[0] || {};
  const attachmentPreview = buildAttachmentPreview(mergedPayload, typeInfo);
  const attachmentValidation = buildAttachmentValidation(mergedPayload, rows, attachmentPreview);


  return {
    source_sequence: Number.isFinite(Number(mergedPayload.sequence)) ? Number(mergedPayload.sequence) : null,
    source_json_file: sourceJsonFile,
    source_detail_url: normalizeNullableText(mergedPayload.detail_url),
    source_page: normalizeNullableText(mergedPayload.source_page),
    title: normalizeNullableText(mergedPayload.title) || path.basename(sourceJsonFile, '.json'),
    announcement_no: normalizeNullableText(mergedPayload.announcement_no),
    publish_date: normalizeDateValue(mergedPayload.publish_date || firstFlightRow.publish_date || firstFlightRow.publish_date_text),
    content: normalizeNullableMultilineText(mergedPayload.content_text || mergedPayload.content || mergedPayload.content_preview),
    inspection_unit: normalizeNullableText(mergedPayload.inspection_unit)
      || (typeInfo.announcement_type === 'flight_inspection'
        ? normalizeNullableText(firstFlightRow.inspection_unit)
        : extracted.inspection_unit),
    inspection_count: rows.length > 0
      ? rows.length
      : normalizeInspectionCount(mergedPayload.inspection_count, extracted.inspection_count),
    attachment_count: attachments.length,
    parsed_detail_count: rows.length,
    counterfeit_count: typeInfo.announcement_type === 'flight_inspection'
      ? 0
      : rows.filter((item) => item.is_counterfeit).length,
    primary_attachment_name: normalizeNullableText(primaryAttachment.attachment_name),
    primary_attachment_path: normalizeNullableText(primaryAttachment.local_path),
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    raw_payload: JSON.stringify(mergedPayload),
    ...auditPayload,
    items: rows,
    attachment_preview: attachmentPreview,
    attachment_validation: attachmentValidation
  };
}


async function upsertStagingBatchFromJsonPayload(connection, sourceJsonFile, payload = {}, importOptions = {}) {
  const batchPayload = buildStagingBatchPayload(sourceJsonFile, payload, importOptions);
  const existingBatch = await findExistingStagingBatch(connection, batchPayload);

  if (existingBatch) {
    const warningMessage = `重复导入：临时区已存在“${existingBatch.title || batchPayload.title}”，本次已跳过（不产生倒溯）`;
    await clearAnnouncementTracebacksBySource(connection, batchPayload, ['duplicate']);

    return {
      id: Number(existingBatch.id),
      action: 'skipped_duplicate',
      skipped: true,
      title: batchPayload.title,
      detail_count: batchPayload.items.length,
      counterfeit_count: batchPayload.counterfeit_count,
      source_json_file: batchPayload.source_json_file,
      source_file_name: batchPayload.source_file_name,
      source_relative_path: batchPayload.source_relative_path,
      imported_by_username: batchPayload.imported_by_username,
      imported_at: batchPayload.imported_at,
      source_detail_url: batchPayload.source_detail_url,
      product_type: batchPayload.product_type,
      announcement_type: batchPayload.announcement_type,
      product_type_label: getProductTypeLabel(batchPayload.product_type),
      announcement_type_label: getAnnouncementTypeLabel(batchPayload.announcement_type),
      warning_message: warningMessage,
      traceback_id: null,
      existing_batch_id: Number(existingBatch.id)
    };
  }

  const existingPublished = await findExistingPublishedRecord(connection, batchPayload);
  if (existingPublished) {
    const existingAnnouncementId = existingPublished.announcement_id || null;
    const existingSupervisionId = existingPublished.supervision_id || null;
    const warningMessage = existingPublished.target_table === 'supervisions'
      ? `重复导入：飞检正式库已存在“${existingPublished.title || batchPayload.title}”，本次已跳过（不产生倒溯）`
      : `重复导入：抽检正式库已存在“${existingPublished.title || batchPayload.title}”，本次已跳过（不产生倒溯）`;
    await clearAnnouncementTracebacksBySource(connection, batchPayload, ['duplicate']);

    return {
      id: null,
      action: 'skipped_duplicate',
      skipped: true,
      title: batchPayload.title,
      detail_count: batchPayload.items.length,
      counterfeit_count: batchPayload.counterfeit_count,
      source_json_file: batchPayload.source_json_file,
      source_file_name: batchPayload.source_file_name,
      source_relative_path: batchPayload.source_relative_path,
      imported_by_username: batchPayload.imported_by_username,
      imported_at: batchPayload.imported_at,
      source_detail_url: batchPayload.source_detail_url,
      product_type: batchPayload.product_type,
      announcement_type: batchPayload.announcement_type,
      product_type_label: getProductTypeLabel(batchPayload.product_type),
      announcement_type_label: getAnnouncementTypeLabel(batchPayload.announcement_type),
      warning_message: warningMessage,
      traceback_id: null,
      existing_announcement_id: existingAnnouncementId,
      existing_supervision_id: existingSupervisionId
    };
  }

  const [result] = await connection.query(

    `
      INSERT INTO announcement_staging_batches (
        source_sequence,
        source_json_file,
        source_detail_url,
        source_page,
        title,
        announcement_no,
        publish_date,
        content,
        inspection_unit,
        inspection_count,
        attachment_count,
        parsed_detail_count,
        counterfeit_count,
        primary_attachment_name,
        primary_attachment_path,
        product_type,
        announcement_type,
        raw_payload,
        imported_by_user_id,
        imported_by_username,
        imported_at,
        import_source,
        source_file_name,
        source_relative_path,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
    [
      batchPayload.source_sequence,
      batchPayload.source_json_file,
      batchPayload.source_detail_url,
      batchPayload.source_page,
      batchPayload.title,
      batchPayload.announcement_no,
      batchPayload.publish_date,
      batchPayload.content,
      batchPayload.inspection_unit,
      batchPayload.inspection_count,
      batchPayload.attachment_count,
      batchPayload.parsed_detail_count,
      batchPayload.counterfeit_count,
      batchPayload.primary_attachment_name,
      batchPayload.primary_attachment_path,
      batchPayload.product_type,
      batchPayload.announcement_type,
      batchPayload.raw_payload,
      batchPayload.imported_by_user_id,
      batchPayload.imported_by_username,
      batchPayload.imported_at,
      batchPayload.import_source,
      batchPayload.source_file_name,
      batchPayload.source_relative_path
    ]
  );
  const stagingBatchId = result.insertId;

  await replaceStagingItems(connection, stagingBatchId, batchPayload.items, batchPayload.announcement_type);
  await clearAnnouncementTracebacksBySource(connection, batchPayload, ['duplicate']);

  let tracebackId = null;
  let warningMessage = null;
  const needsManualReview = Boolean(batchPayload.attachment_validation?.blocking);

  if (needsManualReview) {
    warningMessage = batchPayload.attachment_validation.message || '附件或正文解析结果需要人工核验';
    tracebackId = await upsertAnnouncementTraceback(connection, {
      trace_type: 'parse_failed',
      batchPayload,
      reason: warningMessage,
      existing_batch_id: stagingBatchId
    });
  } else {
    await clearAnnouncementTracebacksBySource(connection, batchPayload, ['parse_failed']);
  }

  return {
    id: Number(stagingBatchId),
    action: 'created',
    skipped: false,
    title: batchPayload.title,
    detail_count: batchPayload.items.length,
    counterfeit_count: batchPayload.counterfeit_count,
    source_json_file: batchPayload.source_json_file,
    source_file_name: batchPayload.source_file_name,
    source_relative_path: batchPayload.source_relative_path,
    imported_by_username: batchPayload.imported_by_username,
    imported_at: batchPayload.imported_at,
    source_detail_url: batchPayload.source_detail_url,
    product_type: batchPayload.product_type,
    announcement_type: batchPayload.announcement_type,
    product_type_label: getProductTypeLabel(batchPayload.product_type),
    announcement_type_label: getAnnouncementTypeLabel(batchPayload.announcement_type),
    warning_message: warningMessage,
    traceback_id: tracebackId,
    needs_manual_review: needsManualReview,
    attachment_validation: batchPayload.attachment_validation
  };
}

async function upsertStagingBatchFromFile(connection, filePath, importOptions = {}) {
  const absoluteFilePath = path.resolve(filePath);
  const fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
  const payload = JSON.parse(fileContent);
  return upsertStagingBatchFromJsonPayload(connection, absoluteFilePath, payload, {
    ...importOptions,
    sourceFileName: importOptions.sourceFileName || path.basename(absoluteFilePath),
    sourceRelativePath: importOptions.sourceRelativePath || path.basename(absoluteFilePath),
    auditContext: {
      imported_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      import_source: 'server_directory',
      ...(importOptions.auditContext || {})
    }
  });
}


async function importStagingFromJsonDirectory(connection, directoryPath = DEFAULT_STAGING_SOURCE_DIR, importOptions = {}) {
  await ensureAnnouncementStagingSchema(connection);

  const normalizedDirectoryPath = path.resolve(directoryPath);
  if (!fs.existsSync(normalizedDirectoryPath)) {
    throw new Error(`未找到爬虫输出目录：${normalizedDirectoryPath}`);
  }

  const fileNames = fs.readdirSync(normalizedDirectoryPath)
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));

  const processedItems = [];
  const deleteFailures = [];
  const importErrors = [];

  for (const fileName of fileNames) {
    const filePath = path.join(normalizedDirectoryPath, fileName);
    await connection.beginTransaction();
    try {
      const result = await upsertStagingBatchFromFile(connection, filePath, importOptions);
      await connection.commit();

      let deleteResult = { deleted: false, message: null };
      if (result.action === 'created' || result.action === 'skipped_duplicate') {
        deleteResult = removeImportedJsonFile(filePath);
        if (!deleteResult.deleted) {
          deleteFailures.push({
            file_name: fileName,
            file_path: filePath,
            message: deleteResult.message
          });
        }
      }

      processedItems.push({
        ...result,
        source_json_name: fileName,
        source_deleted: deleteResult.deleted,
        delete_message: (result.action === 'created' || result.action === 'skipped_duplicate') && !deleteResult.deleted
          ? deleteResult.message
          : null
      });
    } catch (error) {
      await connection.rollback();
      const message = `${fileName} 导入失败：${error.message}`;
      let tracebackId = null;
      let tracebackPayload = null;

      try {
        tracebackPayload = buildImportFailedTracebackPayload(filePath, message, fileName);
        tracebackId = await upsertAnnouncementTraceback(connection, {
          trace_type: 'import_failed',
          batchPayload: tracebackPayload,
          reason: message
        });
      } catch (tracebackError) {
        console.error('写入导入异常倒溯记录失败:', tracebackError);
      }

      importErrors.push({
        file_name: fileName,
        file_path: filePath,
        message,
        traceback_id: tracebackId
      });
      processedItems.push({
        id: null,
        action: 'failed',
        skipped: true,
        title: tracebackPayload?.title || path.basename(fileName, '.json'),
        source_json_file: filePath,
        source_json_name: fileName,
        source_detail_url: tracebackPayload?.source_detail_url || null,
        product_type: tracebackPayload?.product_type || null,
        announcement_type: tracebackPayload?.announcement_type || null,
        warning_message: message,
        traceback_id: tracebackId,
        source_deleted: false,
        delete_message: null
      });
    }

  }

  const createdItems = processedItems.filter((item) => item.action === 'created');
  const duplicateItems = processedItems.filter((item) => item.action === 'skipped_duplicate');
  const parseWarningItems = createdItems.filter((item) => item.needs_manual_review);
  const remainingDirectoryInfo = listJsonFilesFromDirectory(normalizedDirectoryPath);

  return {
    source_dir: normalizedDirectoryPath,
    total_files: fileNames.length,
    processed_count: processedItems.length,
    imported_count: createdItems.length,
    created_count: createdItems.length,
    updated_count: 0,
    duplicate_count: duplicateItems.length,
    parse_warning_count: parseWarningItems.length,
    parse_failed_count: parseWarningItems.length,
    skipped_count: duplicateItems.length,
    error_count: importErrors.length,
    deleted_count: processedItems.filter((item) => item.source_deleted).length,
    delete_failed_count: deleteFailures.length,
    delete_failures: deleteFailures,
    errors: importErrors,
    remaining_json_count: remainingDirectoryInfo.file_names.length,
    items: processedItems
  };
}

async function importStagingFromUploadedFiles(connection, files = [], importOptions = {}, auditContext = {}) {
  await ensureAnnouncementStagingSchema(connection);

  const normalizedFiles = Array.isArray(files) ? files : [];
  const processedItems = [];
  const importErrors = [];
  const importedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  for (const file of normalizedFiles) {
    const fileName = normalizeNullableText(file.originalname) || 'unknown.json';
    const relativePath = normalizeNullableText(file.relativePath) || fileName;
    const sourceIdentifier = buildUploadSourceIdentifier(relativePath, fileName);
    const fileOptions = {
      ...importOptions,
      sourceFileName: fileName,
      sourceRelativePath: relativePath,
      auditContext: {
        ...auditContext,
        imported_at: importedAt,
        import_source: 'upload'
      }
    };

    await connection.beginTransaction();
    try {
      const payload = JSON.parse(Buffer.isBuffer(file.buffer) ? file.buffer.toString('utf-8') : String(file.content || ''));
      const result = await upsertStagingBatchFromJsonPayload(connection, sourceIdentifier, payload, fileOptions);
      await connection.commit();

      processedItems.push({
        ...result,
        source_json_name: fileName,
        source_deleted: false,
        delete_message: null
      });
    } catch (error) {
      await connection.rollback();
      const message = `${relativePath} 导入失败：${error.message}`;
      let tracebackId = null;
      const tracebackPayload = {
        ...buildAuditPayload(fileOptions),
        source_json_file: sourceIdentifier,
        source_detail_url: null,
        source_page: null,
        title: path.basename(fileName, path.extname(fileName)) || fileName,
        announcement_no: null,
        product_type: normalizeProductType(importOptions.product_type),
        announcement_type: normalizeAnnouncementType(importOptions.announcement_type),
        raw_payload: null,
        attachment_count: 0,
        parsed_detail_count: 0
      };

      try {
        tracebackId = await upsertAnnouncementTraceback(connection, {
          trace_type: 'import_failed',
          batchPayload: tracebackPayload,
          reason: message
        });
      } catch (tracebackError) {
        console.error('写入上传导入异常倒溯记录失败:', tracebackError);
      }

      importErrors.push({
        file_name: fileName,
        relative_path: relativePath,
        message,
        traceback_id: tracebackId
      });
      processedItems.push({
        id: null,
        action: 'failed',
        skipped: true,
        title: tracebackPayload.title,
        source_json_file: sourceIdentifier,
        source_json_name: fileName,
        source_file_name: fileName,
        source_relative_path: relativePath,
        source_detail_url: null,
        product_type: tracebackPayload.product_type,
        announcement_type: tracebackPayload.announcement_type,
        warning_message: message,
        traceback_id: tracebackId,
        source_deleted: false,
        delete_message: null
      });
    }
  }

  const createdItems = processedItems.filter((item) => item.action === 'created');
  const duplicateItems = processedItems.filter((item) => item.action === 'skipped_duplicate');
  const parseWarningItems = createdItems.filter((item) => item.needs_manual_review);

  return {
    source_dir: 'browser_upload',
    total_files: normalizedFiles.length,
    processed_count: processedItems.length,
    imported_count: createdItems.length,
    created_count: createdItems.length,
    updated_count: 0,
    duplicate_count: duplicateItems.length,
    parse_warning_count: parseWarningItems.length,
    parse_failed_count: parseWarningItems.length,
    skipped_count: duplicateItems.length,
    error_count: importErrors.length,
    deleted_count: 0,
    delete_failed_count: 0,
    delete_failures: [],
    errors: importErrors,
    remaining_json_count: 0,
    items: processedItems
  };
}




function buildDetailItemsFromBatch(batch = {}) {
  const rawPayload = parseJsonSafely(batch.raw_payload, {});
  const typeInfo = getBatchTypeInfo(batch, rawPayload);
  return {
    rawPayload,
    typeInfo,
    items: collectBatchRows(rawPayload, typeInfo.announcement_type)
  };
}

async function getAnnouncementStagingDetail(connection, stagingBatchId) {
  await ensureAnnouncementStagingSchema(connection);

  const [batchRows] = await connection.query(
    `
      SELECT *
      FROM announcement_staging_batches
      WHERE id = ?
      LIMIT 1
    `,
    [stagingBatchId]
  );

  const batch = batchRows[0] || null;
  if (!batch) {
    return null;
  }

  const { rawPayload, typeInfo, items } = buildDetailItemsFromBatch(batch);
  const companyPreview = buildCompanyPreview(items, typeInfo);
  const attachments = buildAttachmentPreview(rawPayload, typeInfo);
  const parseValidation = buildAttachmentValidation(rawPayload, items, attachments);


  return {
    batch: {
      ...batch,
      ...typeInfo
    },
    items,
    company_preview: companyPreview,
    attachments,
    parse_validation: parseValidation,
    summary: {
      attachment_count: attachments.length,
      company_count: companyPreview.length,
      detail_count: items.length,
      counterfeit_count: typeInfo.announcement_type === 'flight_inspection'
        ? 0
        : items.filter((item) => item.is_counterfeit).length,
      success_attachment_count: Number(parseValidation.success_attachment_count || 0),
      failed_attachment_count: Number(parseValidation.failed_attachment_count || 0)
    }
  };
}

function normalizeEditableStagingDetailItem(input = {}, index = 0) {
  const normalized = normalizeDetailRow(input, index);
  if (!normalized.product_name) {
    throw new Error('产品名称不能为空');
  }
  return normalized;
}

function getEditableSamplingPayload(batch = {}) {
  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  if (typeInfo.announcement_type === 'flight_inspection') {
    throw new Error('飞行检查批次暂不支持在此编辑产品明细');
  }

  const rawPayload = parseJsonSafely(batch.raw_payload, {});
  if (!Array.isArray(rawPayload.attachments)) {
    rawPayload.attachments = [];
  }

  if (!rawPayload.attachments.length) {
    rawPayload.attachments.push({
      attachment_name: batch.primary_attachment_name || '人工维护产品明细',
      parse_result: {
        supported: true,
        attachment_type: 'manual',
        message: '人工维护产品明细',
        rows: []
      }
    });
  }

  rawPayload.attachments.forEach((attachment, index) => {
    if (!attachment || typeof attachment !== 'object') {
      rawPayload.attachments[index] = {};
    }
    const target = rawPayload.attachments[index];
    if (!target.parse_result || typeof target.parse_result !== 'object') {
      target.parse_result = {
        supported: true,
        attachment_type: 'manual',
        message: '人工维护产品明细',
        rows: []
      };
    }
    if (!Array.isArray(target.parse_result.rows)) {
      target.parse_result.rows = [];
    }
  });

  return { rawPayload, typeInfo };
}

async function getStagingBatchForItemEdit(connection, stagingBatchId) {
  await ensureAnnouncementStagingSchema(connection);
  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }
  return batch;
}

function resolveEditableAttachment(rawPayload = {}, attachmentIndexRaw = 1) {
  const requestedIndex = Math.max(Number.parseInt(attachmentIndexRaw, 10) || 1, 1) - 1;
  const index = Math.min(requestedIndex, rawPayload.attachments.length - 1);
  const attachment = rawPayload.attachments[index];
  return { attachment, attachmentIndex: index };
}

function resolveEditableRowIndex(rows = [], locator = {}) {
  const rowIndex = Number.parseInt(locator.row_index, 10);
  if (Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < rows.length) {
    return rowIndex;
  }

  const sequenceNo = Number.parseInt(locator.sequence_no, 10);
  if (Number.isInteger(sequenceNo)) {
    const matchedIndex = rows.findIndex((row, index) => {
      const normalized = normalizeDetailRow(row, index);
      return Number(normalized.sequence_no) === sequenceNo;
    });
    if (matchedIndex >= 0) {
      return matchedIndex;
    }
  }

  return -1;
}

async function persistStagingDetailPayload(connection, stagingBatchId, rawPayload = {}) {
  const typeInfo = getBatchTypeInfo({ announcement_type: 'sampling' }, rawPayload);
  const items = collectBatchRows(rawPayload, typeInfo.announcement_type);
  const attachments = buildAttachmentPreview(rawPayload, typeInfo);
  const validation = buildAttachmentValidation(rawPayload, items, attachments);
  const rawPayloadJson = JSON.stringify(rawPayload);

  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET raw_payload = ?,
          inspection_count = ?,
          parsed_detail_count = ?,
          counterfeit_count = ?,
          attachment_count = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      rawPayloadJson,
      items.length,
      items.length,
      items.filter((item) => item.is_counterfeit).length,
      attachments.length,
      stagingBatchId
    ]
  );

  await replaceStagingItems(connection, stagingBatchId, items, typeInfo.announcement_type);

  if (!validation.blocking) {
    await clearAnnouncementTracebacksBySource(connection, {
      source_json_file: rawPayload.source_json_file,
      source_detail_url: rawPayload.source_detail_url || rawPayload.detail_url
    }, ['parse_failed']);
  }

  return getAnnouncementStagingDetail(connection, stagingBatchId);
}

async function createAnnouncementStagingItem(connection, stagingBatchId, payload = {}) {
  const batch = await getStagingBatchForItemEdit(connection, stagingBatchId);
  const { rawPayload } = getEditableSamplingPayload(batch);
  const { attachment } = resolveEditableAttachment(rawPayload, payload.attachment_index || 1);
  const rows = attachment.parse_result.rows;
  const item = normalizeEditableStagingDetailItem(payload.item || payload, rows.length);
  rows.push(item);
  return persistStagingDetailPayload(connection, stagingBatchId, rawPayload);
}

async function updateAnnouncementStagingItem(connection, stagingBatchId, locator = {}, payload = {}) {
  const batch = await getStagingBatchForItemEdit(connection, stagingBatchId);
  const { rawPayload } = getEditableSamplingPayload(batch);
  const { attachment } = resolveEditableAttachment(rawPayload, locator.attachment_index || payload.attachment_index || 1);
  const rows = attachment.parse_result.rows;
  const rowIndex = resolveEditableRowIndex(rows, locator);
  if (rowIndex < 0) {
    throw new Error('产品明细不存在');
  }

  rows[rowIndex] = normalizeEditableStagingDetailItem({
    ...rows[rowIndex],
    ...(payload.item || payload)
  }, rowIndex);
  return persistStagingDetailPayload(connection, stagingBatchId, rawPayload);
}

async function deleteAnnouncementStagingItem(connection, stagingBatchId, locator = {}) {
  const batch = await getStagingBatchForItemEdit(connection, stagingBatchId);
  const { rawPayload } = getEditableSamplingPayload(batch);
  const { attachment } = resolveEditableAttachment(rawPayload, locator.attachment_index || 1);
  const rows = attachment.parse_result.rows;
  const rowIndex = resolveEditableRowIndex(rows, locator);
  if (rowIndex < 0) {
    throw new Error('产品明细不存在');
  }

  rows.splice(rowIndex, 1);
  return persistStagingDetailPayload(connection, stagingBatchId, rawPayload);
}

/** 按当前批次 raw_payload 重建 announcement_staging_items（抽检）；飞检批次会清空明细表对应行 */
async function resyncAnnouncementStagingItemsTable(connection, stagingBatchId) {
  await ensureAnnouncementStagingSchema(connection);
  const batch = await getStagingBatchForItemEdit(connection, stagingBatchId);
  const rawPayload = parseJsonSafely(batch.raw_payload, {});
  const typeInfo = getBatchTypeInfo(batch, rawPayload);
  const items = collectBatchRows(rawPayload, typeInfo.announcement_type);
  await replaceStagingItems(connection, stagingBatchId, items, typeInfo.announcement_type);
  return getAnnouncementStagingDetail(connection, stagingBatchId);
}


async function getAnnouncementStagingOverview(connection, directoryPath = DEFAULT_STAGING_SOURCE_DIR) {
  await ensureAnnouncementStagingSchema(connection);

  const directoryInfo = listJsonFilesFromDirectory(directoryPath);
  const [rows] = await connection.query(`
    SELECT
      COUNT(*) AS staging_batch_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_batch_count,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_batch_count,
      SUM(CASE WHEN announcement_type = 'sampling' THEN 1 ELSE 0 END) AS sampling_batch_count,
      SUM(CASE WHEN announcement_type = 'flight_inspection' THEN 1 ELSE 0 END) AS flight_batch_count,
      SUM(CASE WHEN product_type = 'cosmetics' THEN 1 ELSE 0 END) AS cosmetics_batch_count,
      SUM(CASE WHEN product_type = 'food' THEN 1 ELSE 0 END) AS food_batch_count,
      SUM(CASE WHEN product_type = 'medical_device' THEN 1 ELSE 0 END) AS medical_device_batch_count,
      SUM(parsed_detail_count) AS total_detail_count,
      SUM(counterfeit_count) AS total_counterfeit_count,
      SUM(CASE WHEN status = 'pending' THEN parsed_detail_count ELSE 0 END) AS pending_detail_count,
      SUM(CASE WHEN status = 'confirmed' THEN parsed_detail_count ELSE 0 END) AS confirmed_detail_count,
      SUM(CASE WHEN status = 'pending' THEN counterfeit_count ELSE 0 END) AS pending_counterfeit_count,
      SUM(CASE WHEN status = 'confirmed' THEN counterfeit_count ELSE 0 END) AS confirmed_counterfeit_count,
      MAX(updated_at) AS last_imported_at,
      MAX(confirmed_at) AS last_confirmed_at
    FROM announcement_staging_batches
  `);
  const [tracebackRows] = await connection.query(`
    SELECT
      COUNT(*) AS traceback_count,
      SUM(CASE WHEN handled_status = 'pending' THEN 1 ELSE 0 END) AS pending_traceback_count,
      SUM(CASE WHEN handled_status = 'resolved' THEN 1 ELSE 0 END) AS resolved_traceback_count,
      SUM(CASE WHEN trace_type = 'duplicate' THEN 1 ELSE 0 END) AS duplicate_traceback_count,
      SUM(CASE WHEN trace_type = 'parse_failed' THEN 1 ELSE 0 END) AS parse_failed_traceback_count,
      SUM(CASE WHEN trace_type = 'import_failed' THEN 1 ELSE 0 END) AS import_failed_traceback_count,
      SUM(CASE WHEN trace_type = 'published_incorrect' THEN 1 ELSE 0 END) AS published_incorrect_traceback_count,
      SUM(CASE WHEN trace_type = 'manual_reject' THEN 1 ELSE 0 END) AS manual_reject_traceback_count
    FROM announcement_staging_tracebacks
  `);



  const row = rows[0] || {};
  const tracebackRow = tracebackRows[0] || {};
  const jsonFileCount = directoryInfo.file_names.length;
  const stagingBatchCount = Number(row.staging_batch_count || 0);
  const pendingBatchCount = Number(row.pending_batch_count || 0);
  const confirmedBatchCount = Number(row.confirmed_batch_count || 0);

  const importTotalCount = stagingBatchCount + jsonFileCount;

  return {
    source_dir: directoryInfo.source_dir,
    json_file_count: jsonFileCount,
    staging_batch_count: stagingBatchCount,
    pending_batch_count: pendingBatchCount,
    confirmed_batch_count: confirmedBatchCount,
    sampling_batch_count: Number(row.sampling_batch_count || 0),
    flight_batch_count: Number(row.flight_batch_count || 0),
    cosmetics_batch_count: Number(row.cosmetics_batch_count || 0),
    food_batch_count: Number(row.food_batch_count || 0),
    medical_device_batch_count: Number(row.medical_device_batch_count || 0),
    unimported_json_count: jsonFileCount,
    import_total_count: importTotalCount,
    total_detail_count: Number(row.total_detail_count || 0),
    total_counterfeit_count: Number(row.total_counterfeit_count || 0),
    pending_detail_count: Number(row.pending_detail_count || 0),
    confirmed_detail_count: Number(row.confirmed_detail_count || 0),
    pending_counterfeit_count: Number(row.pending_counterfeit_count || 0),
    confirmed_counterfeit_count: Number(row.confirmed_counterfeit_count || 0),
    traceback_count: Number(tracebackRow.traceback_count || 0),
    pending_traceback_count: Number(tracebackRow.pending_traceback_count || 0),
    resolved_traceback_count: Number(tracebackRow.resolved_traceback_count || 0),
    duplicate_traceback_count: Number(tracebackRow.duplicate_traceback_count || 0),
    parse_failed_traceback_count: Number(tracebackRow.parse_failed_traceback_count || 0),
    import_failed_traceback_count: Number(tracebackRow.import_failed_traceback_count || 0),
    published_incorrect_traceback_count: Number(tracebackRow.published_incorrect_traceback_count || 0),
    manual_reject_traceback_count: Number(tracebackRow.manual_reject_traceback_count || 0),
    import_progress_percent: calculateProgressPercent(stagingBatchCount, importTotalCount),

    publish_progress_percent: calculateProgressPercent(confirmedBatchCount, stagingBatchCount),
    last_imported_at: row.last_imported_at || null,
    last_confirmed_at: row.last_confirmed_at || null
  };
}



async function resolvePublishedAnnouncementId(connection, batch) {
  if (batch.published_announcement_id) {
    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE id = ? LIMIT 1',
      [batch.published_announcement_id]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.source_detail_url) {
    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE source_detail_url = ? ORDER BY id DESC LIMIT 1',
      [batch.source_detail_url]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.source_json_file) {
    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE source_json_file = ? ORDER BY id DESC LIMIT 1',
      [batch.source_json_file]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.announcement_no) {
    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE announcement_no = ? ORDER BY id DESC LIMIT 1',
      [batch.announcement_no]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.title) {
    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE title = ? ORDER BY id DESC LIMIT 1',
      [batch.title]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  return null;
}

async function resolvePublishedSupervisionId(connection, batch) {
  if (batch.published_supervision_id) {
    const [rows] = await connection.query(
      'SELECT id FROM supervisions WHERE id = ? LIMIT 1',
      [batch.published_supervision_id]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.source_detail_url) {
    const [rows] = await connection.query(
      'SELECT id FROM supervisions WHERE source_detail_url = ? ORDER BY id DESC LIMIT 1',
      [batch.source_detail_url]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.source_json_file) {
    const [rows] = await connection.query(
      'SELECT id FROM supervisions WHERE source_json_file = ? ORDER BY id DESC LIMIT 1',
      [batch.source_json_file]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  if (batch.title) {
    const [rows] = await connection.query(
      'SELECT id FROM supervisions WHERE title = ? ORDER BY id DESC LIMIT 1',
      [batch.title]
    );
    if (rows.length > 0) {
      return Number(rows[0].id);
    }
  }

  return null;
}


async function refreshPublishedAnnouncementInspectionCount(connection, announcementId, fallbackInspectionCount = 0) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM announcement_product_details WHERE announcement_id = ?',
    [announcementId]
  );
  const detailCount = Number(rows[0]?.total || 0);
  const inspectionCount = detailCount > 0 ? detailCount : normalizeInspectionCount(fallbackInspectionCount, 0);

  await connection.query(
    'UPDATE announcements SET inspection_count = ? WHERE id = ?',
    [inspectionCount, announcementId]
  );

  return inspectionCount;
}

async function syncPublishedAnnouncementDerivedData(connection, announcementId, fallbackInspectionCount = 0) {
  const [announcementRows] = await connection.query(
    'SELECT publish_date FROM announcements WHERE id = ? LIMIT 1',
    [announcementId]
  );
  const publishDate = announcementRows[0]?.publish_date || null;

  const companySyncResult = await syncCompaniesFromAnnouncementDetails(connection, announcementId, publishDate);
  const inspectionSyncResult = await syncInspectionsFromAnnouncementDetails(connection, announcementId);
  const unqualifiedSyncResult = await replaceUnqualifiedProductsFromAnnouncementDetails(connection, announcementId);
  const inspectionCount = await refreshPublishedAnnouncementInspectionCount(connection, announcementId, fallbackInspectionCount);

  return {
    companySyncResult,
    inspectionSyncResult,
    unqualifiedSyncResult,
    inspectionCount
  };
}


function buildFlightInspectionSummary(items = []) {
  const rows = Array.isArray(items) ? items : [];
  const firstRow = rows[0] || {};
  const uniqueCompanyNames = Array.from(new Set(rows.map((item) => normalizeText(item.company_name)).filter(Boolean)));
  const uniqueInspectionUnits = Array.from(new Set(rows.map((item) => normalizeText(item.inspection_unit)).filter(Boolean)));
  const combinedDefects = rows
    .map((item) => {
      const companyName = normalizeText(item.company_name) || normalizeText(item.title) || `企业${item.sequence_no || ''}`;
      const defects = normalizeMultilineText(item.defects_and_problems);
      return defects ? `${companyName}：${defects}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
  const combinedMeasures = rows
    .map((item) => {
      const companyName = normalizeText(item.company_name) || normalizeText(item.title) || `企业${item.sequence_no || ''}`;
      const measures = normalizeMultilineText(item.handling_measures);
      return measures ? `${companyName}：${measures}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
  const combinedRawText = rows.map((item) => item.raw_text).filter(Boolean).join('\n\n====================\n\n') || null;

  return {
    firstRow,
    company_name: uniqueCompanyNames.length <= 1
      ? (uniqueCompanyNames[0] || firstRow.company_name || null)
      : `${uniqueCompanyNames[0]}等${uniqueCompanyNames.length}家企业`,
    company_count: uniqueCompanyNames.length,
    inspection_unit: uniqueInspectionUnits.length <= 1
      ? (uniqueInspectionUnits[0] || firstRow.inspection_unit || null)
      : uniqueInspectionUnits.join('；'),
    inspection_basis: normalizeNullableMultilineText(firstRow.inspection_basis),
    defects_and_problems: normalizeNullableMultilineText(combinedDefects || firstRow.defects_and_problems),
    handling_measures: normalizeNullableMultilineText(combinedMeasures || firstRow.handling_measures),
    publish_date: firstRow.publish_date || null,
    content: combinedRawText || firstRow.raw_text || null,
    production_license_no: firstRow.production_license_no || null,
    company_address: firstRow.company_address || null
  };
}

async function replaceSupervisionAttachments(connection, supervisionId, attachments = []) {
  await ensureSupervisionAttachmentsTable(connection);
  await connection.query('DELETE FROM supervision_attachments WHERE supervision_id = ?', [supervisionId]);

  if (!attachments.length) {
    return;
  }

  for (const attachment of attachments) {
    await connection.query(
      `
        INSERT INTO supervision_attachments (
          supervision_id, attachment_name, attachment_path, attachment_type,
          sort_order, parse_supported, parse_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        supervisionId,
        attachment.attachment_name || '附件',
        attachment.local_path || attachment.attachment_url || '',
        attachment.attachment_type || attachment.file_ext || null,
        attachment.index || 0,
        attachment.supported ? 1 : 0,
        attachment.parse_message || null
      ]
    );
  }
}

async function publishSamplingStagingBatch(connection, detail) {
  const { batch, items, attachments } = detail;
  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const finalInspectionCount = items.length > 0 ? items.length : Number(batch.inspection_count || 0);
  const targetAnnouncementId = await resolvePublishedAnnouncementId(connection, batch);

  let announcementId = targetAnnouncementId;
  let publishAction = 'created';
  let existingAnnouncement = null;

  if (announcementId) {
    const [existingRows] = await connection.query(
      'SELECT * FROM announcements WHERE id = ? LIMIT 1',
      [announcementId]
    );
    existingAnnouncement = existingRows[0] || null;
  }

  if (existingAnnouncement) {
    await connection.query(
      `
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            inspection_unit = ?, inspection_count = ?, attachment_path = ?, attachment_name = ?,
            product_type = ?, announcement_type = ?, source_detail_url = ?, source_page = ?, source_json_file = ?, status = 'published'
        WHERE id = ?
      `,
      [
        batch.title,
        batch.content,
        batch.announcement_no,
        batch.publish_date,
        batch.inspection_unit,
        finalInspectionCount,
        existingAnnouncement.attachment_path || batch.primary_attachment_path || null,
        existingAnnouncement.attachment_name || batch.primary_attachment_name || null,
        typeInfo.product_type,
        typeInfo.announcement_type,
        batch.source_detail_url || null,
        batch.source_page || null,
        batch.source_json_file || null,
        announcementId
      ]
    );

    publishAction = 'updated';
  } else {
    const [result] = await connection.query(
      `
        INSERT INTO announcements (
          title,
          content,
          announcement_no,
          publish_date,
          inspection_unit,
          inspection_count,
          attachment_path,
          attachment_name,
          product_type,
          announcement_type,
          source_detail_url,
          source_page,
          source_json_file,
          status,
          author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', NULL)
      `,
      [
        batch.title,
        batch.content,
        batch.announcement_no,
        batch.publish_date,
        batch.inspection_unit,
        finalInspectionCount,
        batch.primary_attachment_path || null,
        batch.primary_attachment_name,
        typeInfo.product_type,
        typeInfo.announcement_type,
        batch.source_detail_url || null,
        batch.source_page || null,
        batch.source_json_file || null
      ]
    );

    announcementId = result.insertId;
  }

  await replaceAnnouncementProductDetails(connection, announcementId, items);
  const syncResult = await syncPublishedAnnouncementDerivedData(connection, announcementId, finalInspectionCount);
  if (typeInfo.product_type === 'food' && batch.source_detail_url) {
    await linkFoodInspectionToPublishedAnnouncement(connection, batch.source_detail_url, announcementId, batch.id);
  }

  const [publishedRows] = await connection.query(
    'SELECT * FROM announcements WHERE id = ? LIMIT 1',
    [announcementId]
  );
  const publishedAnnouncement = publishedRows[0] || null;

  await connection.query(
    `
      INSERT INTO announcement_publish_backups (
        staging_batch_id,
        announcement_id,
        supervision_id,
        title,
        announcement_no,
        publish_date,
        inspection_unit,
        inspection_count,
        detail_count,
        primary_attachment_name,
        primary_attachment_path,
        product_type,
        announcement_type,
        source_detail_url,
        source_page,
        source_json_file,
        payload_json
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batch.id,
      announcementId,
      batch.title,
      batch.announcement_no,
      batch.publish_date,
      batch.inspection_unit,
      syncResult.inspectionCount,
      items.length,
      batch.primary_attachment_name,
      batch.primary_attachment_path,
      typeInfo.product_type,
      typeInfo.announcement_type,
      batch.source_detail_url || null,
      batch.source_page || null,
      batch.source_json_file || null,
      JSON.stringify({
        staging_batch: batch,
        published_announcement: publishedAnnouncement,
        attachments,
        items
      })
    ]
  );


  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET status = 'confirmed', published_announcement_id = ?, published_supervision_id = NULL, confirmed_at = NOW()
      WHERE id = ?
    `,
    [announcementId, batch.id]
  );

  const stagingCleanupResult = await deletePublishedStagingTemporaryRows(connection, batch.id);

  return {
    staging_batch_id: Number(batch.id),
    announcement_id: Number(announcementId),
    supervision_id: null,
    action: publishAction,
    inspection_count: syncResult.inspectionCount,
    synced_company_count: Number(syncResult.companySyncResult?.company_count || 0),
    synced_unqualified_count: Number(syncResult.unqualifiedSyncResult?.synced_count || 0),
    detail_count: items.length,
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    published_target: 'announcements',
    ...stagingCleanupResult
  };
}

async function publishFlightInspectionStagingBatch(connection, detail) {
  const { batch, items, attachments } = detail;
  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const summary = buildFlightInspectionSummary(items);
  const targetSupervisionId = await resolvePublishedSupervisionId(connection, batch);

  const payload = {
    title: batch.title,
    company_name: summary.company_name || null,
    production_license_no: summary.production_license_no || null,
    company_address: summary.company_address || null,
    supervision_date: batch.publish_date || summary.publish_date || null,
    publish_date: batch.publish_date || summary.publish_date || null,
    supervision_unit: batch.inspection_unit || summary.inspection_unit || null,
    inspection_basis: summary.inspection_basis || null,
    defects_and_problems: summary.defects_and_problems || null,
    handling_measures: summary.handling_measures || null,
    attachment_path: batch.primary_attachment_path || null,
    attachment_name: batch.primary_attachment_name || null,
    region: null,
    level: 'national',
    supervision_type: '飞行检查',
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    source_detail_url: batch.source_detail_url || null,
    source_page: batch.source_page || null,
    source_json_file: batch.source_json_file || null,
    content: batch.content || summary.content || null,
    rectification_deadline: null,
    status: 'ongoing',
    source: '临时导入'
  };


  let supervisionId = targetSupervisionId;
  let publishAction = 'created';
  let existingSupervision = null;

  if (supervisionId) {
    const [existingRows] = await connection.query(
      'SELECT * FROM supervisions WHERE id = ? LIMIT 1',
      [supervisionId]
    );
    existingSupervision = existingRows[0] || null;
  }

  if (existingSupervision) {
    await connection.query(
      `
        UPDATE supervisions
        SET title = ?, company_name = ?, production_license_no = ?, company_address = ?,
            supervision_date = ?, publish_date = ?, supervision_unit = ?, inspection_basis = ?,
            defects_and_problems = ?, handling_measures = ?, attachment_path = ?, attachment_name = ?,
            region = ?, level = ?, supervision_type = ?, product_type = ?, announcement_type = ?,
            source_detail_url = ?, source_page = ?, source_json_file = ?,
            content = ?, rectification_deadline = ?, status = ?, source = ?
        WHERE id = ?
      `,
      [
        payload.title,
        payload.company_name,
        payload.production_license_no,
        payload.company_address,
        payload.supervision_date,
        payload.publish_date,
        payload.supervision_unit,
        payload.inspection_basis,
        payload.defects_and_problems,
        payload.handling_measures,
        payload.attachment_path,
        payload.attachment_name,
        payload.region,
        payload.level,
        payload.supervision_type,
        payload.product_type,
        payload.announcement_type,
        payload.source_detail_url,
        payload.source_page,
        payload.source_json_file,
        payload.content,
        payload.rectification_deadline,
        payload.status,
        payload.source,
        supervisionId
      ]
    );

    publishAction = 'updated';
  } else {
    const [result] = await connection.query(
      `
        INSERT INTO supervisions (
          title, company_name, production_license_no, company_address,
          supervision_date, publish_date, supervision_unit, inspection_basis,
          defects_and_problems, handling_measures, attachment_path, attachment_name,
          region, level, supervision_type, product_type, announcement_type,
          source_detail_url, source_page, source_json_file,
          content, rectification_deadline, status, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payload.title,
        payload.company_name,
        payload.production_license_no,
        payload.company_address,
        payload.supervision_date,
        payload.publish_date,
        payload.supervision_unit,
        payload.inspection_basis,
        payload.defects_and_problems,
        payload.handling_measures,
        payload.attachment_path,
        payload.attachment_name,
        payload.region,
        payload.level,
        payload.supervision_type,
        payload.product_type,
        payload.announcement_type,
        payload.source_detail_url,
        payload.source_page,
        payload.source_json_file,
        payload.content,
        payload.rectification_deadline,
        payload.status,
        payload.source
      ]
    );

    supervisionId = result.insertId;
  }

  await replaceFlightInspectionDetails(connection, supervisionId, items);
  await replaceSupervisionAttachments(connection, supervisionId, attachments);
  const companySyncResult = await syncCompaniesFromFlightInspectionDetails(connection, supervisionId);
  const unqualifiedSyncResult = await replaceUnqualifiedProductsFromFlightInspectionDetails(connection, supervisionId);

  const [publishedRows] = await connection.query(
    'SELECT * FROM supervisions WHERE id = ? LIMIT 1',
    [supervisionId]
  );
  const publishedSupervision = publishedRows[0] || null;

  await connection.query(
    `
      INSERT INTO announcement_publish_backups (
        staging_batch_id,
        announcement_id,
        supervision_id,
        title,
        announcement_no,
        publish_date,
        inspection_unit,
        inspection_count,
        detail_count,
        primary_attachment_name,
        primary_attachment_path,
        product_type,
        announcement_type,
        source_detail_url,
        source_page,
        source_json_file,
        payload_json
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      batch.id,
      supervisionId,
      batch.title,
      batch.announcement_no,
      batch.publish_date,
      payload.supervision_unit,
      items.length,
      items.length,
      batch.primary_attachment_name,
      batch.primary_attachment_path,
      typeInfo.product_type,
      typeInfo.announcement_type,
      batch.source_detail_url || null,
      batch.source_page || null,
      batch.source_json_file || null,
      JSON.stringify({
        staging_batch: batch,
        published_supervision: publishedSupervision,
        attachments,
        items
      })
    ]
  );


  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET status = 'confirmed', published_announcement_id = NULL, published_supervision_id = ?, confirmed_at = NOW()
      WHERE id = ?
    `,
    [supervisionId, batch.id]
  );

  const stagingCleanupResult = await deletePublishedStagingTemporaryRows(connection, batch.id);

  return {
    staging_batch_id: Number(batch.id),
    announcement_id: null,
    supervision_id: Number(supervisionId),
    action: publishAction,
    inspection_count: items.length,
    synced_company_count: Number(companySyncResult?.company_count || 0),
    synced_unqualified_count: Number(unqualifiedSyncResult?.synced_count || 0),
    detail_count: items.length,
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    published_target: 'supervisions',
    ...stagingCleanupResult
  };
}

async function publishAnnouncementStagingBatch(connection, stagingBatchId) {
  await ensureAnnouncementStagingSchema(connection);

  const detail = await getAnnouncementStagingDetail(connection, stagingBatchId);
  if (!detail) {
    throw new Error('待确认批次不存在');
  }

  const typeInfo = getBatchTypeInfo(detail.batch, parseJsonSafely(detail.batch.raw_payload, {}));
  if (typeInfo.announcement_type === 'flight_inspection') {
    return publishFlightInspectionStagingBatch(connection, detail);
  }

  return publishSamplingStagingBatch(connection, detail);
}

async function deletePublishedStagingTemporaryRows(connection, stagingBatchId) {
  const [itemDeleteResult] = await connection.query(
    'DELETE FROM announcement_staging_items WHERE staging_batch_id = ?',
    [stagingBatchId]
  );
  const [batchDeleteResult] = await connection.query(
    'DELETE FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );

  return {
    deleted_staging_batch_count: Number(batchDeleteResult?.affectedRows || 0),
    deleted_staging_item_count: Number(itemDeleteResult?.affectedRows || 0)
  };
}

async function deleteAnnouncementStagingBatch(connection, stagingBatchId) {
  await ensureAnnouncementStagingSchema(connection);

  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }

  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const shouldDeletePublished = Boolean(
    batch.status === 'confirmed'
      || batch.published_announcement_id
      || batch.published_supervision_id
  );

  let publishedDeleteResult = null;
  if (shouldDeletePublished) {
    publishedDeleteResult = await deletePublishedAnnouncementStagingBatch(connection, stagingBatchId);
  }

  const [deleteResult] = await connection.query(
    'DELETE FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );

  return {
    staging_batch_id: Number(stagingBatchId),
    deleted_batch_count: Number(deleteResult?.affectedRows || 0),
    deleted_published: Boolean(publishedDeleteResult),
    deleted_published_id: publishedDeleteResult?.deleted_published_id || null,
    deleted_backup_count: Number(publishedDeleteResult?.deleted_backup_count || 0),
    deleted_company_count: Number(publishedDeleteResult?.deleted_company_count || 0),
    published_target: typeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements'
  };
}

async function deletePublishedAnnouncementStagingBatch(connection, stagingBatchId) {

  await ensureAnnouncementStagingSchema(connection);

  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }

  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  let deletedPublishedId = null;
  let deletedCompanyCount = 0;

  if (typeInfo.announcement_type === 'flight_inspection') {
    const supervisionId = await resolvePublishedSupervisionId(connection, batch);

    if (!supervisionId && batch.status !== 'confirmed') {
      throw new Error('该批次尚未导入正式库，无需删除');
    }

    if (supervisionId) {
      const relatedCompanyIds = await getSupervisionRelatedCompanyIds(connection, supervisionId);
      await connection.query('DELETE FROM company_supervision_records WHERE supervision_id = ?', [supervisionId]);
      await connection.query('DELETE FROM flight_inspection_detail WHERE supervision_id = ?', [supervisionId]);
      await connection.query('DELETE FROM supervision_attachments WHERE supervision_id = ?', [supervisionId]);
      await connection.query('DELETE FROM supervisions WHERE id = ?', [supervisionId]);
      const cleanupResult = await deleteOrphanCompanies(connection, relatedCompanyIds);
      deletedCompanyCount = Number(cleanupResult?.deleted_count || 0);
      deletedPublishedId = Number(supervisionId);
    }
  } else {
    const announcementId = await resolvePublishedAnnouncementId(connection, batch);

    if (!announcementId && batch.status !== 'confirmed') {
      throw new Error('该批次尚未导入正式库，无需删除');
    }

    if (announcementId) {
      await removeAnnouncementCompanySampling(connection, announcementId);
      await connection.query('DELETE FROM inspection_details WHERE inspection_id IN (SELECT id FROM inspections WHERE announcement_id = ?)', [announcementId]);
      await connection.query('DELETE FROM inspections WHERE announcement_id = ?', [announcementId]);
      await connection.query('DELETE FROM unqualified_products WHERE announcement_id = ?', [announcementId]);
      await connection.query('DELETE FROM announcements WHERE id = ?', [announcementId]);
      deletedPublishedId = Number(announcementId);
    }
  }

  const [backupResult] = await connection.query(
    'DELETE FROM announcement_publish_backups WHERE staging_batch_id = ?',
    [stagingBatchId]
  );

  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET status = 'pending', published_announcement_id = NULL, published_supervision_id = NULL, confirmed_at = NULL
      WHERE id = ?
    `,
    [stagingBatchId]
  );

  return {
    staging_batch_id: Number(stagingBatchId),
    deleted_published_id: deletedPublishedId,
    deleted_backup_count: Number(backupResult?.affectedRows || 0),
    deleted_company_count: deletedCompanyCount,
    published_target: typeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements',
    restored_status: 'pending'
  };
}

function buildUpdatedRawPayloadContent(rawPayloadText, nextContent) {
  const rawPayload = parseJsonSafely(rawPayloadText, {});
  if (!rawPayload || typeof rawPayload !== 'object') {
    return rawPayloadText || null;
  }

  return JSON.stringify({
    ...rawPayload,
    content: nextContent,
    content_text: nextContent,
    content_preview: nextContent
  });
}

function buildUpdatedRawPayloadProductType(rawPayloadText, nextProductType, announcementType) {
  const rawPayload = parseJsonSafely(rawPayloadText, {});
  if (!rawPayload || typeof rawPayload !== 'object') {
    return rawPayloadText || null;
  }

  const typeInfo = resolveTypeInfo(nextProductType, announcementType);

  return JSON.stringify({
    ...rawPayload,
    product_type: typeInfo.product_type,
    announcement_type: typeInfo.announcement_type,
    _import_meta: {
      ...(rawPayload._import_meta || {}),
      product_type: typeInfo.product_type,
      announcement_type: typeInfo.announcement_type,
      product_type_label: typeInfo.product_type_label,
      announcement_type_label: typeInfo.announcement_type_label
    }
  });
}

async function updatePublishedAnnouncementStagingBody(connection, stagingBatchId, content) {

  await ensureAnnouncementStagingSchema(connection);

  const normalizedContent = normalizeNullableMultilineText(content);
  if (!normalizedContent) {
    throw new Error('通告正文不能为空');
  }

  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }

  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const nextRawPayload = buildUpdatedRawPayloadContent(batch.raw_payload, normalizedContent);

  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET content = ?, raw_payload = ?
      WHERE id = ?
    `,
    [normalizedContent, nextRawPayload, stagingBatchId]
  );

  let updatedPublishedId = null;
  if (typeInfo.announcement_type === 'flight_inspection') {
    const supervisionId = await resolvePublishedSupervisionId(connection, batch);
    if (supervisionId) {
      await connection.query(
        'UPDATE supervisions SET content = ? WHERE id = ?',
        [normalizedContent, supervisionId]
      );
      updatedPublishedId = Number(supervisionId);
    }
  } else {
    const announcementId = await resolvePublishedAnnouncementId(connection, batch);
    if (announcementId) {
      await connection.query(
        'UPDATE announcements SET content = ? WHERE id = ?',
        [normalizedContent, announcementId]
      );
      updatedPublishedId = Number(announcementId);
    }
  }

  const [backupRows] = await connection.query(
    `
      SELECT id, payload_json
      FROM announcement_publish_backups
      WHERE staging_batch_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [stagingBatchId]
  );

  if (backupRows[0]) {
    const backupPayload = parseJsonSafely(backupRows[0].payload_json, {});
    const nextBackupPayload = {
      ...(backupPayload && typeof backupPayload === 'object' ? backupPayload : {}),
      staging_batch: {
        ...(backupPayload?.staging_batch || {}),
        content: normalizedContent
      },
      published_announcement: backupPayload?.published_announcement
        ? {
            ...backupPayload.published_announcement,
            content: normalizedContent
          }
        : backupPayload?.published_announcement,
      published_supervision: backupPayload?.published_supervision
        ? {
            ...backupPayload.published_supervision,
            content: normalizedContent
          }
        : backupPayload?.published_supervision
    };

    await connection.query(
      'UPDATE announcement_publish_backups SET payload_json = ? WHERE id = ?',
      [JSON.stringify(nextBackupPayload), backupRows[0].id]
    );
  }

  return {
    staging_batch_id: Number(stagingBatchId),
    updated_content: normalizedContent,
    updated_published_id: updatedPublishedId,
    published_target: typeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements'
  };
}

async function syncPublishedTablesAfterStagingTypeChange(
  connection,
  batchSnapshot,
  stagingBatchId,
  nextTypeInfo,
  nextRawPayloadText,
  skipBackupUpdate = false
) {
  let updatedPublishedId = null;
  let syncResult = null;

  if (nextTypeInfo.announcement_type === 'flight_inspection') {
    const supervisionId = await resolvePublishedSupervisionId(connection, batchSnapshot);
    if (supervisionId) {
      const previousCompanyIds = await getSupervisionRelatedCompanyIds(connection, supervisionId);
      await connection.query('UPDATE supervisions SET product_type = ? WHERE id = ?', [nextTypeInfo.product_type, supervisionId]);
      const unqualifiedSyncResult = await replaceUnqualifiedProductsFromFlightInspectionDetails(connection, supervisionId);
      const companySyncResult = await syncCompaniesFromFlightInspectionDetails(connection, supervisionId);
      await deleteOrphanCompanies(connection, previousCompanyIds);
      updatedPublishedId = Number(supervisionId);
      syncResult = {
        companySyncResult,
        unqualifiedSyncResult,
        inspectionCount: null
      };
    }
  } else {
    const announcementId = await resolvePublishedAnnouncementId(connection, batchSnapshot);
    if (announcementId) {
      await connection.query('UPDATE announcements SET product_type = ? WHERE id = ?', [nextTypeInfo.product_type, announcementId]);
      syncResult = await syncPublishedAnnouncementDerivedData(connection, announcementId);
      updatedPublishedId = Number(announcementId);
    }
  }

  const [backupRows] = await connection.query(
    `
      SELECT id, payload_json
      FROM announcement_publish_backups
      WHERE staging_batch_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [stagingBatchId]
  );

  if (!skipBackupUpdate && backupRows[0]) {
    const backupPayload = parseJsonSafely(backupRows[0].payload_json, {});
    const nextBackupPayload = {
      ...(backupPayload && typeof backupPayload === 'object' ? backupPayload : {}),
      staging_batch: backupPayload?.staging_batch
        ? {
            ...backupPayload.staging_batch,
            product_type: nextTypeInfo.product_type,
            announcement_type: nextTypeInfo.announcement_type,
            raw_payload: nextRawPayloadText
          }
        : backupPayload?.staging_batch,
      published_announcement: backupPayload?.published_announcement
        ? {
            ...backupPayload.published_announcement,
            product_type: nextTypeInfo.product_type,
            announcement_type: nextTypeInfo.announcement_type
          }
        : backupPayload?.published_announcement,
      published_supervision: backupPayload?.published_supervision
        ? {
            ...backupPayload.published_supervision,
            product_type: nextTypeInfo.product_type,
            announcement_type: nextTypeInfo.announcement_type
          }
        : backupPayload?.published_supervision
    };

    await connection.query(
      'UPDATE announcement_publish_backups SET product_type = ?, announcement_type = ?, payload_json = ? WHERE id = ?',
      [nextTypeInfo.product_type, nextTypeInfo.announcement_type, JSON.stringify(nextBackupPayload), backupRows[0].id]
    );
  }

  return {
    updatedPublishedId,
    syncResult
  };
}

async function updateAnnouncementStagingProductType(connection, stagingBatchId, options = {}) {
  await ensureAnnouncementStagingSchema(connection);

  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }

  const rawPayload = parseJsonSafely(batch.raw_payload, {});
  const currentTypeInfo = getBatchTypeInfo(batch, rawPayload);

  const hasProductInput = Object.prototype.hasOwnProperty.call(options, 'product_type');
  const hasAnnouncementInput = Object.prototype.hasOwnProperty.call(options, 'announcement_type');

  const productTypeForResolve = hasProductInput ? options.product_type : batch.product_type;
  const announcementTypeForResolve = hasAnnouncementInput
    ? options.announcement_type
    : currentTypeInfo.announcement_type;

  const nextTypeInfo = resolveTypeInfo(productTypeForResolve, announcementTypeForResolve);

  const supervisionId = await resolvePublishedSupervisionId(connection, batch);
  const announcementId = await resolvePublishedAnnouncementId(connection, batch);
  const isPublished = Boolean(supervisionId || announcementId);

  if (isPublished && currentTypeInfo.announcement_type !== nextTypeInfo.announcement_type) {
    throw new Error('已入库的通告不能切换「抽检 / 飞检」类型，请先删除正式库记录或使用打回流程');
  }

  const nextRawPayload = buildUpdatedRawPayloadProductType(
    batch.raw_payload,
    nextTypeInfo.product_type,
    nextTypeInfo.announcement_type
  );

  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET product_type = ?, announcement_type = ?, raw_payload = ?
      WHERE id = ?
    `,
    [nextTypeInfo.product_type, nextTypeInfo.announcement_type, nextRawPayload, stagingBatchId]
  );

  const { updatedPublishedId, syncResult } = await syncPublishedTablesAfterStagingTypeChange(
    connection,
    batch,
    stagingBatchId,
    nextTypeInfo,
    nextRawPayload
  );

  return {
    staging_batch_id: Number(stagingBatchId),
    product_type: nextTypeInfo.product_type,
    product_type_label: nextTypeInfo.product_type_label,
    announcement_type: nextTypeInfo.announcement_type,
    announcement_type_label: nextTypeInfo.announcement_type_label,
    updated_published_id: updatedPublishedId,
    published_target: nextTypeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements',
    synced_company_count: Number(syncResult?.companySyncResult?.company_count || 0),
    synced_unqualified_count: Number(syncResult?.unqualifiedSyncResult?.synced_count || 0),
    inspection_count: syncResult?.inspectionCount === null || syncResult?.inspectionCount === undefined
      ? null
      : Number(syncResult.inspectionCount)
  };
}

function buildUpdatedRawPayloadInfo(rawPayloadText, patch = {}) {
  const rawPayload = parseJsonSafely(rawPayloadText, {});
  if (!rawPayload || typeof rawPayload !== 'object') {
    return rawPayloadText || null;
  }

  return JSON.stringify({
    ...rawPayload,
    title: patch.title,
    announcement_no: patch.announcement_no,
    publish_date: patch.publish_date,
    inspection_unit: patch.inspection_unit,
    detail_url: patch.source_detail_url,
    source_detail_url: patch.source_detail_url,
    source_page: patch.source_page,
    attachments: Array.isArray(rawPayload.attachments)
      ? rawPayload.attachments.map((attachment, index) => (
          index === 0
            ? {
                ...attachment,
                attachment_name: patch.primary_attachment_name || attachment.attachment_name,
                local_path: patch.primary_attachment_path || attachment.local_path
              }
            : attachment
        ))
      : rawPayload.attachments
  });
}

async function updateAnnouncementStagingInfo(connection, stagingBatchId, payload = {}) {
  await ensureAnnouncementStagingSchema(connection);

  const [rows] = await connection.query(
    'SELECT * FROM announcement_staging_batches WHERE id = ? LIMIT 1',
    [stagingBatchId]
  );
  const batch = rows[0] || null;
  if (!batch) {
    throw new Error('待确认批次不存在');
  }

  const rawPayloadSnapshot = parseJsonSafely(batch.raw_payload, {});
  const originalTypeInfo = getBatchTypeInfo(batch, rawPayloadSnapshot);

  const typeFieldsInPayload =
    Object.prototype.hasOwnProperty.call(payload, 'product_type')
    || Object.prototype.hasOwnProperty.call(payload, 'announcement_type');

  const nextTypeInfo = typeFieldsInPayload
    ? resolveTypeInfo(
        Object.prototype.hasOwnProperty.call(payload, 'product_type')
          ? payload.product_type
          : batch.product_type,
        Object.prototype.hasOwnProperty.call(payload, 'announcement_type')
          ? payload.announcement_type
          : originalTypeInfo.announcement_type
      )
    : originalTypeInfo;

  const supervisionIdProbe = await resolvePublishedSupervisionId(connection, batch);
  const announcementIdProbe = await resolvePublishedAnnouncementId(connection, batch);
  const isPublished = Boolean(supervisionIdProbe || announcementIdProbe);

  if (isPublished && originalTypeInfo.announcement_type !== nextTypeInfo.announcement_type) {
    throw new Error('已入库的通告不能切换「抽检 / 飞检」类型，请先删除正式库记录或使用打回流程');
  }

  const typeFieldsChanged =
    originalTypeInfo.product_type !== nextTypeInfo.product_type
    || originalTypeInfo.announcement_type !== nextTypeInfo.announcement_type;

  const patch = {
    title: normalizeNullableText(payload.title) || batch.title,
    announcement_no: normalizeNullableText(payload.announcement_no),
    publish_date: normalizeDateValue(payload.publish_date),
    inspection_unit: normalizeNullableText(payload.inspection_unit),
    primary_attachment_name: normalizeNullableText(payload.primary_attachment_name),
    primary_attachment_path: normalizeNullableText(payload.primary_attachment_path),
    source_detail_url: normalizeNullableText(payload.source_detail_url),
    source_page: normalizeNullableText(payload.source_page)
  };

  let nextRawPayloadStr = buildUpdatedRawPayloadInfo(batch.raw_payload, patch);

  if (typeFieldsChanged) {
    nextRawPayloadStr = buildUpdatedRawPayloadProductType(
      nextRawPayloadStr,
      nextTypeInfo.product_type,
      nextTypeInfo.announcement_type
    );
  }

  await connection.query(
    `
      UPDATE announcement_staging_batches
      SET title = ?,
          announcement_no = ?,
          publish_date = ?,
          inspection_unit = ?,
          primary_attachment_name = ?,
          primary_attachment_path = ?,
          source_detail_url = ?,
          source_page = ?,
          raw_payload = ?,
          product_type = ?,
          announcement_type = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      patch.title,
      patch.announcement_no,
      patch.publish_date,
      patch.inspection_unit,
      patch.primary_attachment_name,
      patch.primary_attachment_path,
      patch.source_detail_url,
      patch.source_page,
      nextRawPayloadStr,
      nextTypeInfo.product_type,
      nextTypeInfo.announcement_type,
      stagingBatchId
    ]
  );

  let updatedPublishedId = null;
  const publishAsFlight = nextTypeInfo.announcement_type === 'flight_inspection';

  if (publishAsFlight) {
    const supervisionId = await resolvePublishedSupervisionId(connection, batch);
    if (supervisionId) {
      await connection.query(
        `
          UPDATE supervisions
          SET title = ?, supervision_date = ?, publish_date = ?, supervision_unit = ?,
              attachment_name = ?, attachment_path = ?, source_detail_url = ?, source_page = ?
          WHERE id = ?
        `,
        [
          patch.title,
          patch.publish_date,
          patch.publish_date,
          patch.inspection_unit,
          patch.primary_attachment_name,
          patch.primary_attachment_path,
          patch.source_detail_url,
          patch.source_page,
          supervisionId
        ]
      );
      updatedPublishedId = Number(supervisionId);
    }
  } else {
    const announcementId = await resolvePublishedAnnouncementId(connection, batch);
    if (announcementId) {
      await connection.query(
        `
          UPDATE announcements
          SET title = ?, announcement_no = ?, publish_date = ?, inspection_unit = ?,
              attachment_name = ?, attachment_path = ?, source_detail_url = ?, source_page = ?
          WHERE id = ?
        `,
        [
          patch.title,
          patch.announcement_no,
          patch.publish_date,
          patch.inspection_unit,
          patch.primary_attachment_name,
          patch.primary_attachment_path,
          patch.source_detail_url,
          patch.source_page,
          announcementId
        ]
      );
      updatedPublishedId = Number(announcementId);
    }
  }

  let typeDerivedPublishedId = null;
  if (typeFieldsChanged) {
    const derived = await syncPublishedTablesAfterStagingTypeChange(
      connection,
      batch,
      stagingBatchId,
      nextTypeInfo,
      nextRawPayloadStr,
      true
    );
    typeDerivedPublishedId = derived.updatedPublishedId;
  }

  const combinedPublishedId = updatedPublishedId || typeDerivedPublishedId || null;

  const [backupRows] = await connection.query(
    `
      SELECT id, payload_json
      FROM announcement_publish_backups
      WHERE staging_batch_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [stagingBatchId]
  );

  if (backupRows[0]) {
    const backupPayload = parseJsonSafely(backupRows[0].payload_json, {});
    const nextBackupPayload = {
      ...(backupPayload && typeof backupPayload === 'object' ? backupPayload : {}),
      staging_batch: {
        ...(backupPayload?.staging_batch || {}),
        ...patch,
        product_type: nextTypeInfo.product_type,
        announcement_type: nextTypeInfo.announcement_type,
        raw_payload: nextRawPayloadStr
      },
      published_announcement: backupPayload?.published_announcement
        ? {
            ...backupPayload.published_announcement,
            ...patch,
            product_type: nextTypeInfo.product_type,
            announcement_type: nextTypeInfo.announcement_type
          }
        : backupPayload?.published_announcement,
      published_supervision: backupPayload?.published_supervision
        ? {
            ...backupPayload.published_supervision,
            title: patch.title,
            supervision_date: patch.publish_date,
            publish_date: patch.publish_date,
            supervision_unit: patch.inspection_unit,
            attachment_name: patch.primary_attachment_name,
            attachment_path: patch.primary_attachment_path,
            source_detail_url: patch.source_detail_url,
            source_page: patch.source_page,
            product_type: nextTypeInfo.product_type,
            announcement_type: nextTypeInfo.announcement_type
          }
        : backupPayload?.published_supervision
    };

    await connection.query(
      'UPDATE announcement_publish_backups SET title = ?, announcement_no = ?, publish_date = ?, inspection_unit = ?, primary_attachment_name = ?, primary_attachment_path = ?, source_detail_url = ?, source_page = ?, product_type = ?, announcement_type = ?, payload_json = ? WHERE id = ?',
      [
        patch.title,
        patch.announcement_no,
        patch.publish_date,
        patch.inspection_unit,
        patch.primary_attachment_name,
        patch.primary_attachment_path,
        patch.source_detail_url,
        patch.source_page,
        nextTypeInfo.product_type,
        nextTypeInfo.announcement_type,
        JSON.stringify(nextBackupPayload),
        backupRows[0].id
      ]
    );
  }

  const detail = await getAnnouncementStagingDetail(connection, stagingBatchId);
  return {
    ...detail,
    updated_published_id: combinedPublishedId,
    published_target: nextTypeInfo.announcement_type === 'flight_inspection' ? 'supervisions' : 'announcements'
  };
}

async function movePublishedAnnouncementStagingBatchToTraceback(connection, stagingBatchId, reason = '') {

  await ensureAnnouncementStagingSchema(connection);

  const detail = await getAnnouncementStagingDetail(connection, stagingBatchId);
  if (!detail) {
    throw new Error('待确认批次不存在');
  }

  const batch = detail.batch || {};
  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const publishedId = typeInfo.announcement_type === 'flight_inspection'
    ? await resolvePublishedSupervisionId(connection, batch)
    : await resolvePublishedAnnouncementId(connection, batch);

  if (!publishedId && batch.status !== 'confirmed') {
    throw new Error('该批次尚未导入正式库，无法退至倒溯处理');
  }

  const normalizedReason = normalizeText(reason)
    || '已导入正式库后发现通告内容有误，已退回倒溯处理中心';

  const tracebackId = await upsertAnnouncementTraceback(connection, {
    trace_type: 'published_incorrect',
    batchPayload: {
      ...batch,
      product_type: typeInfo.product_type,
      announcement_type: typeInfo.announcement_type,
      parsed_detail_count: Number(detail.summary?.detail_count || batch.parsed_detail_count || 0),
      attachment_count: Number(detail.summary?.attachment_count || batch.attachment_count || 0),
      attachment_preview: detail.attachments || [],
      attachment_validation: detail.parse_validation || null
    },
    reason: normalizedReason,
    existing_batch_id: Number(batch.id),
    existing_announcement_id: null,
    existing_supervision_id: null
  });

  const deleteResult = await deletePublishedAnnouncementStagingBatch(connection, stagingBatchId);

  return {
    ...deleteResult,
    traceback_id: Number(tracebackId),
    traceback_reason: normalizedReason,
    traceback_type: 'published_incorrect'
  };
}

async function movePendingAnnouncementStagingBatchToTraceback(connection, stagingBatchId, reason = '') {
  await ensureAnnouncementStagingSchema(connection);

  const detail = await getAnnouncementStagingDetail(connection, stagingBatchId);
  if (!detail) {
    throw new Error('待确认批次不存在');
  }

  const batch = detail.batch || {};
  if (batch.status !== 'pending') {
    throw new Error('仅待确认的批次可通过核验打回进入倒溯处理');
  }

  const typeInfo = getBatchTypeInfo(batch, parseJsonSafely(batch.raw_payload, {}));
  const normalizedReason = normalizeText(reason) || '人工核验未通过，已退回倒溯处理';

  const tracebackId = await upsertAnnouncementTraceback(connection, {
    trace_type: 'manual_reject',
    batchPayload: {
      ...batch,
      product_type: typeInfo.product_type,
      announcement_type: typeInfo.announcement_type,
      parsed_detail_count: Number(detail.summary?.detail_count || batch.parsed_detail_count || 0),
      attachment_count: Number(detail.summary?.attachment_count || batch.attachment_count || 0),
      attachment_preview: detail.attachments || [],
      attachment_validation: detail.parse_validation || null
    },
    reason: normalizedReason,
    existing_batch_id: Number(batch.id),
    existing_announcement_id: null,
    existing_supervision_id: null
  });

  const deleteResult = await deleteAnnouncementStagingBatch(connection, stagingBatchId);

  return {
    ...deleteResult,
    traceback_id: Number(tracebackId),
    traceback_reason: normalizedReason,
    traceback_type: 'manual_reject'
  };
}

module.exports = {


  PROJECT_ROOT,
  DEFAULT_STAGING_SOURCE_DIR,
  DEFAULT_WORKSPACE_CACHE_KEY,
  ensureAnnouncementStagingSchema,
  importStagingFromJsonDirectory,
  importStagingFromUploadedFiles,
  getAnnouncementStagingOverview,
  getAnnouncementStagingDetail,
  createAnnouncementStagingItem,
  updateAnnouncementStagingItem,
  deleteAnnouncementStagingItem,
  resyncAnnouncementStagingItemsTable,
  publishAnnouncementStagingBatch,
  deleteAnnouncementStagingBatch,
  deletePublishedAnnouncementStagingBatch,
  updatePublishedAnnouncementStagingBody,
  updateAnnouncementStagingInfo,
  updateAnnouncementStagingProductType,

  movePublishedAnnouncementStagingBatchToTraceback,
  movePendingAnnouncementStagingBatchToTraceback,

  listAnnouncementStagingTracebacks,

  markAnnouncementStagingTracebackResolved,

  deleteAnnouncementStagingTraceback,
  getAnnouncementWorkspaceCache,

  saveAnnouncementWorkspaceCache,
  buildCompanyPreview,
  resolveTypeInfo,
  getBatchTypeInfo
};

