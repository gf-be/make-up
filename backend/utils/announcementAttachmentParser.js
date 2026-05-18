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
  ...(() => {
    const fields = [...BASE_FIELDS];
    const insertAt = fields.indexOf('product_region');
    if (insertAt >= 0) {
      fields.splice(insertAt + 1, 0, 'attachment_sampling_category');
    } else {
      fields.push('attachment_sampling_category');
    }
    return fields;
  })(),
  'manufacturer_name',
  'manufacturer_address',
  'operator_name',
  'operator_address',
  'picture_url',
  'food_body_text',
  'is_counterfeit'
];

const ENTITY_LABEL_PATTERN = /(注册人|备案人|受托生产企业|委托生产企业|标称生产企业|生产企业|境内责任人|经销商|经营企业|经营者|被抽样单位)[：:]/g;
const MANUFACTURER_LABELS = ['受托生产企业', '委托生产企业', '标称生产企业', '生产企业'];
const OPERATOR_LABELS = ['经营企业', '经营者', '经销商', '被抽样单位'];

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

function stripEdgeSeparators(value) {
  return normalizeToken(value).replace(/^[，,；;\s]+|[，,；;\s]+$/g, '');
}

function parseLabeledEntityParts(value) {
  const text = normalizeToken(value);
  if (!text) {
    return [];
  }

  const matches = [];
  let match = ENTITY_LABEL_PATTERN.exec(text);
  while (match) {
    matches.push({
      label: match[1],
      start: match.index,
      valueStart: ENTITY_LABEL_PATTERN.lastIndex
    });
    match = ENTITY_LABEL_PATTERN.exec(text);
  }
  ENTITY_LABEL_PATTERN.lastIndex = 0;

  return matches.map((item, index) => {
    const next = matches[index + 1];
    return {
      label: item.label,
      value: stripEdgeSeparators(text.slice(item.valueStart, next ? next.start : text.length))
    };
  }).filter((item) => item.value);
}

function getFirstEntityValue(value, labels) {
  const parts = parseLabeledEntityParts(value);
  for (const label of labels) {
    const item = parts.find((part) => part.label === label);
    if (item?.value) {
      return item.value;
    }
  }
  return '';
}

function buildStructuredCompanyFields(record) {
  const manufacturerName = getFirstEntityValue(record.company_names, MANUFACTURER_LABELS)
    || normalizeToken(record.company_names);
  const manufacturerAddress = getFirstEntityValue(record.company_addresses, MANUFACTURER_LABELS)
    || normalizeToken(record.company_addresses);
  const operatorName = normalizeToken(record.sample_unit_name)
    || getFirstEntityValue(record.company_names, OPERATOR_LABELS);
  const operatorAddress = normalizeToken(record.sample_unit_address)
    || getFirstEntityValue(record.company_addresses, OPERATOR_LABELS);

  return {
    manufacturer_name: manufacturerName || null,
    manufacturer_address: manufacturerAddress || null,
    operator_name: operatorName || null,
    operator_address: operatorAddress || null
  };
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
    Object.assign(record, buildStructuredCompanyFields(record));

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
      manufacturer_name VARCHAR(500),
      manufacturer_address TEXT,
      operator_name VARCHAR(500),
      operator_address TEXT,
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

  await ensureDetailColumn(pool, 'manufacturer_name', 'VARCHAR(500) NULL AFTER company_addresses');
  await ensureDetailColumn(pool, 'manufacturer_address', 'TEXT NULL AFTER manufacturer_name');
  await ensureDetailColumn(pool, 'operator_name', 'VARCHAR(500) NULL AFTER manufacturer_address');
  await ensureDetailColumn(pool, 'operator_address', 'TEXT NULL AFTER operator_name');
  await ensureDetailColumn(pool, 'attachment_sampling_category', 'VARCHAR(191) NULL AFTER product_region');
  await ensureDetailColumn(pool, 'picture_url', 'VARCHAR(768) NULL AFTER remarks');
  await ensureDetailColumn(pool, 'food_body_text', 'LONGTEXT NULL AFTER picture_url');

  await pool.query(`
    UPDATE announcement_product_details
    SET
      manufacturer_name = COALESCE(NULLIF(TRIM(manufacturer_name), ''), company_names),
      manufacturer_address = COALESCE(NULLIF(TRIM(manufacturer_address), ''), company_addresses),
      operator_name = COALESCE(NULLIF(TRIM(operator_name), ''), sample_unit_name),
      operator_address = COALESCE(NULLIF(TRIM(operator_address), ''), sample_unit_address)
    WHERE manufacturer_name IS NULL
       OR manufacturer_address IS NULL
       OR operator_name IS NULL
       OR operator_address IS NULL
  `);
}

async function ensureDetailColumn(pool, columnName, definition) {
  const [rows] = await pool.query('SHOW COLUMNS FROM announcement_product_details LIKE ?', [columnName]);
  if (rows.length === 0) {
    try {
      await pool.query(`ALTER TABLE announcement_product_details ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
}

async function replaceAnnouncementProductDetails(connection, announcementId, rows) {
  await ensureAnnouncementProductDetailsTable(connection);
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
