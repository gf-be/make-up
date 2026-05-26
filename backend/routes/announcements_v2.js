const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const {
  ensureAnnouncementProductDetailsTable,
  parseAnnouncementAttachment,
  replaceAnnouncementProductDetails,
  getAnnouncementProductDetailSummary
} = require('../utils/announcementAttachmentParser');
const {
  ensureCompaniesSamplingSchema,
  syncCompaniesFromAnnouncementDetails,
  removeAnnouncementCompanySampling
} = require('../utils/companySamplingSync');
const {
  ensureUnqualifiedProductsTable,
  replaceUnqualifiedProductsFromAnnouncementDetails,
  normalizeProductType,
  normalizeAnnouncementType
} = require('../utils/unqualifiedProducts');
const {
  ensureAnnouncementStagingSchema,
  updatePublishedAnnouncementStagingBody,
  updateAnnouncementStagingProductType
} = require('../utils/announcementStaging');
const { requireRoles } = require('../utils/auth');






// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/announcements');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF、Word或Excel文件'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 自动提取公告关键信息
function extractAnnouncementInfo(content = '') {
  const info = {
    inspection_unit: null,
    inspection_count: 0,
    inspection_date: null
  };

  // 提取检验单位
  const unitMatch = content.match(/经(.+?)等?(单位|所|中心|院)检验/);
  if (unitMatch) {
    info.inspection_unit = unitMatch[1].trim();
  }

  // 提取批次数量
  const countMatch = content.match(/(\d+)批次.*?(不符合规定|不合格|有问题)/);
  if (countMatch) {
    info.inspection_count = parseInt(countMatch[1], 10);
  }

  // 提取检验年份
  const yearMatch = content.match(/(\d{4})年.*?化妆品抽样检验/);
  if (yearMatch) {
    info.inspection_date = yearMatch[1] + '-01-01';
  }

  return info;
}

function normalizeInspectionCount(value, fallback = 0) {
  const count = parseInt(value, 10);
  return Number.isNaN(count) ? fallback : count;
}

function normalizeNullableText(value) {

  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

/** 可选 DATE：`YYYY-MM-DD` 或空 → null；非法则返回 invalid */
function coerceMysqlDateInput(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, date: null };
  }
  const s = String(value).trim();
  if (!s) return { ok: true, date: null };
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { ok: false };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false };
  }
  return { ok: true, date: m[0] };
}

function normalizeNullableMultilineText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value)
    .replace(/\u0007/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return normalized || null;
}

function buildAnnouncementLocationSummarySql() {
  return `
    (
      SELECT GROUP_CONCAT(DISTINCT location_name ORDER BY location_name SEPARATOR '、')
      FROM (
        SELECT NULLIF(TRIM(up.sampled_province), '') AS location_name
        FROM unqualified_products up
        WHERE up.announcement_id = a.id

        UNION

        SELECT NULLIF(TRIM(up.manufacturer_province), '') AS location_name
        FROM unqualified_products up
        WHERE up.announcement_id = a.id

        UNION

        SELECT NULLIF(TRIM(up.product_region), '') AS location_name
        FROM unqualified_products up
        WHERE up.announcement_id = a.id
      ) announcement_locations
      WHERE location_name IS NOT NULL
    )
  `;
}

function appendAnnouncementListFilters(queryParts, queryParams, filters = {}) {
  const normalizedStatus = String(filters.status || '').trim();
  const normalizedProductType = String(filters.productType || filters.product_type || '').trim();
  const normalizedKeyword = String(filters.keyword || '').trim();
  const normalizedLocation = String(filters.location || '').trim();
  const normalizedYear = Number.parseInt(filters.year, 10);

  if (normalizedStatus) {
    queryParts.push('a.status = ?');
    queryParams.push(normalizedStatus);
  }

  if (normalizedProductType) {
    queryParts.push('a.product_type = ?');
    queryParams.push(normalizeProductType(normalizedProductType));
  }

  if (normalizedKeyword) {
    const keywordPattern = `%${normalizedKeyword}%`;
    queryParts.push('(a.title LIKE ? OR a.content LIKE ? OR a.announcement_no LIKE ? OR a.inspection_unit LIKE ?)');
    queryParams.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
  }

  if (Number.isInteger(normalizedYear)) {
    queryParts.push('YEAR(a.publish_date) = ?');
    queryParams.push(normalizedYear);
  }

  if (normalizedLocation) {
    const locationPattern = `%${normalizedLocation}%`;
    queryParts.push(`
      EXISTS (
        SELECT 1
        FROM unqualified_products up
        WHERE up.announcement_id = a.id
          AND (
            up.sampled_province LIKE ?
            OR up.manufacturer_province LIKE ?
            OR up.product_region LIKE ?
          )
      )
    `);
    queryParams.push(locationPattern, locationPattern, locationPattern);
  }
}

function normalizeComparableText(value) {

  return String(normalizeNullableMultilineText(value) || '')
    .replace(/\s+/g, '')
    .trim();
}

function parseJsonSafely(value, fallbackValue = null) {
  if (value === undefined || value === null || value === '') {
    return fallbackValue;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
}

function isMeaningfulAnnouncementContent(content, title = '') {
  const normalizedContent = normalizeNullableMultilineText(content);
  if (!normalizedContent) {
    return false;
  }

  const comparableContent = normalizeComparableText(normalizedContent);
  const comparableTitle = normalizeComparableText(title);
  if (!comparableContent) {
    return false;
  }
  if (comparableTitle && comparableContent === comparableTitle) {
    return false;
  }

  return normalizedContent.length >= 20 || /[。；：，]/.test(normalizedContent);
}

function pickAnnouncementDisplayContent(candidates = [], title = '') {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeNullableMultilineText(candidate);
    if (isMeaningfulAnnouncementContent(normalizedCandidate, title)) {
      return normalizedCandidate;
    }
  }
  return null;
}

