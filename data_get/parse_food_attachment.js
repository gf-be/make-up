const path = require('path');
const fs = require('fs');

function requireFromBackendOrDefault(packageName) {
  try {
    return require(packageName);
  } catch (error) {
    const backendPackagePath = path.resolve(__dirname, '..', 'backend', 'node_modules', packageName);
    return require(backendPackagePath);
  }
}

const XLSX = requireFromBackendOrDefault('xlsx');
const { buildStructuredCompanyFields } = require(path.resolve(__dirname, '..', 'backend', 'utils', 'companyFieldParser'));

const HEADER_ALIASES = {
  序号: 'sequence_no',
  标称生产企业名称: 'company_names',
  生产企业名称: 'company_names',
  标称生产企业地址: 'company_addresses',
  生产企业地址: 'company_addresses',
  被抽样单位名称: 'sample_unit_name',
  经营者名称: 'sample_unit_name',
  销售单位名称: 'sample_unit_name',
  网店名称: 'sample_unit_name',
  被抽样单位地址: 'sample_unit_address',
  经营地址: 'sample_unit_address',
  样品名称: 'product_name',
  产品名称: 'product_name',
  规格型号: 'package_spec',
  规格: 'package_spec',
  商标: 'brand',
  生产日期: 'production_date',
  保质期: 'expiry_date',
  不合格项目: 'unqualified_items',
  检验值: 'inspection_value',
  标准值: 'standard_value',
  标签标注要求: 'label_requirement',
  检验机构: 'inspection_institution',
  食品细类: 'food_category',
  抽样编号: 'sample_code',
  抽检编号: 'sample_code',
  抽样单号: 'sample_code',
  省份: 'province'
};

const REQUIRED_KEYS = new Set([
  'product_name',
  'company_names',
  'sample_unit_name',
  'unqualified_items',
  'inspection_institution'
]);

/** 与 isContinuationRow 一致：有这些列任一有值视为「新的一行主体」，续行则用第一列带出序号沿用 */
const FIELD_PRIMARY_MERGE_KEYS = [
  'sequence_no',
  'product_name',
  'company_names',
  'sample_unit_name',
  'sample_unit_address',
  'package_spec',
  'production_date',
  'expiry_date',
  'inspection_institution'
];

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\u0007/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[\s:：/（）()[\]【】·]+/g, '');
}

function normalizeAsciiDigits(value) {
  return normalizeText(value).replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}

function asCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return normalizeText(value);
}

function normalizeProductionDate(value) {
  const text = normalizeText(value);
  const slashDate = text.match(/^(\d)\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!slashDate) return text;

  const [, day, month, yearText] = slashDate;
  const year = yearText.length === 2 ? 2000 + Number.parseInt(yearText, 10) : Number.parseInt(yearText, 10);
  return `${year}/${Number.parseInt(month, 10)}/${Number.parseInt(day, 10)}`;
}

/**
 * 例如「附件17 肉制品监督抽检不合格产品信息.xlsx」→「肉制品」（按附件名归类的抽检大类）
 */
function inferSamplingCategoryFromAttachmentBasename(filePath) {
  const base = normalizeText(
    typeof filePath === 'string' ? filePath.replace(/\\/g, '/').split('/').pop() || '' : ''
  );
  if (!base) return '';
  const stem = normalizeText(base.replace(/\.(xlsx?|xls|csv|zip)$/i, ''));
  if (!stem) return '';
  const withoutPrefix = normalizeText(stem.replace(/^附件\s*[0-9０-９一二三四五六七八九十\-—_]*\s*/u, '').trim())
    || stem;
  let m = withoutPrefix.match(/^(.+?)(?:监督抽检不合格产品信息|抽检不合格产品信息)(?:_\d+)?$/u);
  if (m?.[1]) {
    return normalizeText(m[1].replace(/^[_－\-—\s]+|[_－\-—\s]+$/g, ''));
  }
  m = withoutPrefix.match(/^(.+?)(?:监督抽检不合格|抽检不合格)/u);
  if (m?.[1]) {
    return normalizeText(m[1].replace(/^[_－\-—\s]+|[_－\-—\s]+$/g, ''));
  }
  return '';
}

