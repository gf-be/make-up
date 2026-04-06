const path = require('path');
const WordExtractor = require('word-extractor');
const XLSX = require('xlsx');

const extractor = new WordExtractor();

const BASE_FIELDS = [
  'product_name',
  'company_names',
  'company_addresses',
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
  'remarks'
];

const DB_FIELDS = [
  'sequence_no',
  ...BASE_FIELDS,
  'is_counterfeit'
];

function normalizeToken(token) {
  return String(token || '')
    .replace(/\u0007/g, ' ')
    .replace(/\r\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function isSequenceToken(token) {
  return /^\d{1,4}$/.test(token);
}

function isFooterToken(token) {
  return token.startsWith('以下批次抽检不符合规定化妆品涉嫌假冒') || token.startsWith('注1：');
}

function cleanupUnqualifiedItem(value) {
  return normalizeToken(value).replace(/([\u4e00-\u9fa5A-Za-z）\)])1$/, '$1');
}

function finalizeDetailText(primaryValue, extraValues, formatter = normalizeToken) {
  return [primaryValue, ...extraValues]
    .map((value) => formatter(value))
    .filter(Boolean)
    .join('\n');
}


function buildCounterfeitFlag(remarks) {
  return /假冒|真实性异议|未生产或者进口过该批次抽检不符合规定产品/.test(remarks || '') ? 1 : 0;
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

function parseAnnouncementProductDetails(rawText) {
  const tokens = String(rawText || '')
    .split('\t')
    .map(normalizeToken)
    .filter(Boolean);

  const headerIndex = tokens.findIndex((token) => token === '备注');
  let index = headerIndex >= 0 ? headerIndex + 1 : 0;

  while (index < tokens.length && !isSequenceToken(tokens[index])) {
    index += 1;
  }

  const records = [];

  while (index < tokens.length) {
    if (!isSequenceToken(tokens[index])) {
      index += 1;
      continue;
    }

    const record = {
      sequence_no: Number(tokens[index])
    };
    index += 1;

    for (const field of BASE_FIELDS) {
      if (index >= tokens.length) {
        break;
      }
      record[field] = tokens[index];
      index += 1;
    }

    if (!record.product_name) {
      continue;
    }

    const extraItems = [];
    const extraResults = [];
    const extraRequirements = [];

    while (index < tokens.length && !isSequenceToken(tokens[index])) {
      const currentToken = tokens[index];

      if (!currentToken || isFooterToken(currentToken)) {
        index += 1;
        continue;
      }

      const nextToken = tokens[index + 1];
      const thirdToken = tokens[index + 2];

      if (nextToken && thirdToken && !isSequenceToken(nextToken) && !isSequenceToken(thirdToken)) {
        extraItems.push(currentToken);
        extraResults.push(nextToken);
        extraRequirements.push(thirdToken);
        index += 3;
        continue;
      }

      if (!record.remarks || record.remarks === '/') {
        record.remarks = currentToken;
      } else {
        record.remarks = `${record.remarks}\n${currentToken}`;
      }
      index += 1;
    }

    record.unqualified_items = finalizeDetailText(record.unqualified_items, extraItems, cleanupUnqualifiedItem);
    record.inspection_result = finalizeDetailText(record.inspection_result, extraResults);
    record.requirement = finalizeDetailText(record.requirement, extraRequirements);

    record.remarks = normalizeToken(record.remarks || '/');
    record.is_counterfeit = buildCounterfeitFlag(record.remarks);

    records.push(record);
  }

  return records;
}

async function parseAnnouncementAttachment(filePath) {
  const extracted = await extractAttachmentText(filePath);

  if (!extracted.supported) {
    return {
      supported: false,
      attachment_type: extracted.attachment_type,
      parsedCount: 0,
      counterfeitCount: 0,
      rows: [],
      message: '当前仅支持自动解析 Word/Excel 附件，其他附件会保留下载能力。'
    };
  }

  const rows = parseAnnouncementProductDetails(extracted.rawText);
  const counterfeitCount = rows.filter((item) => item.is_counterfeit === 1).length;

  return {
    supported: true,
    attachment_type: extracted.attachment_type,
    parsedCount: rows.length,
    counterfeitCount,
    rows,
    message: rows.length > 0 ? '' : '未从附件中识别到批次明细表格。'
  };
}

async function ensureAnnouncementProductDetailsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcement_product_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      announcement_id INT NOT NULL,
      sequence_no INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      company_names TEXT,
      company_addresses TEXT,
      sample_unit_name VARCHAR(500),
      sample_unit_address TEXT,
      package_spec VARCHAR(255),
      batch_no VARCHAR(255),
      production_date VARCHAR(100),
      expiry_date VARCHAR(255),
      product_region VARCHAR(255),
      registration_no VARCHAR(255),
      production_license_no VARCHAR(255),
      inspection_institution VARCHAR(255),
      unqualified_items LONGTEXT,
      inspection_result LONGTEXT,
      requirement LONGTEXT,
      remarks LONGTEXT,
      is_counterfeit TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_announcement_product_details_announcement
        FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
      INDEX idx_apd_announcement_id (announcement_id),
      INDEX idx_apd_sequence_no (sequence_no),
      INDEX idx_apd_product_name (product_name),
      INDEX idx_apd_is_counterfeit (is_counterfeit)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function replaceAnnouncementProductDetails(connection, announcementId, rows) {
  await connection.query('DELETE FROM announcement_product_details WHERE announcement_id = ?', [announcementId]);

  if (!rows || rows.length === 0) {
    return;
  }

  const placeholders = DB_FIELDS.map(() => '?').join(', ');
  const sql = `
    INSERT INTO announcement_product_details (${DB_FIELDS.join(', ')}, announcement_id)
    VALUES (${placeholders}, ?)
  `;

  for (const row of rows) {
    const values = DB_FIELDS.map((field) => row[field] ?? null);
    values.push(announcementId);
    await connection.query(sql, values);
  }
}

async function getAnnouncementProductDetailSummary(pool, announcementId) {
  const [rows] = await pool.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_counterfeit = 1 THEN 1 ELSE 0 END) AS counterfeit_count
      FROM announcement_product_details
      WHERE announcement_id = ?
    `,
    [announcementId]
  );

  return {
    total: Number(rows[0]?.total || 0),
    counterfeit_count: Number(rows[0]?.counterfeit_count || 0)
  };
}

module.exports = {
  ensureAnnouncementProductDetailsTable,
  parseAnnouncementAttachment,
  replaceAnnouncementProductDetails,
  getAnnouncementProductDetailSummary
};
