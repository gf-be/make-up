const path = require('path');
const WordExtractor = require('word-extractor');
const XLSX = require('xlsx');

const extractor = new WordExtractor();

function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t]+/g, '\t')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractRawTextFromWord(filePath) {
  const document = await extractor.extract(filePath);
  return document.getBody();
}

function extractRawTextFromExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return '';
  }

  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], {
    FS: '\t',
    RS: '\n',
    blankrows: false
  });
}

async function extractAttachmentText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.doc' || ext === '.docx') {
    return {
      supported: true,
      attachment_type: 'word',
      rawText: await extractRawTextFromWord(filePath)
    };
  }

  if (ext === '.xls' || ext === '.xlsx') {
    return {
      supported: true,
      attachment_type: 'excel',
      rawText: extractRawTextFromExcel(filePath)
    };
  }

  return {
    supported: false,
    attachment_type: ext.replace('.', '') || 'unknown',
    rawText: ''
  };
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSectionValue(text, label, nextLabels = []) {
  const nextPart = nextLabels.length > 0
    ? `(?=\\n(?:${nextLabels.map((item) => escapeRegExp(item)).join('|')})[\\t ]*|$)`
    : '$';
  const regex = new RegExp(`${escapeRegExp(label)}[\\t ]*([\\s\\S]*?)${nextPart}`);
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function getSingleLineValue(text, label, nextLabels = []) {
  const section = getSectionValue(text, label, nextLabels);
  return section.split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
}

function parseChineseDate(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) {
    return normalized || null;
  }

  const [, year, month, day] = match;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseFlightInspectionText(rawText) {
  const text = normalizeText(rawText)
    .replace(/社会信用代码\s*\n\s*（组织机构代码）/g, '社会信用代码（组织机构代码）');

  if (!text) {
    return null;
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const companyName = getSingleLineValue(text, '企业名称', ['化妆品生产许可证编号', '企业地址']) || lines[1] || '';
  const title = `${companyName || '化妆品企业'}飞行检查结果`;

  const productionLicenseNoMatch = text.match(/化妆品生产许可证编号[\t ]*([^\t\n]+)/);
  const socialCreditCodeMatch = text.match(/社会信用代码（组织机构代码）[\t ]*([^\t\n]+)/);
  const productionLicenseNo = productionLicenseNoMatch ? productionLicenseNoMatch[1].trim() : '';
  const socialCreditCode = socialCreditCodeMatch ? socialCreditCodeMatch[1].trim() : '';

  const companyAddress = getSingleLineValue(text, '企业地址', ['检查单位']);
  const inspectionUnit = getSingleLineValue(text, '检查单位', ['检查依据']);
  const inspectionBasis = getSectionValue(text, '检查依据', ['检查发现缺陷和问题']);
  const defectsAndProblems = getSectionValue(text, '检查发现缺陷和问题', ['处理措施']);
  const handlingMeasures = getSectionValue(text, '处理措施', ['发布日期']);
  const publishDateText = getSingleLineValue(text, '发布日期');

  return {
    sequence_no: 1,
    title,
    company_name: companyName || null,
    production_license_no: productionLicenseNo || null,
    social_credit_code: socialCreditCode || null,
    company_address: companyAddress || null,
    inspection_unit: inspectionUnit || null,
    inspection_basis: inspectionBasis || null,
    defects_and_problems: defectsAndProblems || null,
    handling_measures: handlingMeasures || null,
    publish_date: parseChineseDate(publishDateText),
    publish_date_text: publishDateText || null,
    raw_text: text
  };
}

async function parseFlightInspectionAttachment(filePath) {
  const extracted = await extractAttachmentText(filePath);

  if (!extracted.supported) {
    return {
      supported: false,
      attachment_type: extracted.attachment_type,
      parsedCount: 0,
      rows: [],
      message: '当前仅支持自动解析 Word/Excel 附件，其他附件会保留下载能力。'
    };
  }

  const detail = parseFlightInspectionText(extracted.rawText);
  const rows = detail ? [detail] : [];

  return {
    supported: true,
    attachment_type: extracted.attachment_type,
    parsedCount: rows.length,
    rows,
    message: rows.length > 0 ? '' : '未从附件中识别到飞行检查明细。'
  };
}

const FLIGHT_INSPECTION_DETAIL_COLUMNS = [
  { name: 'supervision_id', definition: 'INT NULL' },
  { name: 'sequence_no', definition: 'INT NOT NULL DEFAULT 1' },
  { name: 'title', definition: 'VARCHAR(255) NULL' },
  { name: 'production_license_no', definition: 'VARCHAR(255) NULL' },
  { name: 'social_credit_code', definition: 'VARCHAR(255) NULL' },
  { name: 'inspection_unit', definition: 'VARCHAR(255) NULL' },
  { name: 'inspection_basis', definition: 'LONGTEXT NULL' },
  { name: 'defects_and_problems', definition: 'LONGTEXT NULL' },
  { name: 'handling_measures', definition: 'LONGTEXT NULL' },
  { name: 'publish_date_text', definition: 'VARCHAR(100) NULL' },
  { name: 'raw_text', definition: 'LONGTEXT NULL' },
  { name: 'attachment_name', definition: 'VARCHAR(255) NULL' },
  { name: 'attachment_path', definition: 'VARCHAR(500) NULL' },
  { name: 'created_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  { name: 'updated_at', definition: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
];


const FLIGHT_INSPECTION_DETAIL_LEGACY_MAPPINGS = [
  { newColumn: 'production_license_no', legacyColumn: 'license_code' },
  { newColumn: 'social_credit_code', legacyColumn: 'credit_code' },
  { newColumn: 'inspection_unit', legacyColumn: 'inspect_org' },
  { newColumn: 'inspection_basis', legacyColumn: 'inspect_basis' },
  { newColumn: 'defects_and_problems', legacyColumn: 'defect_problem' },
  { newColumn: 'handling_measures', legacyColumn: 'measure' }
];

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

async function ensureFlightInspectionDetailTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS flight_inspection_detail (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supervision_id INT NOT NULL,
      sequence_no INT NOT NULL DEFAULT 1,
      title VARCHAR(255),
      company_name VARCHAR(255),
      production_license_no VARCHAR(255),
      social_credit_code VARCHAR(255),
      company_address TEXT,
      inspection_unit VARCHAR(255),
      inspection_basis LONGTEXT,
      defects_and_problems LONGTEXT,
      handling_measures LONGTEXT,
      publish_date DATE NULL,
      publish_date_text VARCHAR(100),
      raw_text LONGTEXT,
      attachment_name VARCHAR(255),
      attachment_path VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_flight_inspection_detail_supervision
        FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE,
      INDEX idx_flight_inspection_detail_supervision (supervision_id),
      INDEX idx_flight_inspection_detail_company_name (company_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const column of FLIGHT_INSPECTION_DETAIL_COLUMNS) {
    await ensureColumnExists(connection, 'flight_inspection_detail', column.name, column.definition);
  }

  await ensureIndexExists(
    connection,
    'flight_inspection_detail',
    'idx_flight_inspection_detail_supervision',
    'ALTER TABLE flight_inspection_detail ADD INDEX idx_flight_inspection_detail_supervision (supervision_id)'
  );
  await ensureIndexExists(
    connection,
    'flight_inspection_detail',
    'idx_flight_inspection_detail_company_name',
    'ALTER TABLE flight_inspection_detail ADD INDEX idx_flight_inspection_detail_company_name (company_name)'
  );

  const [columnRows] = await connection.query('SHOW COLUMNS FROM flight_inspection_detail');
  const existingColumns = new Set(columnRows.map((row) => row.Field));
  const legacyMappings = FLIGHT_INSPECTION_DETAIL_LEGACY_MAPPINGS.filter(
    ({ newColumn, legacyColumn }) => existingColumns.has(newColumn) && existingColumns.has(legacyColumn)
  );

  if (legacyMappings.length > 0) {
    const assignments = legacyMappings.map(
      ({ newColumn, legacyColumn }) => `${newColumn} = COALESCE(${newColumn}, ${legacyColumn})`
    );
    const conditions = legacyMappings.map(
      ({ newColumn, legacyColumn }) => `(${newColumn} IS NULL AND ${legacyColumn} IS NOT NULL)`
    );

    await connection.query(`
      UPDATE flight_inspection_detail
      SET ${assignments.join(', ')}
      WHERE ${conditions.join(' OR ')}
    `);
  }
}


async function replaceFlightInspectionDetails(connection, supervisionId, rows) {
  await connection.query('DELETE FROM flight_inspection_detail WHERE supervision_id = ?', [supervisionId]);

  if (!rows || rows.length === 0) {
    return;
  }

  for (const row of rows) {
    await connection.query(
      `
        INSERT INTO flight_inspection_detail (
          supervision_id, sequence_no, title, company_name, production_license_no,
          social_credit_code, company_address, inspection_unit, inspection_basis,
          defects_and_problems, handling_measures, publish_date, publish_date_text, raw_text,
          attachment_name, attachment_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        supervisionId,
        row.sequence_no || 1,
        row.title || null,
        row.company_name || null,
        row.production_license_no || null,
        row.social_credit_code || null,
        row.company_address || null,
        row.inspection_unit || null,
        row.inspection_basis || null,
        row.defects_and_problems || null,
        row.handling_measures || null,
        row.publish_date || null,
        row.publish_date_text || null,
        row.raw_text || null,
        row.attachment_name || null,
        row.attachment_path || null
      ]
    );

  }
}

module.exports = {
  parseFlightInspectionText,
  parseFlightInspectionAttachment,
  ensureFlightInspectionDetailTable,
  replaceFlightInspectionDetails
};