function joinText(parts, sep = '；', fallback = '') {
  const values = parts.map(normalizeText).filter(Boolean);
  return values.length ? values.join(sep) : fallback;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i += 1) {
    const keys = new Set(
      rows[i]
        .map((cell) => HEADER_ALIASES[normalizeHeader(cell)])
        .filter(Boolean)
    );
    const hitCount = [...keys].filter((key) => REQUIRED_KEYS.has(key)).length;
    if (hitCount >= 3 && keys.has('product_name') && keys.has('unqualified_items')) {
      return i;
    }
  }
  return -1;
}

function buildFieldMap(headerRow) {
  const fieldMap = {};
  headerRow.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)];
    if (key && fieldMap[key] === undefined) {
      fieldMap[key] = index;
    }
  });
  return fieldMap;
}

function byField(row, fieldMap, key) {
  const index = fieldMap[key];
  if (index === undefined || index >= row.length) return '';
  return asCell(row[index]);
}

function hasPrimaryRowFields(row, fieldMap) {
  return FIELD_PRIMARY_MERGE_KEYS.some((key) => byField(row, fieldMap, key));
}

function buildInspectionResult(row, fieldMap) {
  const inspectionValue = byField(row, fieldMap, 'inspection_value');
  const standardValue = byField(row, fieldMap, 'standard_value');
  const labelRequirement = byField(row, fieldMap, 'label_requirement');
  return joinText([
    inspectionValue ? `检验值：${inspectionValue}` : '',
    standardValue ? `标准值：${standardValue}` : '',
    labelRequirement && !['/', '-'].includes(labelRequirement) ? `标签标注要求：${labelRequirement}` : ''
  ]);
}

function buildRequirement(row, fieldMap) {
  const standardValue = byField(row, fieldMap, 'standard_value');
  const labelRequirement = byField(row, fieldMap, 'label_requirement');
  return joinText([
    standardValue ? `标准值：${standardValue}` : '',
    labelRequirement && !['/', '-'].includes(labelRequirement) ? `标签标注要求：${labelRequirement}` : ''
  ], '\n');
}

