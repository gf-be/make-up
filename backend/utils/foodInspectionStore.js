const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_FOOD_JSON_DIR = path.join(PROJECT_ROOT, 'data_get', 'output', 'items');

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\u0007/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function normalizeMultiline(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\u0007/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeNullableMultiline(value) {
  const text = normalizeMultiline(value);
  return text || null;
}

function normalizeDate(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const exact = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (exact) {
    return `${exact[1]}-${String(exact[2]).padStart(2, '0')}-${String(exact[3]).padStart(2, '0')}`;
  }
  const chinese = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chinese) {
    return `${chinese[1]}-${String(chinese[2]).padStart(2, '0')}-${String(chinese[3]).padStart(2, '0')}`;
  }
  return null;
}

function parseJsonSafely(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function ensureColumn(connection, tableName, columnName, definition) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
    }
  }
}

async function ensureIndex(connection, tableName, indexName, definition) {
  const [rows] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD ${definition}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_KEYNAME') throw error;
    }
  }
}

async function ensureFoodInspectionSchema(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS food_inspection (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      announcement_no VARCHAR(100) NULL,
      publish_date DATE NULL,
      source_detail_url VARCHAR(500) NULL,
      source_page VARCHAR(500) NULL,
      notice_category VARCHAR(100) NULL,
      notice_category_label VARCHAR(100) NULL,
      classification_status VARCHAR(50) NULL,
      content_text LONGTEXT NULL,
      content_preview LONGTEXT NULL,
      attachment_count INT DEFAULT 0,
      parsed_detail_count INT DEFAULT 0,
      staging_batch_id INT NULL,
      published_announcement_id INT NULL,
      raw_payload LONGTEXT NULL,
      source_json_file VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_food_inspection_source_url (source_detail_url(191)),
      INDEX idx_food_inspection_publish_date (publish_date),
      INDEX idx_food_inspection_category (notice_category),
      INDEX idx_food_inspection_staging (staging_batch_id),
      INDEX idx_food_inspection_published (published_announcement_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn(connection, 'food_inspection', 'source_json_file', 'VARCHAR(500) NULL AFTER raw_payload');
  await ensureIndex(connection, 'food_inspection', 'idx_food_inspection_publish_date', 'INDEX idx_food_inspection_publish_date (publish_date)');
  await ensureIndex(connection, 'food_inspection', 'idx_food_inspection_category', 'INDEX idx_food_inspection_category (notice_category)');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS food_inspection_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      food_inspection_id INT NOT NULL,
      attachment_name VARCHAR(500) NOT NULL,
      attachment_url VARCHAR(800) NULL,
      local_path VARCHAR(800) NULL,
      file_ext VARCHAR(50) NULL,
      attachment_type VARCHAR(80) NULL,
      supported TINYINT(1) DEFAULT 0,
      parsed_count INT DEFAULT 0,
      parse_message VARCHAR(1000) NULL,
      raw_payload LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (food_inspection_id) REFERENCES food_inspection(id) ON DELETE CASCADE,
      INDEX idx_food_attachment_notice (food_inspection_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS food_inspection_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      food_inspection_id INT NOT NULL,
      attachment_id INT NULL,
      sequence_no INT NOT NULL DEFAULT 1,
      product_name VARCHAR(500) NOT NULL,
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
      inspection_institution VARCHAR(255) NULL,
      unqualified_items LONGTEXT NULL,
      inspection_result LONGTEXT NULL,
      requirement LONGTEXT NULL,
      remarks LONGTEXT NULL,
      raw_payload LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (food_inspection_id) REFERENCES food_inspection(id) ON DELETE CASCADE,
      FOREIGN KEY (attachment_id) REFERENCES food_inspection_attachments(id) ON DELETE SET NULL,
      INDEX idx_food_product_notice (food_inspection_id),
      INDEX idx_food_product_name (product_name),
      INDEX idx_food_product_company (company_names(191)),
      INDEX idx_food_product_issue (unqualified_items(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn(connection, 'food_inspection_products', 'manufacturer_name', 'VARCHAR(500) NULL AFTER company_addresses');
  await ensureColumn(connection, 'food_inspection_products', 'manufacturer_address', 'TEXT NULL AFTER manufacturer_name');
  await ensureColumn(connection, 'food_inspection_products', 'operator_name', 'VARCHAR(500) NULL AFTER manufacturer_address');
  await ensureColumn(connection, 'food_inspection_products', 'operator_address', 'TEXT NULL AFTER operator_name');
}

function getPayloadAttachments(payload = {}) {
  return Array.isArray(payload.attachments) ? payload.attachments : [];
}

function getParsedRows(attachment = {}) {
  const rows = attachment?.parse_result?.rows;
  return Array.isArray(rows) ? rows : [];
}

function countParsedRows(payload = {}) {
  return getPayloadAttachments(payload).reduce((sum, attachment) => sum + getParsedRows(attachment).length, 0);
}

function normalizeProductRow(row = {}, sequenceNo = 1) {
  return {
    sequence_no: Number.parseInt(row.sequence_no, 10) || sequenceNo,
    product_name: normalizeNullableText(row.product_name),
    company_names: normalizeNullableMultiline(row.company_names),
    company_addresses: normalizeNullableMultiline(row.company_addresses),
    manufacturer_name: normalizeNullableText(row.manufacturer_name || row.company_names),
    manufacturer_address: normalizeNullableMultiline(row.manufacturer_address || row.company_addresses),
    operator_name: normalizeNullableText(row.operator_name || row.sample_unit_name),
    operator_address: normalizeNullableMultiline(row.operator_address || row.sample_unit_address),
    sample_unit_name: normalizeNullableText(row.sample_unit_name),
    sample_unit_address: normalizeNullableMultiline(row.sample_unit_address),
    package_spec: normalizeNullableText(row.package_spec),
    batch_no: normalizeNullableText(row.batch_no),
    production_date: normalizeNullableText(row.production_date),
    expiry_date: normalizeNullableText(row.expiry_date),
    product_region: normalizeNullableText(row.product_region || row.province),
    inspection_institution: normalizeNullableText(row.inspection_institution),
    unqualified_items: normalizeNullableMultiline(row.unqualified_items),
    inspection_result: normalizeNullableMultiline(row.inspection_result),
    requirement: normalizeNullableMultiline(row.requirement),
    remarks: normalizeNullableMultiline(row.remarks) || '/',
    raw_payload: JSON.stringify(row || {})
  };
}

async function upsertFoodInspectionPayload(connection, payload = {}, sourceJsonFile = null) {
  await ensureFoodInspectionSchema(connection);

  const sourceDetailUrl = normalizeNullableText(payload.source_detail_url || payload.detail_url);
  const title = normalizeNullableText(payload.title) || '食品抽检通报';
  const rawPayload = JSON.stringify(payload || {});
  const attachmentCount = getPayloadAttachments(payload).length;
  const parsedDetailCount = countParsedRows(payload);

  let foodInspectionId = null;
  if (sourceDetailUrl) {
    const [existingRows] = await connection.query(
      'SELECT id FROM food_inspection WHERE source_detail_url = ? LIMIT 1',
      [sourceDetailUrl]
    );
    foodInspectionId = existingRows[0]?.id || null;
  }

  const values = [
    title,
    normalizeNullableText(payload.announcement_no),
    normalizeDate(payload.publish_date),
    sourceDetailUrl,
    normalizeNullableText(payload.source_page),
    normalizeNullableText(payload.notice_category),
    normalizeNullableText(payload.notice_category_label),
    normalizeNullableText(payload.classification_status),
    normalizeNullableMultiline(payload.content_text || payload.content),
    normalizeNullableMultiline(payload.content_preview),
    attachmentCount,
    parsedDetailCount,
    rawPayload,
    sourceJsonFile
  ];

  if (foodInspectionId) {
    await connection.query(
      `
        UPDATE food_inspection
        SET title = ?, announcement_no = ?, publish_date = ?, source_detail_url = ?,
            source_page = ?, notice_category = ?, notice_category_label = ?,
            classification_status = ?, content_text = ?, content_preview = ?,
            attachment_count = ?, parsed_detail_count = ?, raw_payload = ?,
            source_json_file = ?, updated_at = NOW()
        WHERE id = ?
      `,
      [...values, foodInspectionId]
    );
  } else {
    const [result] = await connection.query(
      `
        INSERT INTO food_inspection (
          title, announcement_no, publish_date, source_detail_url, source_page,
          notice_category, notice_category_label, classification_status,
          content_text, content_preview, attachment_count, parsed_detail_count,
          raw_payload, source_json_file
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      values
    );
    foodInspectionId = result.insertId;
  }

  await connection.query('DELETE FROM food_inspection_products WHERE food_inspection_id = ?', [foodInspectionId]);
  await connection.query('DELETE FROM food_inspection_attachments WHERE food_inspection_id = ?', [foodInspectionId]);

  let insertedAttachmentCount = 0;
  let insertedProductCount = 0;
  const attachments = getPayloadAttachments(payload);

  for (const [attachmentIndex, attachment] of attachments.entries()) {
    const parseResult = attachment.parse_result || {};
    const rows = getParsedRows(attachment);
    const [attachmentResult] = await connection.query(
      `
        INSERT INTO food_inspection_attachments (
          food_inspection_id, attachment_name, attachment_url, local_path,
          file_ext, attachment_type, supported, parsed_count, parse_message, raw_payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        foodInspectionId,
        normalizeNullableText(attachment.attachment_name) || `附件${attachmentIndex + 1}`,
        normalizeNullableText(attachment.attachment_url),
        normalizeNullableText(attachment.local_path),
        normalizeNullableText(attachment.file_ext),
        normalizeNullableText(parseResult.attachment_type),
        parseResult.supported ? 1 : 0,
        rows.length,
        normalizeNullableText(parseResult.message),
        JSON.stringify(attachment || {})
      ]
    );
    insertedAttachmentCount += 1;
    const attachmentId = attachmentResult.insertId;

    for (const [rowIndex, row] of rows.entries()) {
      const normalized = normalizeProductRow(row, rowIndex + 1);
      if (!normalized.product_name) continue;
      await connection.query(
        `
          INSERT INTO food_inspection_products (
            food_inspection_id, attachment_id, sequence_no, product_name,
            company_names, company_addresses, manufacturer_name, manufacturer_address,
            operator_name, operator_address, sample_unit_name, sample_unit_address,
            package_spec, batch_no, production_date, expiry_date, product_region,
            inspection_institution, unqualified_items, inspection_result,
            requirement, remarks, raw_payload
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          foodInspectionId,
          attachmentId,
          normalized.sequence_no,
          normalized.product_name,
          normalized.company_names,
          normalized.company_addresses,
          normalized.manufacturer_name,
          normalized.manufacturer_address,
          normalized.operator_name,
          normalized.operator_address,
          normalized.sample_unit_name,
          normalized.sample_unit_address,
          normalized.package_spec,
          normalized.batch_no,
          normalized.production_date,
          normalized.expiry_date,
          normalized.product_region,
          normalized.inspection_institution,
          normalized.unqualified_items,
          normalized.inspection_result,
          normalized.requirement,
          normalized.remarks,
          normalized.raw_payload
        ]
      );
      insertedProductCount += 1;
    }
  }

  return {
    id: Number(foodInspectionId),
    title,
    source_detail_url: sourceDetailUrl,
    attachment_count: insertedAttachmentCount,
    product_count: insertedProductCount
  };
}

async function importFoodInspectionJsonDirectory(connection, directoryPath = DEFAULT_FOOD_JSON_DIR) {
  await ensureFoodInspectionSchema(connection);
  const normalizedDir = path.resolve(directoryPath);
  if (!fs.existsSync(normalizedDir)) {
    throw new Error(`未找到食品抽检 JSON 目录：${normalizedDir}`);
  }

  const fileNames = fs.readdirSync(normalizedDir)
    .filter((name) => name.toLowerCase().endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  const items = [];
  const errors = [];
  for (const fileName of fileNames) {
    const filePath = path.join(normalizedDir, fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const payload = parseJsonSafely(raw, null);
    if (!payload || typeof payload !== 'object') {
      errors.push({ file_name: fileName, message: 'JSON 格式错误' });
      continue;
    }
    const productType = normalizeText(payload.product_type || payload?._import_meta?.product_type);
    if (productType && productType !== 'food') {
      continue;
    }
    await connection.beginTransaction();
    try {
      const result = await upsertFoodInspectionPayload(connection, payload, filePath);
      await connection.commit();
      items.push({ file_name: fileName, ...result });
    } catch (error) {
      await connection.rollback();
      errors.push({ file_name: fileName, message: error.message || String(error) });
    }
  }

  return {
    source_dir: normalizedDir,
    total_files: fileNames.length,
    imported_count: items.length,
    error_count: errors.length,
    items,
    errors
  };
}

async function linkFoodInspectionToPublishedAnnouncement(connection, sourceDetailUrl, announcementId, stagingBatchId = null) {
  if (!sourceDetailUrl || !announcementId) return;
  await ensureFoodInspectionSchema(connection);
  await connection.query(
    `
      UPDATE food_inspection
      SET published_announcement_id = ?, staging_batch_id = COALESCE(?, staging_batch_id)
      WHERE source_detail_url = ?
    `,
    [announcementId, stagingBatchId, sourceDetailUrl]
  );
}

module.exports = {
  DEFAULT_FOOD_JSON_DIR,
  ensureFoodInspectionSchema,
  importFoodInspectionJsonDirectory,
  linkFoodInspectionToPublishedAnnouncement,
  upsertFoodInspectionPayload
};