function loadAnnouncementSourcePayload(sourceJsonFile) {
  const normalizedPath = normalizeNullableText(sourceJsonFile);
  if (!normalizedPath) {
    return null;
  }

  const inlinePayload = parseJsonSafely(normalizedPath, null);
  if (inlinePayload) {
    return inlinePayload;
  }

  const candidatePaths = path.isAbsolute(normalizedPath)
    ? [normalizedPath]
    : [
        path.resolve(process.cwd(), normalizedPath),
        path.resolve(__dirname, '..', normalizedPath),
        path.resolve(__dirname, '..', '..', normalizedPath)
      ];

  for (const filePath of candidatePaths) {
    try {
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        continue;
      }
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const payload = parseJsonSafely(fileContent, null);
      if (payload) {
        return payload;
      }
    } catch (error) {
      console.warn('读取公告源 JSON 失败:', filePath, error.message);
    }
  }

  return null;
}

async function findAnnouncementStagingBatchId(connection, announcementId) {
  const [batchRows] = await connection.query(
    `
      SELECT id
      FROM announcement_staging_batches
      WHERE published_announcement_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [announcementId]
  );

  if (batchRows[0]?.id) {
    return Number(batchRows[0].id);
  }

  const [backupRows] = await connection.query(
    `
      SELECT staging_batch_id
      FROM announcement_publish_backups
      WHERE announcement_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [announcementId]
  );

  return backupRows[0]?.staging_batch_id ? Number(backupRows[0].staging_batch_id) : null;
}

