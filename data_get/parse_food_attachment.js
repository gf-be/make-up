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
const WordExtractor = requireFromBackendOrDefault('word-extractor');
const wordExtractor = new WordExtractor();

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
  备注: 'remarks',
  省份: 'province'
};

const REQUIRED_KEYS = new Set([
  'product_name',
  'company_names',
  'sample_unit_name',
  'unqualified_items',
  'inspection_institution'
]);

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

function asCell(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return normalizeText(value);
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

function buildRemarks(row, fieldMap) {
  return joinText([
    byField(row, fieldMap, 'remarks'),
    byField(row, fieldMap, 'brand') ? `商标：${byField(row, fieldMap, 'brand')}` : '',
    byField(row, fieldMap, 'food_category') ? `食品细类：${byField(row, fieldMap, 'food_category')}` : '',
    byField(row, fieldMap, 'sample_code') ? `抽样编号：${byField(row, fieldMap, 'sample_code')}` : '',
    byField(row, fieldMap, 'province') ? `省份：${byField(row, fieldMap, 'province')}` : ''
  ], '\n', '/');
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

function isContinuationRow(row, fieldMap) {
  const primary = [
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
  if (primary.some((key) => byField(row, fieldMap, key))) return false;
  return Boolean(
    byField(row, fieldMap, 'unqualified_items')
    || byField(row, fieldMap, 'inspection_value')
    || byField(row, fieldMap, 'standard_value')
    || byField(row, fieldMap, 'label_requirement')
    || byField(row, fieldMap, 'remarks')
  );
}

function mergeContinuation(productRow, row, fieldMap) {
  const items = appendDistinct(productRow.unqualified_items, byField(row, fieldMap, 'unqualified_items'));
  const result = appendDistinct(productRow.inspection_result, buildInspectionResult(row, fieldMap), '\n');
  const requirement = appendDistinct(productRow.requirement, buildRequirement(row, fieldMap), '\n');
  const remarks = appendDistinct(productRow.remarks, byField(row, fieldMap, 'remarks'), '\n');
  if (items) productRow.unqualified_items = items;
  if (result) productRow.inspection_result = result;
  if (requirement) productRow.requirement = requirement;
  if (remarks) productRow.remarks = remarks;
}

function buildProductRow(row, fieldMap, sequenceNo) {
  const productName = byField(row, fieldMap, 'product_name');
  if (!productName) return null;
  return {
    sequence_no: sequenceNo,
    product_name: productName,
    company_names: byField(row, fieldMap, 'company_names') || null,
    company_addresses: byField(row, fieldMap, 'company_addresses') || null,
    manufacturer_name: byField(row, fieldMap, 'company_names') || null,
    manufacturer_address: byField(row, fieldMap, 'company_addresses') || null,
    operator_name: byField(row, fieldMap, 'sample_unit_name') || null,
    operator_address: byField(row, fieldMap, 'sample_unit_address') || null,
    sample_unit_name: byField(row, fieldMap, 'sample_unit_name') || null,
    sample_unit_address: byField(row, fieldMap, 'sample_unit_address') || null,
    package_spec: byField(row, fieldMap, 'package_spec') || null,
    batch_no: byField(row, fieldMap, 'sample_code') || null,
    production_date: byField(row, fieldMap, 'production_date') || null,
    expiry_date: byField(row, fieldMap, 'expiry_date') || null,
    product_region: byField(row, fieldMap, 'province') || null,
    registration_no: null,
    production_license_no: null,
    inspection_institution: byField(row, fieldMap, 'inspection_institution') || null,
    unqualified_items: byField(row, fieldMap, 'unqualified_items') || null,
    inspection_result: buildInspectionResult(row, fieldMap) || null,
    requirement: buildRequirement(row, fieldMap) || null,
    remarks: buildRemarks(row, fieldMap),
    is_counterfeit: 0
  };
}

function parseWorkbook(filePath) {
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
    for (const row of rawRows.slice(headerIndex + 1)) {
      if (!row.some((cell) => normalizeText(cell))) {
        blankStreak += 1;
        if (blankStreak >= 3) break;
        continue;
      }
      blankStreak = 0;
      const productRow = buildProductRow(row, fieldMap, sequenceNo);
      if (productRow) {
        rows.push(productRow);
        current = productRow;
        sequenceNo += 1;
      } else if (current && isContinuationRow(row, fieldMap)) {
        mergeContinuation(current, row, fieldMap);
      }
    }
  }
  return rows;
}

async function extractWordText(filePath) {
  const document = await wordExtractor.extract(filePath);
  return normalizeText(document.getBody()).replace(/ ?\n ?/g, '\n');
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('请传入食品抽检附件路径');
    process.exit(1);
  }
  const absolutePath = path.resolve(filePath);
  const ext = path.extname(absolutePath).toLowerCase();
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`文件不存在: ${absolutePath}`);
  }

  if (ext === '.doc' || ext === '.docx') {
    const rawText = await extractWordText(absolutePath);
    process.stdout.write(JSON.stringify({
      file_path: absolutePath,
      supported: true,
      attachment_type: 'word',
      parsedCount: 0,
      counterfeitCount: 0,
      message: rawText
        ? `Word 附件无表格，已提取正文文本：\n${rawText.slice(0, 900)}`
        : 'Word 附件未提取到正文文本。',
      rawText,
      rows: []
    }, null, 2));
    return;
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