function appendDistinct(existing, addition, sep = '；') {
  const seen = new Set();
  const out = [];
  for (const part of [existing, addition]) {
    const text = normalizeText(part);
    if (!text || text === '/') continue;
    for (const item of text.split(sep).map((x) => x.trim()).filter(Boolean)) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out.join(sep);
}

/**
 * 表格里常见把食品细类写在样品名称末尾，并非商品本名（合并多行时应去掉再比对去重）。
 */
const PRODUCT_NAME_TRAILING_CATEGORY_MARKERS = [
  /（营养补充品）$/u,
  /（辅食营养素补充食品）$/u,
  /（孕妇营养补充食品）$/u,
  /（运动营养食品）$/u,
  /（补充能量类）$/u
];

function stripTrailingProductNameCategoryNoise(text) {
  let t = normalizeText(text);
  if (!t) return '';
  let prev;
  do {
    prev = t;
    for (const re of PRODUCT_NAME_TRAILING_CATEGORY_MARKERS) {
      t = t.replace(re, '').trim();
    }
  } while (t !== prev);
  return t;
}

/**
 * 合并样品名称：先去尾部细类噪声再比对；核心一致则保留不含噪声的名称。
 */
function mergeProductNames(existing, incoming) {
  const cur = normalizeText(existing);
  const next = normalizeText(incoming);
  if (!next) return stripTrailingProductNameCategoryNoise(cur);
  if (!cur) return stripTrailingProductNameCategoryNoise(next);
  if (cur === next) return stripTrailingProductNameCategoryNoise(cur);

  const curCore = stripTrailingProductNameCategoryNoise(cur);
  const nextCore = stripTrailingProductNameCategoryNoise(next);
  if (curCore === nextCore) {
    return curCore;
  }

  const merged = mergeScalarPreferCompleteThenDistinct(curCore, nextCore);
  return stripTrailingProductNameCategoryNoise(merged);
}

/**
 * 同一产品多行：优先保留信息量更大的单值（互为子串取较长段），否则用 appendDistinct 拼开并去重。
 */
function mergeScalarPreferCompleteThenDistinct(existing, incoming, joinSep = '；') {
  const cur = normalizeText(existing);
  const next = normalizeText(incoming);
  if (!next) return cur;
  if (!cur) return next;
  if (cur === next) return cur;
  if (next.includes(cur)) return next;
  if (cur.includes(next)) return cur;
  return appendDistinct(cur, next, joinSep);
}

function isContinuationRow(row, fieldMap) {
  if (hasPrimaryRowFields(row, fieldMap)) return false;
  return Boolean(
    byField(row, fieldMap, 'unqualified_items')
    || byField(row, fieldMap, 'inspection_value')
    || byField(row, fieldMap, 'standard_value')
    || byField(row, fieldMap, 'label_requirement')
  );
}

function applyFoodStructuredCompanyFields(productRow) {
  if (!productRow) {
    return productRow;
  }
  const structured = buildStructuredCompanyFields(
    'food',
    productRow.company_names || '',
    productRow.company_addresses || '',
    {
      manufacturer_name: productRow.manufacturer_name,
      manufacturer_address: productRow.manufacturer_address,
      operator_name: productRow.operator_name,
      operator_address: productRow.operator_address,
      sample_unit_name: productRow.sample_unit_name,
      sample_unit_address: productRow.sample_unit_address
    }
  );
  productRow.company_names = structured.company_names;
  productRow.company_addresses = structured.company_addresses;
  productRow.manufacturer_name = structured.manufacturer_name;
  productRow.manufacturer_address = structured.manufacturer_address;
  productRow.operator_name = structured.operator_name;
  productRow.operator_address = structured.operator_address;
  if (structured.sample_unit_name && !productRow.sample_unit_name) {
    productRow.sample_unit_name = structured.sample_unit_name;
  }
  if (structured.sample_unit_address && !productRow.sample_unit_address) {
    productRow.sample_unit_address = structured.sample_unit_address;
  }
  if (Array.isArray(structured.company_entries) && structured.company_entries.length) {
    productRow.company_entries = structured.company_entries;
  }
  return productRow;
}

function mergeContinuation(productRow, row, fieldMap) {
  const mergedName = mergeProductNames(productRow.product_name, byField(row, fieldMap, 'product_name'));
  if (mergedName) {
    productRow.product_name = mergedName;
  }
  const co = mergeScalarPreferCompleteThenDistinct(productRow.company_names, byField(row, fieldMap, 'company_names'));
  if (co) {
    productRow.company_names = co;
  }
  const addr = mergeScalarPreferCompleteThenDistinct(productRow.company_addresses, byField(row, fieldMap, 'company_addresses'));
  if (addr) {
    productRow.company_addresses = addr;
  }
  const su = mergeScalarPreferCompleteThenDistinct(productRow.sample_unit_name, byField(row, fieldMap, 'sample_unit_name'));
  if (su) {
    productRow.sample_unit_name = su;
  }
  const sua = mergeScalarPreferCompleteThenDistinct(productRow.sample_unit_address, byField(row, fieldMap, 'sample_unit_address'));
  if (sua) {
    productRow.sample_unit_address = sua;
  }
  const spec = mergeScalarPreferCompleteThenDistinct(productRow.package_spec, byField(row, fieldMap, 'package_spec'));
  if (spec) productRow.package_spec = spec;

  const nextCode = normalizeText(byField(row, fieldMap, 'sample_code'));
  if (nextCode && !isBlankSamplingCode(nextCode)) {
    const prev = normalizeText(productRow.batch_no);
    if (!prev) {
      productRow.batch_no = nextCode;
    } else if (prev !== nextCode) {
      productRow.batch_no = appendDistinct(prev, nextCode, '；');
    }
  }

  productRow.expiry_date = productRow.expiry_date
    || normalizeText(byField(row, fieldMap, 'expiry_date'))
    || null;
  productRow.product_region = productRow.product_region
    || normalizeText(byField(row, fieldMap, 'province'))
    || null;

  const inst = mergeScalarPreferCompleteThenDistinct(
    productRow.inspection_institution,
    byField(row, fieldMap, 'inspection_institution')
  );
  if (inst) productRow.inspection_institution = inst;

  const excelFoodFine = normalizeText(byField(row, fieldMap, 'food_category'));
  if (!productRow.attachment_sampling_category && excelFoodFine) {
    productRow.attachment_sampling_category = excelFoodFine;
  }

  const items = appendDistinct(productRow.unqualified_items, byField(row, fieldMap, 'unqualified_items'), '\n');
  const result = appendDistinct(productRow.inspection_result, buildInspectionResult(row, fieldMap), '\n');
  const requirement = appendDistinct(productRow.requirement, buildRequirement(row, fieldMap), '\n');
  if (items) productRow.unqualified_items = items;
  if (result) productRow.inspection_result = result;
  if (requirement) productRow.requirement = requirement;
  productRow.production_date = productRow.production_date || normalizeProductionDate(byField(row, fieldMap, 'production_date')) || null;
  applyFoodStructuredCompanyFields(productRow);
}

function buildProductRow(row, fieldMap, sequenceNo, categoryFromAttachment) {
  const productName = stripTrailingProductNameCategoryNoise(byField(row, fieldMap, 'product_name'));
  if (!productName) return null;
  const excelFoodFine = normalizeText(byField(row, fieldMap, 'food_category'));
  const productRow = {
    sequence_no: sequenceNo,
    product_name: productName,
    company_names: byField(row, fieldMap, 'company_names') || null,
    company_addresses: byField(row, fieldMap, 'company_addresses') || null,
    manufacturer_name: null,
    manufacturer_address: null,
    operator_name: null,
    operator_address: null,
    sample_unit_name: byField(row, fieldMap, 'sample_unit_name') || null,
    sample_unit_address: byField(row, fieldMap, 'sample_unit_address') || null,
    package_spec: byField(row, fieldMap, 'package_spec') || null,
    batch_no: byField(row, fieldMap, 'sample_code') || null,
    production_date: normalizeProductionDate(byField(row, fieldMap, 'production_date')) || null,
    expiry_date: byField(row, fieldMap, 'expiry_date') || null,
    product_region: byField(row, fieldMap, 'province') || null,
    registration_no: null,
    production_license_no: null,
    inspection_institution: byField(row, fieldMap, 'inspection_institution') || null,
    unqualified_items: byField(row, fieldMap, 'unqualified_items') || null,
    inspection_result: buildInspectionResult(row, fieldMap) || null,
    requirement: buildRequirement(row, fieldMap) || null,
    remarks: null,
    attachment_sampling_category: categoryFromAttachment || excelFoodFine || null,
    is_counterfeit: 0
  };
  return applyFoodStructuredCompanyFields(productRow);
}

function isBlankSamplingCode(value) {
  const t = normalizeText(value);
  if (!t || t === '/' || t === '／') return true;
  if (/^[\-—_/・·]+$/u.test(t)) return true;
  return false;
}

/** 合并行后沿用上一条有效的抽样编号（Excel 合并单元格后续物理行常为空白） */
function refreshSamplingCodeCarry(carrier, batchNo) {
  const bn = normalizeText(batchNo);
  if (!isBlankSamplingCode(bn)) return bn;
  return carrier;
}

/** 新开一条物理行且无抽样编号时清空沿用，避免无关续行误并进上一抽样单 */
function samplingCodeCarryAfterNewProductRow(carrier, batchNo) {
  const bn = normalizeText(batchNo);
  if (!isBlankSamplingCode(bn)) return bn;
  return '';
}

function normalizeDigitsToPositiveSeqKey(normalizedAscii) {
  const raw = normalizedAscii.trim();
  if (!raw || /^[\-/／.．]+$/u.test(raw)) return '';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? String(n) : '';
}

/** 表格物理第一列（通常为序号列，含合并单元格后续空单元格时用上一序号） */
function normalizeFirstColumnSeqKey(row) {
  if (!Array.isArray(row) || row.length === 0) return '';
  return normalizeDigitsToPositiveSeqKey(normalizeAsciiDigits(asCell(row[0])));
}

/** Excel 表头「序号」映射列 */
function normalizeExcelSequenceKey(row, fieldMap) {
  const raw = normalizeAsciiDigits(byField(row, fieldMap, 'sequence_no'));
  return normalizeDigitsToPositiveSeqKey(raw);
}

/** 输出行的 sequence_no：优先表格第一列序号，其次表头序号列，最后用解析顺序 */
function resolveOutputSequenceNo(row, fieldMap, firstColEffectiveKey, fallback) {
  if (firstColEffectiveKey) return Number.parseInt(firstColEffectiveKey, 10);
  const keyFromHeader = normalizeExcelSequenceKey(row, fieldMap);
  if (keyFromHeader) return Number.parseInt(keyFromHeader, 10);
  return fallback;
}

/**
 * 同一附件内产品数以「表格第一列序号」为主：同序号的多行并入一条；
 * 无第一列序号时再用表头「序号」列、再抽样编号。
 */
function fallbackProductMergeIdentity(row, fieldMap) {
  const excelSeq = normalizeExcelSequenceKey(row, fieldMap);
  if (excelSeq) {
    return `excelseq:${excelSeq}`;
  }
  const sampleCode = byField(row, fieldMap, 'sample_code');
  if (!isBlankSamplingCode(sampleCode)) {
    return `sid:${normalizeText(sampleCode)}`;
  }
  return '';
}

function resolveProductMergeIdentity(row, fieldMap, firstColumnEffectiveSeq) {
  if (firstColumnEffectiveSeq) {
    return `leadseq:${firstColumnEffectiveSeq}`;
  }
  return fallbackProductMergeIdentity(row, fieldMap);
}

/** 同一抽样编号只对应一条产品；续行若在首列/序号列被标成新序号，仍并入该编号已建行的对象。 */
function registerProductMergeKeys(productsByIdentity, productRow, identity) {
  if (identity) {
    productsByIdentity.set(identity, productRow);
  }
  ensureSamplingIdIndex(productsByIdentity, productRow);
}

function ensureSamplingIdIndex(productsByIdentity, productRow) {
  const sid = normalizeText(productRow.batch_no);
  if (!isBlankSamplingCode(sid)) {
    productsByIdentity.set(`sid:${sid}`, productRow);
  }
}

function findExistingProductForRow(productsByIdentity, row, fieldMap, identity) {
  let existing = identity ? productsByIdentity.get(identity) : null;
  if (existing) {
    return existing;
  }
  const rowSid = normalizeText(byField(row, fieldMap, 'sample_code'));
  if (!isBlankSamplingCode(rowSid)) {
    existing = productsByIdentity.get(`sid:${rowSid}`) || null;
  }
  return existing;
}

function parseWorkbook(filePath) {
  const categoryFromAttachment = inferSamplingCategoryFromAttachmentBasename(filePath);
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const rows = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const headerIndex = findHeaderRow(rawRows);
    if (headerIndex < 0) continue;
    const fieldMap = buildFieldMap(rawRows[headerIndex]);
    let sequenceNo = 1;
    let blankStreak = 0;
    let current = null;
    const productsByIdentity = new Map();
    let firstColumnSeqCarry = '';
    let sampleCodeCarry = '';
    for (const row of rawRows.slice(headerIndex + 1)) {
      if (!row.some((cell) => normalizeText(cell))) {
        blankStreak += 1;
        if (blankStreak >= 3) break;
        continue;
      }
      blankStreak = 0;

      const explicitSid = normalizeText(byField(row, fieldMap, 'sample_code'));
      const effectiveSamplingCode = !isBlankSamplingCode(explicitSid) ? explicitSid : sampleCodeCarry;

      // 不合格项目多行分列（钙/铁/锌等）：后续行抽样编号常为空，须按沿用编号并入同一条
      if (isBlankSamplingCode(explicitSid) && !isBlankSamplingCode(effectiveSamplingCode)) {
        const existingBySid = productsByIdentity.get(`sid:${effectiveSamplingCode}`);
        if (existingBySid) {
          mergeContinuation(existingBySid, row, fieldMap);
          ensureSamplingIdIndex(productsByIdentity, existingBySid);
          current = existingBySid;
          sampleCodeCarry = refreshSamplingCodeCarry(sampleCodeCarry, existingBySid.batch_no);
          continue;
        }
      }

      const firstColParsed = normalizeFirstColumnSeqKey(row);
      const hasPrimary = hasPrimaryRowFields(row, fieldMap);
      // 仅有「样品名称」等被 Excel 重复填入时不要清空首列序号继承；新的抽样编号出现时再断开
      if (hasPrimary && !firstColParsed && !isBlankSamplingCode(explicitSid)) {
        firstColumnSeqCarry = '';
      }
      if (firstColParsed) {
        firstColumnSeqCarry = firstColParsed;
      }
      const firstColEffectiveSeq = firstColParsed || (hasPrimary ? '' : firstColumnSeqCarry);

      const identity = resolveProductMergeIdentity(row, fieldMap, firstColEffectiveSeq);
      const existingProduct = findExistingProductForRow(productsByIdentity, row, fieldMap, identity);
      if (existingProduct) {
        mergeContinuation(existingProduct, row, fieldMap);
        ensureSamplingIdIndex(productsByIdentity, existingProduct);
        current = existingProduct;
        sampleCodeCarry = refreshSamplingCodeCarry(sampleCodeCarry, existingProduct.batch_no);
        continue;
      }
      const outSeq = resolveOutputSequenceNo(row, fieldMap, firstColEffectiveSeq, sequenceNo);
      const productRow = buildProductRow(row, fieldMap, outSeq, categoryFromAttachment);
      if (productRow) {
        rows.push(productRow);
        current = productRow;
        registerProductMergeKeys(productsByIdentity, productRow, identity);
        sequenceNo += 1;
        sampleCodeCarry = samplingCodeCarryAfterNewProductRow(sampleCodeCarry, productRow.batch_no);
      } else if (current && isContinuationRow(row, fieldMap)) {
        mergeContinuation(current, row, fieldMap);
        ensureSamplingIdIndex(productsByIdentity, current);
        sampleCodeCarry = refreshSamplingCodeCarry(sampleCodeCarry, current.batch_no);
      }
    }
  }
  return rows;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('请传入食品抽检附件路径');
    process.exit(1);
  }
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }

  const rows = parseWorkbook(absolutePath);
  process.stdout.write(JSON.stringify({
    file_path: absolutePath,
    supported: true,
    attachment_type: 'excel',
    parsedCount: rows.length,
    counterfeitCount: 0,
    message: rows.length ? '' : '未从食品抽检附件中识别到可导入表格明细。',
    rows
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