async function resolveAnnouncementDisplayContent(connection, announcement) {
  if (!announcement) {
    return null;
  }

  const title = normalizeNullableText(announcement.title) || '';
  const existingContent = normalizeNullableMultilineText(announcement.content);
  if (isMeaningfulAnnouncementContent(existingContent, title)) {
    return existingContent;
  }

  const stagingBatchId = announcement.id ? await findAnnouncementStagingBatchId(connection, announcement.id) : null;
  if (stagingBatchId) {
    const [stagingRows] = await connection.query(
      'SELECT content, raw_payload FROM announcement_staging_batches WHERE id = ? LIMIT 1',
      [stagingBatchId]
    );
    const stagingBatch = stagingRows[0] || null;
    const stagingPayload = parseJsonSafely(stagingBatch?.raw_payload, {});
    const stagingContent = pickAnnouncementDisplayContent([
      stagingBatch?.content,
      stagingPayload?.content_text,
      stagingPayload?.content,
      stagingPayload?.content_preview,
      stagingPayload?.page_text
    ], title);
    if (stagingContent) {
      return stagingContent;
    }
  }

  if (announcement.id) {
    const [backupRows] = await connection.query(
      `
        SELECT payload_json
        FROM announcement_publish_backups
        WHERE announcement_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [announcement.id]
    );
    const backupPayload = parseJsonSafely(backupRows[0]?.payload_json, {});
    const backupStagingPayload = typeof backupPayload?.staging_batch?.raw_payload === 'string'
      ? parseJsonSafely(backupPayload.staging_batch.raw_payload, {})
      : (backupPayload?.staging_batch?.raw_payload || {});
    const backupContent = pickAnnouncementDisplayContent([
      backupPayload?.published_announcement?.content,
      backupPayload?.staging_batch?.content,
      backupStagingPayload?.content_text,
      backupStagingPayload?.content,
      backupStagingPayload?.content_preview,
      backupStagingPayload?.page_text
    ], title);
    if (backupContent) {
      return backupContent;
    }
  }

  const sourcePayload = loadAnnouncementSourcePayload(announcement.source_json_file);
  const sourceContent = pickAnnouncementDisplayContent([
    sourcePayload?.content_text,
    sourcePayload?.content,
    sourcePayload?.content_preview,
    sourcePayload?.page_text
  ], title);
  if (sourceContent) {
    return sourceContent;
  }

  if (existingContent && normalizeComparableText(existingContent) !== normalizeComparableText(title)) {
    return existingContent;
  }

  return null;
}

function deriveCounterfeitFlag(remarks, explicitValue) {

  if (explicitValue === '0' || explicitValue === 0 || explicitValue === false) {
    return 0;
  }

  if (explicitValue === '1' || explicitValue === 1 || explicitValue === true) {
    return 1;
  }

  return /假冒|真实性异议|未生产或者进口过该批次抽检不符合规定产品/.test(String(remarks || '')) ? 1 : 0;
}

function buildAnnouncementProductDetailPayload(body = {}) {
  const sequenceNo = Number.parseInt(body.sequence_no, 10);

  return {
    sequence_no: Number.isNaN(sequenceNo) ? 1 : sequenceNo,
    product_name: normalizeNullableText(body.product_name),
    company_names: normalizeNullableText(body.company_names),
    company_addresses: normalizeNullableText(body.company_addresses),
    manufacturer_name: normalizeNullableText(body.manufacturer_name || body.company_names),
    manufacturer_address: normalizeNullableText(body.manufacturer_address || body.company_addresses),
    operator_name: normalizeNullableText(body.operator_name || body.sample_unit_name),
    operator_address: normalizeNullableText(body.operator_address || body.sample_unit_address),
    sample_unit_name: normalizeNullableText(body.sample_unit_name),
    sample_unit_address: normalizeNullableText(body.sample_unit_address),
    package_spec: normalizeNullableText(body.package_spec),
    batch_no: normalizeNullableText(body.batch_no),
    production_date: normalizeNullableText(body.production_date),
    expiry_date: normalizeNullableText(body.expiry_date),
    product_region: normalizeNullableText(body.product_region),
    registration_no: normalizeNullableText(body.registration_no),
    production_license_no: normalizeNullableText(body.production_license_no),
    inspection_institution: normalizeNullableText(body.inspection_institution),
    unqualified_items: normalizeNullableText(body.unqualified_items),
    inspection_result: normalizeNullableText(body.inspection_result),
    requirement: normalizeNullableText(body.requirement),
    remarks: normalizeNullableText(body.remarks),
    picture_url: normalizeNullableText(body.picture_url),
    food_body_text: normalizeNullableMultilineText(body.food_body_text),
    is_counterfeit: deriveCounterfeitFlag(body.remarks, body.is_counterfeit)
  };
}

async function refreshAnnouncementInspectionCount(connection, announcementId, fallbackInspectionCount = null) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) AS total FROM announcement_product_details WHERE announcement_id = ?',
    [announcementId]
  );
  const detailCount = Number(rows[0]?.total || 0);
  const hasFallback = fallbackInspectionCount !== null && fallbackInspectionCount !== undefined;
  const inspectionCount = detailCount > 0 ? detailCount : (hasFallback ? normalizeInspectionCount(fallbackInspectionCount, 0) : 0);

  await connection.query(
    'UPDATE announcements SET inspection_count = ? WHERE id = ?',
    [inspectionCount, announcementId]
  );

  return inspectionCount;
}

async function syncAnnouncementDerivedData(connection, announcementId, fallbackInspectionCount = null) {
  const [announcementRows] = await connection.query(
    'SELECT publish_date FROM announcements WHERE id = ? LIMIT 1',
    [announcementId]
  );
  const publishDate = announcementRows[0]?.publish_date || null;

  const companySyncResult = await syncCompaniesFromAnnouncementDetails(connection, announcementId, publishDate);
  const unqualifiedSyncResult = await replaceUnqualifiedProductsFromAnnouncementDetails(connection, announcementId);
  const inspectionCount = await refreshAnnouncementInspectionCount(connection, announcementId, fallbackInspectionCount);

  return {
    companySyncResult,
    unqualifiedSyncResult,
    inspectionCount
  };
}

async function routeTableExists(connection, tableName) {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function deleteByAnnouncementIdIfTableExists(connection, tableName, announcementId) {
  if (!(await routeTableExists(connection, tableName))) {
    return 0;
  }

  const [result] = await connection.query(`DELETE FROM ${tableName} WHERE announcement_id = ?`, [announcementId]);
  return Number(result.affectedRows || 0);
}

async function deleteByProductIdsIfTableExists(connection, tableName, productIds = []) {
  if (!productIds.length || !(await routeTableExists(connection, tableName))) {
    return 0;
  }

  const placeholders = productIds.map(() => '?').join(', ');
  const [result] = await connection.query(
    `DELETE FROM ${tableName} WHERE unqualified_product_id IN (${placeholders})`,
    productIds
  );
  return Number(result.affectedRows || 0);
}


async function parseAttachmentSafely(file, productType = 'cosmetics') {

  if (!file) {
    return {
      supported: false,
      attachment_type: null,
      parsedCount: 0,
      counterfeitCount: 0,
      rows: [],
      message: ''
    };
  }

  try {
    return await parseAnnouncementAttachment(file.path, { productType });
  } catch (error) {
    console.error('解析公告附件失败:', error);
    return {
      supported: false,
      attachment_type: path.extname(file.originalname || '').replace('.', '') || 'unknown',
      parsedCount: 0,
      counterfeitCount: 0,
      rows: [],
      message: '附件已上传，但自动解析失败，请检查文件内容或格式。'
    };
  }
}

async function ensureAnnouncementRouteSchema() {
  await ensureAnnouncementProductDetailsTable(pool);
  await ensureCompaniesSamplingSchema(pool);
  await ensureUnqualifiedProductsTable(pool);
  await ensureAnnouncementStagingSchema(pool);
}

ensureAnnouncementRouteSchema().catch((error) => {
  console.error('初始化公告相关数据表失败:', error);
});




// 获取所有公告列表
router.get('/', async (req, res) => {
  try {
    await ensureAnnouncementRouteSchema();

    const {
      status,
      page = 1,
      limit = 10,
      keyword = '',
      product_type = '',
      year = '',
      location = ''
    } = req.query;
    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = Math.max(Number.parseInt(limit, 10) || 10, 1);
    const offset = (currentPage - 1) * pageSize;
    const normalizedProductType = String(product_type || '').trim();
    const normalizedKeyword = String(keyword || '').trim();
    const normalizedLocation = String(location || '').trim();
    const normalizedYear = Number.parseInt(year, 10);
    const locationSummarySql = buildAnnouncementLocationSummarySql();

    const queryParts = ['1=1'];
    const queryParams = [];
    appendAnnouncementListFilters(queryParts, queryParams, {
      status,
      productType: normalizedProductType,
      keyword: normalizedKeyword,
      location: normalizedLocation,
      year: Number.isInteger(normalizedYear) ? normalizedYear : null
    });

    const [rows] = await pool.query(
      `
        SELECT a.*, u.username AS author_name, ${locationSummarySql} AS location_summary
        FROM announcements a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE ${queryParts.join(' AND ')}
        ORDER BY a.publish_date DESC, a.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...queryParams, pageSize, offset]
    );

    const countParts = ['1=1'];
    const countParams = [];
    appendAnnouncementListFilters(countParts, countParams, {
      status,
      productType: normalizedProductType,
      keyword: normalizedKeyword,
      location: normalizedLocation,
      year: Number.isInteger(normalizedYear) ? normalizedYear : null
    });

    const [countResult] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM announcements a
        WHERE ${countParts.join(' AND ')}
      `,
      countParams
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countResult[0].total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countResult[0].total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});



// 获取公告详情
router.get('/:id', async (req, res) => {
  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;


    const [rows] = await pool.query(`
      SELECT
        a.*, 
        u.username as author_name,
        (
          SELECT COUNT(*)
          FROM announcement_product_details apd
          WHERE apd.announcement_id = a.id
        ) as product_detail_count,
        (
          SELECT COUNT(*)
          FROM announcement_product_details apd
          WHERE apd.announcement_id = a.id AND apd.is_counterfeit = 1
        ) as counterfeit_count
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [id]);


    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE announcements SET view_count = view_count + 1 WHERE id = ?', [id]);

    const announcement = {
      ...rows[0],
      content: await resolveAnnouncementDisplayContent(pool, rows[0])
    };

    res.json({ success: true, data: announcement });
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({ success: false, message: '获取公告详情失败' });
  }
});

// 获取公告关联的批次不符合规定化妆品明细
router.get('/:announcementId/product-details', async (req, res) => {
  try {
    await ensureAnnouncementRouteSchema();

    const { announcementId } = req.params;

    const {
      product_name = '',
      unqualified_item = '',
      company_keyword = '',
      sample_unit_keyword = '',
      sampled_province = '',
      manufacturer_province = '',
      is_counterfeit = ''
    } = req.query;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isNaN(limitRaw) || limitRaw <= 0 ? 50 : Math.min(limitRaw, 200);
    const offset = (page - 1) * limit;

    await ensureAnnouncementProductDetailsTable(pool);

    let [existingRows] = await pool.query(
      `
        SELECT id
        FROM announcement_product_details
        WHERE announcement_id = ?
        LIMIT 1
      `,
      [announcementId]
    );

    if (existingRows.length === 0) {
      const [announcementRows] = await pool.query(
        'SELECT attachment_path, attachment_name FROM announcements WHERE id = ?',
        [announcementId]
      );

      const announcement = announcementRows[0];
      if (announcement?.attachment_path) {
        const attachmentFilePath = path.join(__dirname, '..', announcement.attachment_path.replace(/^\//, ''));

        if (fs.existsSync(attachmentFilePath)) {
          const parsedAttachment = await parseAttachmentSafely({
            path: attachmentFilePath,
            originalname: announcement.attachment_name
          }, announcement.product_type);

          if (parsedAttachment.rows.length > 0) {
            await replaceAnnouncementProductDetails(pool, announcementId, parsedAttachment.rows);
            await syncAnnouncementDerivedData(pool, announcementId);
          }

        }
      }
    }

    const conditions = ['announcement_id = ?'];
    const params = [announcementId];
    const normalizedProductName = String(product_name).trim();
    const normalizedUnqualifiedItem = String(unqualified_item).trim();
    const normalizedCompanyKeyword = String(company_keyword).trim();
    const normalizedSampleUnitKeyword = String(sample_unit_keyword).trim();
    const normalizedSampledProvince = String(sampled_province).trim();
    const normalizedManufacturerProvince = String(manufacturer_province).trim();
    const hasCounterfeitFilter = is_counterfeit === '0' || is_counterfeit === '1';
    const appendProvinceDetailFilter = (columnName, value) => {
      if (!value) {
        return;
      }
      const isUnspecified = value === '__UNSPECIFIED_PROVINCE__' || value === '未标注省份' || value === '未标注';
      if (isUnspecified) {
        conditions.push(`
          EXISTS (
            SELECT 1
            FROM unqualified_products up_filter
            WHERE up_filter.announcement_id = announcement_product_details.announcement_id
              AND up_filter.announcement_detail_id = announcement_product_details.id
              AND (
                up_filter.${columnName} IS NULL
                OR TRIM(up_filter.${columnName}) = ''
                OR TRIM(up_filter.${columnName}) IN ('未标注', '未标注省份', '未标注城市')
              )
          )
        `);
        return;
      }
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM unqualified_products up_filter
          WHERE up_filter.announcement_id = announcement_product_details.announcement_id
            AND up_filter.announcement_detail_id = announcement_product_details.id
            AND TRIM(up_filter.${columnName}) = ?
        )
      `);
      params.push(value);
    };

    if (normalizedProductName) {
      conditions.push('product_name LIKE ?');
      params.push(`%${normalizedProductName}%`);
    }

    if (normalizedUnqualifiedItem) {
      conditions.push('unqualified_items LIKE ?');
      params.push(`%${normalizedUnqualifiedItem}%`);
    }

    if (normalizedCompanyKeyword) {
      conditions.push('company_names LIKE ?');
      params.push(`%${normalizedCompanyKeyword}%`);
    }

    if (normalizedSampleUnitKeyword) {
      conditions.push('sample_unit_name LIKE ?');
      params.push(`%${normalizedSampleUnitKeyword}%`);
    }

    appendProvinceDetailFilter('sampled_province', normalizedSampledProvince);
    appendProvinceDetailFilter('manufacturer_province', normalizedManufacturerProvince);

    if (hasCounterfeitFilter) {
      conditions.push('is_counterfeit = ?');
      params.push(Number(is_counterfeit));
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query(
      `
        SELECT
          COUNT(*) AS cnt,
          SUM(CASE WHEN is_counterfeit = 1 THEN 1 ELSE 0 END) AS filtered_counterfeit_sum
        FROM announcement_product_details
        WHERE ${whereClause}
      `,
      params
    );

    const filteredTotal = Number(countRows[0]?.cnt || 0);
    const filteredCounterfeitCount = Number(countRows[0]?.filtered_counterfeit_sum || 0);

    const [rows] = await pool.query(
      `
        SELECT *
        FROM announcement_product_details
        WHERE ${whereClause}
        ORDER BY sequence_no ASC, id ASC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const summary = await getAnnouncementProductDetailSummary(pool, announcementId);
    const hasFilters = Boolean(
      normalizedProductName ||
      normalizedUnqualifiedItem ||
      normalizedCompanyKeyword ||
      normalizedSampleUnitKeyword ||
      normalizedSampledProvince ||
      normalizedManufacturerProvince ||
      hasCounterfeitFilter
    );

    res.json({
      success: true,
      data: rows,
      summary: {
        ...summary,
        filtered_total: filteredTotal,
        filtered_counterfeit_count: filteredCounterfeitCount,
        has_filters: hasFilters
      },
      pagination: {
        total: filteredTotal,
        page,
        limit,
        pages: limit > 0 ? Math.ceil(filteredTotal / limit) : 0
      }
    });
  } catch (error) {
    console.error('获取公告批次明细失败:', error);
    res.status(500).json({ success: false, message: '获取公告批次明细失败' });
  }
});

// 更新公告关联的批次不符合规定化妆品明细
router.put('/:announcementId/product-details/:detailId', requireRoles(['developer', 'data_admin']), async (req, res) => {
  let connection;

  try {
    const { announcementId, detailId } = req.params;
    const payload = buildAnnouncementProductDetailPayload(req.body || {});

    if (!payload.product_name) {
      return res.status(400).json({ success: false, message: '产品名称不能为空' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      'SELECT id FROM announcement_product_details WHERE id = ? AND announcement_id = ? LIMIT 1',
      [detailId, announcementId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '批次明细不存在' });
    }

    await connection.query(
      `
        UPDATE announcement_product_details
        SET sequence_no = ?, product_name = ?, company_names = ?, company_addresses = ?,
            manufacturer_name = ?, manufacturer_address = ?, operator_name = ?, operator_address = ?,
            sample_unit_name = ?, sample_unit_address = ?, package_spec = ?, batch_no = ?,
            production_date = ?, expiry_date = ?, product_region = ?, registration_no = ?,
            production_license_no = ?, inspection_institution = ?, unqualified_items = ?,
            inspection_result = ?, requirement = ?, remarks = ?, picture_url = ?, food_body_text = ?, is_counterfeit = ?
        WHERE id = ? AND announcement_id = ?
      `,
      [
        payload.sequence_no,
        payload.product_name,
        payload.company_names,
        payload.company_addresses,
        payload.manufacturer_name,
        payload.manufacturer_address,
        payload.operator_name,
        payload.operator_address,
        payload.sample_unit_name,
        payload.sample_unit_address,
        payload.package_spec,
        payload.batch_no,
        payload.production_date,
        payload.expiry_date,
        payload.product_region,
        payload.registration_no,
        payload.production_license_no,
        payload.inspection_institution,
        payload.unqualified_items,
        payload.inspection_result,
        payload.requirement,
        payload.remarks,
        payload.picture_url,
        payload.food_body_text,
        payload.is_counterfeit,
        detailId,
        announcementId
      ]
    );

    const syncResult = await syncAnnouncementDerivedData(connection, announcementId);

    const [updatedRows] = await connection.query(
      'SELECT * FROM announcement_product_details WHERE id = ? AND announcement_id = ? LIMIT 1',
      [detailId, announcementId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: '批次明细更新成功',
      data: updatedRows[0] || null,
      meta: {
        synced_company_count: syncResult.companySyncResult.company_count,
        synced_unqualified_count: syncResult.unqualifiedSyncResult.synced_count,
        inspection_count: syncResult.inspectionCount
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告批次明细失败:', error);
    res.status(500).json({ success: false, message: '更新公告批次明细失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 删除公告关联的批次不符合规定化妆品明细
router.delete('/:announcementId/product-details/:detailId', requireRoles(['developer', 'data_admin']), async (req, res) => {
  let connection;

  try {
    const { announcementId, detailId } = req.params;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      'SELECT id FROM announcement_product_details WHERE id = ? AND announcement_id = ? LIMIT 1',
      [detailId, announcementId]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '批次明细不存在' });
    }

    await connection.query(
      'DELETE FROM announcement_product_details WHERE id = ? AND announcement_id = ?',
      [detailId, announcementId]
    );

    const syncResult = await syncAnnouncementDerivedData(connection, announcementId);

    await connection.commit();

    res.json({
      success: true,
      message: '批次明细删除成功',
      meta: {
        synced_company_count: syncResult.companySyncResult.company_count,
        synced_unqualified_count: syncResult.unqualifiedSyncResult.synced_count,
        inspection_count: syncResult.inspectionCount
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除公告批次明细失败:', error);
    res.status(500).json({ success: false, message: '删除公告批次明细失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 上传公告（带附件和自动解析）
router.post('/', upload.single('attachment'), async (req, res) => {

  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const {
      title,
      content,
      announcement_no,
      publish_date,
      status,
      author_id,
      inspection_unit,
      inspection_count,
      product_type,
      announcement_type,
      source_detail_url,
      source_page,
      source_json_file
    } = req.body;

    const normalizedProductType = normalizeProductType(product_type);
    const normalizedAnnouncementType = normalizeAnnouncementType(announcement_type || 'sampling');
    const extractedInfo = extractAnnouncementInfo(content);

    const parsedAttachment = await parseAttachmentSafely(req.file, normalizedProductType);
    const parsedInspectionCount = parsedAttachment.parsedCount > 0 ? parsedAttachment.parsedCount : 0;

    const finalInspectionUnit = inspection_unit || extractedInfo.inspection_unit;
    const finalInspectionCount = parsedInspectionCount || normalizeInspectionCount(inspection_count, extractedInfo.inspection_count);
    const attachmentPath = req.file ? `/uploads/announcements/${req.file.filename}` : null;
    const attachmentName = req.file ? req.file.originalname : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(`
      INSERT INTO announcements (
        title, content, announcement_no, publish_date,
        inspection_unit, inspection_count, attachment_path, attachment_name,
        product_type, announcement_type, source_detail_url, source_page, source_json_file,
        status, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      content,
      announcement_no,
      publish_date,
      finalInspectionUnit,
      finalInspectionCount,
      attachmentPath,
      attachmentName,
      normalizedProductType,
      normalizedAnnouncementType,
      normalizeNullableText(source_detail_url),
      normalizeNullableText(source_page),
      normalizeNullableText(source_json_file),
      status || 'published',
      author_id
    ]);


    if (parsedAttachment.rows.length > 0) {
      await replaceAnnouncementProductDetails(connection, result.insertId, parsedAttachment.rows);
    }

    const syncResult = await syncAnnouncementDerivedData(connection, result.insertId, finalInspectionCount);


    await connection.commit();

    res.json({
      success: true,
      data: {
        id: result.insertId,
        extracted_info: {
          inspection_unit: finalInspectionUnit,
          inspection_count: syncResult.inspectionCount || finalInspectionCount
        },
        parsed_detail_count: parsedAttachment.parsedCount,
        counterfeit_count: parsedAttachment.counterfeitCount,
        synced_company_count: syncResult.companySyncResult.company_count,
        synced_unqualified_count: syncResult.unqualifiedSyncResult.synced_count,
        parse_message: parsedAttachment.message,
        parse_supported: parsedAttachment.supported
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/:id/sampling-batch-stats', requireRoles(['developer', 'data_admin']), async (req, res) => {
  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;

    const parseNullableInt = (raw) => {
      if (raw === null || raw === undefined || raw === '') {
        return null;
      }
      const n = Number.parseInt(String(raw).trim(), 10);
      return Number.isFinite(n) ? n : NaN;
    };

    let u = parseNullableInt(req.body?.sampling_unqualified_batch_count);
    let q = parseNullableInt(req.body?.sampling_qualified_batch_count);
    let t = parseNullableInt(req.body?.sampling_total_batch_count);

    if (Number.isNaN(u) || Number.isNaN(q) || Number.isNaN(t)) {
      return res.status(400).json({
        success: false,
        message: '抽检不合格批次、合格批次、总批次须为有效非负整数或留空'
      });
    }

    const nonnegative = [u, q, t].every((x) => x === null || x >= 0);
    if (!nonnegative) {
      return res.status(400).json({ success: false, message: '抽检批次数不能为负数' });
    }

    const filled = [u, q, t].filter((x) => x !== null).length;
    if (filled === 3 && u + q !== t) {
      return res.status(400).json({
        success: false,
        message: '抽检不合格批次 + 合格批次须等于抽检总批次'
      });
    }

    if (filled === 2) {
      if (u !== null && t !== null && q === null) {
        q = t - u;
      } else if (u !== null && q !== null && t === null) {
        t = u + q;
      } else if (q !== null && t !== null && u === null) {
        u = t - q;
      }
      if (u < 0 || q < 0 || t < 0) {
        return res.status(400).json({
          success: false,
          message: '根据已填两项推算的第三项不能为负数，请检查数字'
        });
      }
      if (u + q !== t) {
        return res.status(400).json({
          success: false,
          message: '抽检不合格批次 + 合格批次须等于抽检总批次'
        });
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    await connection.query(
      `
        UPDATE announcements
        SET sampling_unqualified_batch_count = ?,
            sampling_qualified_batch_count = ?,
            sampling_total_batch_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [u, q, t, id]
    );

    await connection.commit();

    const [nextRows] = await pool.query(
      `
        SELECT sampling_unqualified_batch_count, sampling_qualified_batch_count, sampling_total_batch_count
        FROM announcements
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    res.json({
      success: true,
      message: '抽检批次统计已更新',
      data: {
        id: Number(id),
        sampling_unqualified_batch_count: nextRows[0]?.sampling_unqualified_batch_count ?? null,
        sampling_qualified_batch_count: nextRows[0]?.sampling_qualified_batch_count ?? null,
        sampling_total_batch_count: nextRows[0]?.sampling_total_batch_count ?? null
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新抽检批次统计失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新抽检批次统计失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/:id/overview-fields', requireRoles(['developer', 'data_admin']), async (req, res) => {
  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;

    const pub = coerceMysqlDateInput(req.body?.publish_date);
    const is = coerceMysqlDateInput(req.body?.inspection_start_date);
    const ie = coerceMysqlDateInput(req.body?.inspection_end_date);
    if (!pub.ok || !is.ok || !ie.ok) {
      return res.status(400).json({ success: false, message: '日期格式须为 YYYY-MM-DD 或留空' });
    }

    const inspection_unit = normalizeNullableText(req.body?.inspection_unit);

    if (is.date && ie.date && String(is.date) > String(ie.date)) {
      return res.status(400).json({ success: false, message: '检验开始日期不能晚于结束日期' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT id FROM announcements WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    await connection.query(
      `
        UPDATE announcements
        SET publish_date = ?,
            inspection_unit = ?,
            inspection_start_date = ?,
            inspection_end_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [pub.date, inspection_unit, is.date, ie.date, id]
    );

    await connection.commit();

    const [nextRows] = await pool.query(
      `
        SELECT publish_date, inspection_unit, inspection_start_date, inspection_end_date
        FROM announcements
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    );

    const row = nextRows[0] || {};

    res.json({
      success: true,
      message: '关键信息字段已更新',
      data: {
        id: Number(id),
        publish_date: row.publish_date ?? null,
        inspection_unit: row.inspection_unit ?? null,
        inspection_start_date: row.inspection_start_date ?? null,
        inspection_end_date: row.inspection_end_date ?? null
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告关键字段失败:', error);
    res.status(500).json({ success: false, message: error.message || '更新公告关键字段失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/:id/content', async (req, res) => {
  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;
    const normalizedContent = normalizeNullableMultilineText(req.body?.content);
    if (!normalizedContent) {
      return res.status(400).json({ success: false, message: '通告正文不能为空' });
    }

    const extractedInfo = extractAnnouncementInfo(normalizedContent);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT * FROM announcements WHERE id = ? LIMIT 1', [id]);
    const existingAnnouncement = rows[0] || null;
    if (!existingAnnouncement) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    const stagingBatchId = await findAnnouncementStagingBatchId(connection, id);
    if (stagingBatchId) {
      await updatePublishedAnnouncementStagingBody(connection, stagingBatchId, normalizedContent);
    } else {
      await connection.query('UPDATE announcements SET content = ? WHERE id = ?', [normalizedContent, id]);
    }

    const nextInspectionUnit = normalizeNullableText(extractedInfo.inspection_unit) || existingAnnouncement.inspection_unit || null;
    await connection.query('UPDATE announcements SET inspection_unit = ? WHERE id = ?', [nextInspectionUnit, id]);
    const inspectionCount = await refreshAnnouncementInspectionCount(connection, id, extractedInfo.inspection_count);

    await connection.commit();

    res.json({
      success: true,
      message: '通告正文更新成功',
      data: {
        id: Number(id),
        updated_content: normalizedContent,
        inspection_unit: nextInspectionUnit,
        inspection_count: inspectionCount,
        updated_staging_batch_id: stagingBatchId
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告正文失败:', error);
    res.status(500).json({ success: false, message: '更新公告正文失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.patch('/:id/product-type', async (req, res) => {

  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;
    const productType = normalizeNullableText(req.body?.product_type);
    if (!productType) {
      return res.status(400).json({ success: false, message: '产品类型不能为空' });
    }

    const normalizedProductType = normalizeProductType(productType);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT id FROM announcements WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    const stagingBatchId = await findAnnouncementStagingBatchId(connection, id);
    let resultPayload;

    if (stagingBatchId) {
      resultPayload = await updateAnnouncementStagingProductType(connection, stagingBatchId, {
        product_type: normalizedProductType
      });
    } else {
      await connection.query('UPDATE announcements SET product_type = ? WHERE id = ?', [normalizedProductType, id]);
      const syncResult = await syncAnnouncementDerivedData(connection, id);
      resultPayload = {
        product_type: normalizedProductType,
        announcement_type: 'sampling',
        synced_company_count: syncResult.companySyncResult.company_count,
        synced_unqualified_count: syncResult.unqualifiedSyncResult.synced_count,
        inspection_count: syncResult.inspectionCount,
        updated_staging_batch_id: null
      };
    }

    await connection.commit();

    res.json({
      success: true,
      message: '产品类型更新成功',
      data: {
        id: Number(id),
        product_type: resultPayload.product_type || normalizedProductType,
        announcement_type: resultPayload.announcement_type || 'sampling',
        synced_company_count: Number(resultPayload.synced_company_count || 0),
        synced_unqualified_count: Number(resultPayload.synced_unqualified_count || 0),
        inspection_count: resultPayload.inspection_count === null || resultPayload.inspection_count === undefined
          ? null
          : Number(resultPayload.inspection_count),
        updated_staging_batch_id: resultPayload.updated_staging_id || resultPayload.staging_batch_id || resultPayload.updated_staging_batch_id || stagingBatchId || null
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告产品类型失败:', error);
    res.status(500).json({ success: false, message: '更新公告产品类型失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// 更新公告
router.put('/:id', upload.single('attachment'), async (req, res) => {
  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;
    const {
      title,
      content,
      announcement_no,
      publish_date,
      status,
      inspection_unit,
      inspection_count,
      product_type,
      announcement_type,
      source_detail_url,
      source_page,
      source_json_file
    } = req.body;
    const normalizedProductType = normalizeProductType(product_type);
    const normalizedAnnouncementType = normalizeAnnouncementType(announcement_type || 'sampling');

    const extractedInfo = extractAnnouncementInfo(content);

    const parsedAttachment = await parseAttachmentSafely(req.file, normalizedProductType);

    const parsedInspectionCount = parsedAttachment.parsedCount > 0 ? parsedAttachment.parsedCount : 0;
    const finalInspectionUnit = inspection_unit || extractedInfo.inspection_unit;
    const finalInspectionCount = parsedInspectionCount || normalizeInspectionCount(inspection_count, extractedInfo.inspection_count);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (req.file) {
      const attachmentPath = `/uploads/announcements/${req.file.filename}`;
      const attachmentName = req.file.originalname;
      await connection.query(`
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            inspection_unit = ?, inspection_count = ?,
            attachment_path = ?, attachment_name = ?,
            product_type = ?, announcement_type = ?,
            source_detail_url = ?, source_page = ?, source_json_file = ?,
            status = ?
        WHERE id = ?
      `, [
        title,
        content,
        announcement_no,
        publish_date,
        finalInspectionUnit,
        finalInspectionCount,
        attachmentPath,
        attachmentName,
        normalizedProductType,
        normalizedAnnouncementType,
        normalizeNullableText(source_detail_url),
        normalizeNullableText(source_page),
        normalizeNullableText(source_json_file),
        status,
        id
      ]);


      await replaceAnnouncementProductDetails(connection, id, parsedAttachment.rows);
    } else {
      await connection.query(`
        UPDATE announcements
        SET title = ?, content = ?, announcement_no = ?, publish_date = ?,
            inspection_unit = ?, inspection_count = ?,
            product_type = ?, announcement_type = ?,
            source_detail_url = ?, source_page = ?, source_json_file = ?,
            status = ?
        WHERE id = ?
      `, [
        title,
        content,
        announcement_no,
        publish_date,
        finalInspectionUnit,
        finalInspectionCount,
        normalizedProductType,
        normalizedAnnouncementType,
        normalizeNullableText(source_detail_url),
        normalizeNullableText(source_page),
        normalizeNullableText(source_json_file),
        status,
        id
      ]);

    }

    const syncResult = await syncAnnouncementDerivedData(connection, id, finalInspectionCount);


    await connection.commit();

    res.json({
      success: true,
      message: '更新成功',
      data: {
        parsed_detail_count: parsedAttachment.parsedCount,
        counterfeit_count: parsedAttachment.counterfeitCount,
        synced_company_count: syncResult.companySyncResult.company_count,
        synced_unqualified_count: syncResult.unqualifiedSyncResult.synced_count,
        inspection_count: syncResult.inspectionCount || finalInspectionCount,
        parse_message: parsedAttachment.message,
        parse_supported: parsedAttachment.supported
      }
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 删除公告
router.delete('/:id', requireRoles(['developer', 'data_admin']), async (req, res) => {
  let connection;

  try {
    await ensureAnnouncementRouteSchema();

    const { id } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [announcementRows] = await connection.query('SELECT id FROM announcements WHERE id = ? LIMIT 1', [id]);
    if (announcementRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '通告不存在' });
    }

    const [companyRows] = await connection.query(
      `
        SELECT DISTINCT company_id
        FROM company_sampling_records
        WHERE announcement_id = ? AND company_id IS NOT NULL
      `,
      [id]
    );
    const affectedCompanyIds = companyRows.map((row) => Number(row.company_id)).filter(Boolean);

    const [productRows] = await connection.query(
      'SELECT id FROM unqualified_products WHERE announcement_id = ?',
      [id]
    );
    const productIds = productRows.map((row) => Number(row.id)).filter(Boolean);

    await deleteByProductIdsIfTableExists(connection, 'unqualified_product_usage_records', productIds);
    await deleteByProductIdsIfTableExists(connection, 'unqualified_product_tree_rollups', productIds);
    const deletedProductCompanyLinks = await deleteByAnnouncementIdIfTableExists(connection, 'unqualified_product_companies', id);
    const deletedProductCategoryItems = await deleteByAnnouncementIdIfTableExists(connection, 'unqualified_product_category_items', id);
    const deletedProductIssueItems = await deleteByAnnouncementIdIfTableExists(connection, 'unqualified_product_issue_items', id);

    await connection.query('DELETE FROM inspection_details WHERE inspection_id IN (SELECT id FROM inspections WHERE announcement_id = ?)', [id]);
    await connection.query('DELETE FROM inspections WHERE announcement_id = ?', [id]);
    const [deletedProducts] = await connection.query('DELETE FROM unqualified_products WHERE announcement_id = ?', [id]);
    const companyCleanupResult = await removeAnnouncementCompanySampling(connection, id);
    const [deletedDetails] = await connection.query('DELETE FROM announcement_product_details WHERE announcement_id = ?', [id]);
    const [deletedAnnouncement] = await connection.query('DELETE FROM announcements WHERE id = ?', [id]);


    await connection.commit();
    res.json({
      success: true,
      message: '删除成功',
      meta: {
        deleted_announcement_count: Number(deletedAnnouncement.affectedRows || 0),
        deleted_product_detail_count: Number(deletedDetails.affectedRows || 0),
        deleted_unqualified_product_count: Number(deletedProducts.affectedRows || 0),
        deleted_product_company_link_count: deletedProductCompanyLinks,
        deleted_product_category_item_count: deletedProductCategoryItems,
        deleted_product_issue_item_count: deletedProductIssueItems,
        affected_company_count: affectedCompanyIds.length,
        deleted_company_count: Number(companyCleanupResult?.deleted_count || 0)
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// 获取公告相关的检查详情
router.get('/:announcementId/inspections', async (req, res) => {
  try {
    const { announcementId } = req.params;

    const [rows] = await pool.query(`
      SELECT id.*, c.name as company_name, c.brand as company_brand
      FROM inspection_details id
      LEFT JOIN inspections i ON id.inspection_id = i.id
      LEFT JOIN companies c ON id.company_id = c.id
      WHERE i.announcement_id = ?
      ORDER BY id.inspection_result DESC
    `, [announcementId]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取公告相关检查详情失败:', error);
    res.status(500).json({ success: false, message: '获取公告相关检查详情失败' });
  }
});

module.exports = router;
