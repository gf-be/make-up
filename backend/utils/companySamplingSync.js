const {
  normalizeProductType,
  normalizeAnnouncementType
} = require('./productTypeHelpers');
const { extractProvinceCity } = require('./dataAnalysisHelpers');
const {
  normalizeText,
  splitCompanyEntries,
  buildStructuredCompanyFields,
  isInvalidCompanyValue
} = require('./companyFieldParser');


function deriveProvince(region, address) {
  const normalizedRegion = normalizeText(region);
  if (normalizedRegion) {
    return normalizedRegion;
  }

  return extractProvinceCity(address).province === '未标注'
    ? null
    : extractProvinceCity(address).province;
}

function deriveProvinceCity(region, address) {
  const regionProvince = normalizeText(region);
  const fromAddress = extractProvinceCity(address);
  if (fromAddress.province && fromAddress.province !== '未标注') {
    return fromAddress;
  }
  if (regionProvince) {
    return {
      province: regionProvince,
      city: fromAddress.city && fromAddress.city !== '未标注' ? fromAddress.city : '未标注'
    };
  }
  return fromAddress;
}

const COMPANY_TYPES = new Set(['manufacturer', 'distributor', 'seller']);

function normalizeCompanyType(value) {
  const normalized = normalizeText(value);
  return COMPANY_TYPES.has(normalized) ? normalized : 'manufacturer';
}

function parseCompanyTypes(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeCompanyType).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeCompanyType).filter(Boolean);
    }
  } catch {
    // Legacy scalar or CSV values are handled below.
  }
  return text
    .split(/[,，;；|｜\s]+/)
    .map(normalizeCompanyType)
    .filter(Boolean);
}

function mergeCompanyTypes(...values) {
  const merged = [];
  values.flatMap(parseCompanyTypes).forEach((type) => {
    if (!merged.includes(type)) {
      merged.push(type);
    }
  });
  return merged.length ? merged : ['manufacturer'];
}

function parseSourceProductNames(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }
  const text = normalizeText(value);
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeText(item)).filter(Boolean);
    }
  } catch {
    // Legacy scalar values are handled below.
  }
  return text
    .split(/[、,，;；|｜\n]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function mergeSourceProductNames(...values) {
  const merged = [];
  values.flatMap(parseSourceProductNames).forEach((name) => {
    if (!merged.includes(name)) {
      merged.push(name);
    }
  });
  return merged;
}

async function ensureSourceProductNameJsonColumn(connection) {
  const [sourceProductNameColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['source_product_name']);
  const [productCategoryColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['product_category']);
  if (productCategoryColumn.length > 0 && sourceProductNameColumn.length === 0) {
    await connection.query(
      "ALTER TABLE companies CHANGE COLUMN product_category source_product_name VARCHAR(255) NULL COMMENT '来源产品名称'"
    );
  } else if (sourceProductNameColumn.length === 0) {
    await connection.query(
      "ALTER TABLE companies ADD COLUMN source_product_name JSON NULL COMMENT '来源产品名称数组' AFTER city"
    );
    return;
  }

  const [currentColumnRows] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['source_product_name']);
  const currentType = String(currentColumnRows[0]?.Type || '').toLowerCase();
  if (currentType.includes('json')) {
    return;
  }

  await ensureColumnExists(connection, 'companies', 'source_product_name_json_tmp', "JSON NULL COMMENT '来源产品名称数组' AFTER source_product_name");
  const [rows] = await connection.query('SELECT id, source_product_name FROM companies WHERE source_product_name IS NOT NULL AND TRIM(source_product_name) != ? ', ['']);
  for (const row of rows) {
    const names = mergeSourceProductNames(row.source_product_name);
    await connection.query(
      'UPDATE companies SET source_product_name_json_tmp = CAST(? AS JSON) WHERE id = ?',
      [names.length ? JSON.stringify(names) : null, row.id]
    );
  }
  await ensureIndexDropped(connection, 'companies', 'idx_companies_source_product_name');
  await connection.query('ALTER TABLE companies DROP COLUMN source_product_name');
  await connection.query('ALTER TABLE companies CHANGE COLUMN source_product_name_json_tmp source_product_name JSON NULL COMMENT \'来源产品名称数组\' AFTER city');
}

async function ensureIndexDropped(connection, tableName, indexName) {
  const [rows] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length > 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} DROP INDEX ${indexName}`);
    } catch (error) {
      if (error?.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        throw error;
      }
    }
  }
}

async function ensureColumnExists(connection, tableName, columnName, definition) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
}

async function ensureIndexExists(connection, tableName, indexName, definitionSql) {
  const [rows] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD ${definitionSql}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_KEYNAME') {
        throw error;
      }
    }
  }
}


async function ensureCompaniesSamplingSchema(connection) {

  const [sampledCountColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['sampled_count']);
  if (sampledCountColumn.length === 0) {
    await connection.query('ALTER TABLE companies ADD COLUMN sampled_count INT DEFAULT 0 AFTER city');
  }

  const [lastSampledAtColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['last_sampled_at']);
  if (lastSampledAtColumn.length === 0) {
    await connection.query('ALTER TABLE companies ADD COLUMN last_sampled_at DATE NULL AFTER sampled_count');
  }

  await ensureSourceProductNameJsonColumn(connection);
  const [oldCategoryIndex] = await connection.query('SHOW INDEX FROM companies WHERE Key_name = ?', ['idx_companies_product_category']);
  if (oldCategoryIndex.length > 0) {
    try {
      await connection.query('ALTER TABLE companies DROP INDEX idx_companies_product_category');
    } catch (error) {
      if (error?.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        throw error;
      }
    }
  }
  await ensureIndexDropped(connection, 'companies', 'idx_companies_source_product_name');

  await ensureColumnExists(connection, 'companies', 'credit_code', "VARCHAR(18) NULL COMMENT '统一社会信用代码' AFTER brand");
  await ensureColumnExists(connection, 'companies', 'types', "JSON NULL COMMENT '企业类型集合' AFTER type");
  await ensureColumnExists(connection, 'companies', 'is_complained', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否被投诉' AFTER types");
  await connection.query(`
    UPDATE companies
    SET types = JSON_ARRAY(COALESCE(NULLIF(TRIM(type), ''), 'manufacturer'))
    WHERE types IS NULL
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_complaints (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      complaint_content TEXT NOT NULL,
      complaint_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_company_complaints_company (company_id),
      INDEX idx_company_complaints_date (complaint_date),
      CONSTRAINT fk_company_complaints_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumnExists(connection, 'company_complaints', 'complaint_content', 'TEXT NOT NULL AFTER company_id');
  await ensureColumnExists(connection, 'company_complaints', 'complaint_date', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER complaint_content');
  await ensureIndexExists(
    connection,
    'company_complaints',
    'idx_company_complaints_company',
    'INDEX idx_company_complaints_company (company_id)'
  );
  await ensureIndexExists(
    connection,
    'company_complaints',
    'idx_company_complaints_date',
    'INDEX idx_company_complaints_date (complaint_date)'
  );
  await connection.query(`
    UPDATE companies c
    SET is_complained = EXISTS (
      SELECT 1 FROM company_complaints cc WHERE cc.company_id = c.id
    )
  `);
  await ensureIndexExists(
    connection,
    'companies',
    'uk_companies_credit_code',
    'UNIQUE INDEX uk_companies_credit_code (credit_code)'
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_name_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      name_before VARCHAR(200) NOT NULL,
      existing_credit_code VARCHAR(64) NULL,
      attempted_credit_code VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_company_name_history_company (company_id),
      CONSTRAINT fk_company_name_history_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumnExists(connection, 'company_name_history', 'name_before', 'VARCHAR(200) NOT NULL AFTER company_id');
  await ensureColumnExists(connection, 'company_name_history', 'existing_credit_code', 'VARCHAR(64) NULL AFTER name_before');
  await ensureColumnExists(connection, 'company_name_history', 'attempted_credit_code', 'VARCHAR(64) NULL AFTER existing_credit_code');
  await ensureIndexExists(
    connection,
    'company_name_history',
    'idx_company_name_history_company',
    'INDEX idx_company_name_history_company (company_id)'
  );


  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_sampling_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      announcement_id INT NOT NULL,
      announcement_detail_id INT NOT NULL,
      product_name VARCHAR(255),
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
      sampled_at DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_company_sampling_detail_company (announcement_detail_id, company_id),
      INDEX idx_company_sampling_company (company_id),
      INDEX idx_company_sampling_announcement (announcement_id),
      INDEX idx_company_sampling_product_type (product_type),
      INDEX idx_company_sampling_announcement_type (announcement_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_supervision_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      supervision_id INT NOT NULL,
      supervision_detail_id INT NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'flight_inspection',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_company_supervision_company (supervision_id, company_id),
      INDEX idx_company_supervision_company (company_id),
      INDEX idx_company_supervision_supervision (supervision_id),
      INDEX idx_company_supervision_detail (supervision_detail_id),
      INDEX idx_company_supervision_product_type (product_type),
      INDEX idx_company_supervision_announcement_type (announcement_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(connection, 'company_sampling_records', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER product_name");
  await ensureColumnExists(connection, 'company_sampling_records', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'sampling' AFTER product_type");
  await ensureColumnExists(connection, 'company_supervision_records', 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER supervision_detail_id");
  await ensureColumnExists(connection, 'company_supervision_records', 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'flight_inspection' AFTER product_type");
  await ensureIndexExists(connection, 'company_sampling_records', 'idx_company_sampling_product_type', 'INDEX idx_company_sampling_product_type (product_type)');
  await ensureIndexExists(connection, 'company_sampling_records', 'idx_company_sampling_announcement_type', 'INDEX idx_company_sampling_announcement_type (announcement_type)');
  await ensureIndexExists(connection, 'company_supervision_records', 'idx_company_supervision_product_type', 'INDEX idx_company_supervision_product_type (product_type)');
  await ensureIndexExists(connection, 'company_supervision_records', 'idx_company_supervision_announcement_type', 'INDEX idx_company_supervision_announcement_type (announcement_type)');


  await ensureForeignKey(
    connection,
    'company_sampling_records',
    'fk_company_sampling_company',
    'FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE'
  );
  if (await tableExists(connection, 'announcements')) {
    await ensureForeignKey(
      connection,
      'company_sampling_records',
      'fk_company_sampling_announcement',
      'FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'announcement_product_details')) {
    await ensureForeignKey(
      connection,
      'company_sampling_records',
      'fk_company_sampling_detail',
      'FOREIGN KEY (announcement_detail_id) REFERENCES announcement_product_details(id) ON DELETE CASCADE'
    );
  }
  await ensureForeignKey(
    connection,
    'company_supervision_records',
    'fk_company_supervision_company',
    'FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE'
  );
  if (await tableExists(connection, 'supervisions')) {
    await ensureForeignKey(
      connection,
      'company_supervision_records',
      'fk_company_supervision_supervision',
      'FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'flight_inspection_detail')) {
    await ensureForeignKey(
      connection,
      'company_supervision_records',
      'fk_company_supervision_detail',
      'FOREIGN KEY (supervision_detail_id) REFERENCES flight_inspection_detail(id) ON DELETE SET NULL'
    );
  }

  /** 大批量企业 / 抽样明细下，company_id + 筛选条件可走索引 */
  if (await tableExists(connection, 'inspection_details')) {
    await ensureIndexExists(
      connection,
      'inspection_details',
      'idx_inspection_details_company_id',
      'INDEX idx_inspection_details_company_id (company_id)'
    );
    await ensureIndexExists(
      connection,
      'inspection_details',
      'idx_inspection_details_company_result',
      'INDEX idx_inspection_details_company_result (company_id, inspection_result)'
    );
  }

  await ensureIndexExists(
    connection,
    'companies',
    'idx_companies_province_sampled',
    'INDEX idx_companies_province_sampled (province, sampled_count)'
  );

  await ensureIndexExists(
    connection,
    'companies',
    'idx_companies_sampled_updated',
    'INDEX idx_companies_sampled_updated (sampled_count, updated_at)'
  );
}


async function recalculateCompanySampledCount(connection, companyIds = []) {
  if (!companyIds || companyIds.length === 0) {
    return;
  }

  const placeholders = companyIds.map(() => '?').join(', ');
  await connection.query(
    `
      UPDATE companies c
      LEFT JOIN (
        SELECT company_id, COUNT(*) AS sampled_count, MAX(sampled_at) AS last_sampled_at
        FROM company_sampling_records
        WHERE company_id IN (${placeholders})
        GROUP BY company_id
      ) stats ON stats.company_id = c.id
      SET c.sampled_count = COALESCE(stats.sampled_count, 0),
          c.last_sampled_at = stats.last_sampled_at
      WHERE c.id IN (${placeholders})
    `,
    [...companyIds, ...companyIds]
  );
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
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
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definitionSql}`);
    } catch (error) {
      if (error?.code !== 'ER_FK_DUP_NAME') {
        throw error;
      }
    }
  }
}


async function cleanupOrphanSupervisionArtifacts(connection) {
  const result = {
    deleted_relation_count: 0,
    deleted_detail_count: 0,
    deleted_attachment_count: 0
  };

  if (!(await tableExists(connection, 'supervisions'))) {
    return result;
  }

  if (await tableExists(connection, 'company_supervision_records')) {
    const [deleteRelations] = await connection.query(`
      DELETE csr
      FROM company_supervision_records csr
      LEFT JOIN supervisions s ON s.id = csr.supervision_id
      WHERE s.id IS NULL
    `);
    result.deleted_relation_count = Number(deleteRelations.affectedRows || 0);
  }

  if (await tableExists(connection, 'flight_inspection_detail')) {
    const [deleteDetails] = await connection.query(`
      DELETE fid
      FROM flight_inspection_detail fid
      LEFT JOIN supervisions s ON s.id = fid.supervision_id
      WHERE s.id IS NULL
    `);
    result.deleted_detail_count = Number(deleteDetails.affectedRows || 0);
  }

  if (await tableExists(connection, 'supervision_attachments')) {
    const [deleteAttachments] = await connection.query(`
      DELETE sa
      FROM supervision_attachments sa
      LEFT JOIN supervisions s ON s.id = sa.supervision_id
      WHERE s.id IS NULL
    `);
    result.deleted_attachment_count = Number(deleteAttachments.affectedRows || 0);
  }

  return result;
}

async function deleteOrphanCompanies(connection, companyIds = []) {
  await cleanupOrphanSupervisionArtifacts(connection);

  const normalizedCompanyIds = Array.from(new Set(companyIds.map((item) => Number(item)).filter(Boolean)));

  if (normalizedCompanyIds.length === 0) {
    return {
      deleted_count: 0,
      deleted_company_ids: []
    };
  }

  const conditions = [];

  if (await tableExists(connection, 'company_sampling_records')) {
    conditions.push('NOT EXISTS (SELECT 1 FROM company_sampling_records csr WHERE csr.company_id = c.id)');
  }

  if (await tableExists(connection, 'inspection_details')) {
    conditions.push('NOT EXISTS (SELECT 1 FROM inspection_details id WHERE id.company_id = c.id)');
  }

  if (await tableExists(connection, 'company_supervision_records')) {
    conditions.push('NOT EXISTS (SELECT 1 FROM company_supervision_records csr WHERE csr.company_id = c.id)');
  }

  if (await tableExists(connection, 'unqualified_product_companies')) {
    conditions.push('NOT EXISTS (SELECT 1 FROM unqualified_product_companies upc WHERE upc.company_id = c.id)');
  }

  if (await tableExists(connection, 'unqualified_products')) {
    conditions.push('NOT EXISTS (SELECT 1 FROM unqualified_products up WHERE up.company_id = c.id)');
  }

  if (await tableExists(connection, 'flight_inspection_detail')) {
    conditions.push("NOT EXISTS (SELECT 1 FROM flight_inspection_detail fid JOIN supervisions s2 ON s2.id = fid.supervision_id WHERE CONVERT(TRIM(COALESCE(fid.company_name, '')) USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.name USING utf8mb4) COLLATE utf8mb4_unicode_ci)");
  }



  if (await tableExists(connection, 'supervisions')) {
    conditions.push("NOT EXISTS (SELECT 1 FROM supervisions s WHERE CONVERT(TRIM(COALESCE(s.company_name, '')) USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT(c.name USING utf8mb4) COLLATE utf8mb4_unicode_ci)");
  }


  if (conditions.length === 0) {
    return {
      deleted_count: 0,
      deleted_company_ids: []
    };
  }

  const placeholders = normalizedCompanyIds.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `
      SELECT c.id
      FROM companies c
      WHERE c.id IN (${placeholders})
        AND ${conditions.join('\n        AND ')}
    `,
    normalizedCompanyIds
  );

  const orphanCompanyIds = rows.map((item) => Number(item.id)).filter(Boolean);
  if (orphanCompanyIds.length === 0) {
    return {
      deleted_count: 0,
      deleted_company_ids: []
    };
  }

  const deletePlaceholders = orphanCompanyIds.map(() => '?').join(', ');
  await connection.query(
    `DELETE FROM companies WHERE id IN (${deletePlaceholders})`,
    orphanCompanyIds
  );

  return {
    deleted_count: orphanCompanyIds.length,
    deleted_company_ids: orphanCompanyIds
  };
}

async function refreshCompanySourceProductNamesAfterSamplingRemoval(connection, removedRows = []) {
  const byCompany = new Map();
  removedRows.forEach((row) => {
    const companyId = Number(row.company_id);
    const productName = normalizeText(row.product_name);
    if (!companyId || !productName) {
      return;
    }
    if (!byCompany.has(companyId)) {
      byCompany.set(companyId, new Set());
    }
    byCompany.get(companyId).add(productName);
  });

  for (const [companyId, removedNames] of byCompany.entries()) {
    const [companyRows] = await connection.query(
      'SELECT source_product_name FROM companies WHERE id = ? LIMIT 1',
      [companyId]
    );
    if (companyRows.length === 0) {
      continue;
    }

    const [remainingRows] = await connection.query(
      `
        SELECT DISTINCT product_name
        FROM company_sampling_records
        WHERE company_id = ?
          AND product_name IS NOT NULL
          AND TRIM(product_name) != ''
      `,
      [companyId]
    );
    const remainingNames = mergeSourceProductNames(remainingRows.map((row) => row.product_name));
    const remainingNameSet = new Set(remainingNames);
    const existingNames = parseSourceProductNames(companyRows[0].source_product_name);
    const nextNames = [];

    existingNames.forEach((name) => {
      if (!removedNames.has(name) || remainingNameSet.has(name)) {
        nextNames.push(name);
      }
    });
    remainingNames.forEach((name) => {
      if (!nextNames.includes(name)) {
        nextNames.push(name);
      }
    });

    if (nextNames.length) {
      await connection.query(
        'UPDATE companies SET source_product_name = CAST(? AS JSON) WHERE id = ?',
        [JSON.stringify(nextNames), companyId]
      );
    } else {
      await connection.query('UPDATE companies SET source_product_name = NULL WHERE id = ?', [companyId]);
    }
  }
}

async function upsertCompany(
  connection,
  companyName,
  companyAddress,
  province,
  city = null,
  sourceProductName = null,
  companyType = 'manufacturer'
) {
  const normalizedName = normalizeText(companyName);
  if (!normalizedName || isInvalidCompanyValue(normalizedName)) {
    return null;
  }
  const normalizedType = normalizeCompanyType(companyType);

  const [existingRows] = await connection.query(
    'SELECT id, type, types, address, province, city, source_product_name FROM companies WHERE name = ? LIMIT 1',
    [normalizedName]
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const existingMainType = COMPANY_TYPES.has(normalizeText(existing.type)) ? normalizeText(existing.type) : normalizedType;
    const mergedTypes = mergeCompanyTypes(existing.types, existing.type, normalizedType);
    const mergedTypesJson = JSON.stringify(mergedTypes);
    const mergedSourceProductNames = mergeSourceProductNames(existing.source_product_name, sourceProductName);
    const mergedSourceProductNamesJson = mergedSourceProductNames.length ? JSON.stringify(mergedSourceProductNames) : null;
    const shouldUpdateType = existing.type !== existingMainType;
    const shouldUpdateTypes = JSON.stringify(mergeCompanyTypes(existing.types, existing.type)) !== mergedTypesJson;
    const shouldUpdateAddress = (!existing.address && companyAddress);
    const shouldUpdateProvince = (!existing.province && province);
    const shouldUpdateCity = (!existing.city && city);
    const shouldUpdateSourceProductName = JSON.stringify(mergeSourceProductNames(existing.source_product_name)) !== JSON.stringify(mergedSourceProductNames);
    if (shouldUpdateType || shouldUpdateTypes || shouldUpdateAddress || shouldUpdateProvince || shouldUpdateCity || shouldUpdateSourceProductName) {
      await connection.query(
        'UPDATE companies SET type = ?, types = CAST(? AS JSON), address = COALESCE(address, ?), province = COALESCE(province, ?), city = COALESCE(city, ?), source_product_name = CAST(? AS JSON) WHERE id = ?',
        [existingMainType, mergedTypesJson, companyAddress || null, province || null, city || null, mergedSourceProductNamesJson, existing.id]
      );
    }
    return existing.id;
  }

  const [result] = await connection.query(
    `
      INSERT INTO companies (name, type, types, address, province, city, source_product_name, sampled_count, last_sampled_at)
      VALUES (?, ?, CAST(? AS JSON), ?, ?, ?, CAST(? AS JSON), 0, NULL)
    `,
    [normalizedName, normalizedType, JSON.stringify([normalizedType]), companyAddress || null, province || null, city || null, sourceProductName ? JSON.stringify([normalizeText(sourceProductName)]) : null]
  );

  return result.insertId;
}


async function syncCompaniesFromAnnouncementDetails(connection, announcementId, publishDate = null) {
  await ensureCompaniesSamplingSchema(connection);

  const [announcementRows] = await connection.query(
    `
      SELECT publish_date, product_type, announcement_type
      FROM announcements
      WHERE id = ?
      LIMIT 1
    `,
    [announcementId]
  );
  const announcement = announcementRows[0] || {};
  const sampledAt = publishDate || announcement.publish_date || null;
  const productType = normalizeProductType(announcement.product_type);
  const announcementType = normalizeAnnouncementType(announcement.announcement_type || 'sampling');

  const [oldCompanyRows] = await connection.query(
    'SELECT DISTINCT company_id FROM company_sampling_records WHERE announcement_id = ?',
    [announcementId]
  );
  const affectedCompanyIds = new Set(oldCompanyRows.map((item) => Number(item.company_id)).filter(Boolean));
  const currentCompanyIds = new Set();

  await connection.query('DELETE FROM company_sampling_records WHERE announcement_id = ?', [announcementId]);

  const [detailRows] = await connection.query(
    `
      SELECT id, product_name, company_names, company_addresses,
             manufacturer_name, manufacturer_address, operator_name, operator_address,
             sample_unit_name, sample_unit_address, product_region
      FROM announcement_product_details
      WHERE announcement_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [announcementId]
  );


  for (const detail of detailRows) {
    const structured = buildStructuredCompanyFields(
      productType,
      detail.company_names,
      detail.company_addresses,
      {
        manufacturer_name: detail.manufacturer_name,
        manufacturer_address: detail.manufacturer_address,
        operator_name: detail.operator_name,
        operator_address: detail.operator_address,
        sample_unit_name: detail.sample_unit_name,
        sample_unit_address: detail.sample_unit_address
      }
    );
    const companyEntries = structured.company_entries || [];
    const linkedDetailCompanyIds = new Set();

    for (const entry of companyEntries) {
      if (!entry?.name || isInvalidCompanyValue(entry.name)) {
        continue;
      }
      const companyName = entry.name;
      const companyAddress = entry.address;
      const region = deriveProvinceCity(detail.product_region, companyAddress);
      const sourceProductName = normalizeText(detail.product_name) || null;
      const companyId = await upsertCompany(
        connection,
        companyName,
        companyAddress,
        region.province === '未标注' ? null : region.province,
        region.city === '未标注' ? null : region.city,
        sourceProductName,
        entry.type
      );

      if (!companyId) {
        continue;
      }

      const normalizedCompanyId = Number(companyId);
      if (linkedDetailCompanyIds.has(normalizedCompanyId)) {
        continue;
      }
      linkedDetailCompanyIds.add(normalizedCompanyId);
      affectedCompanyIds.add(normalizedCompanyId);
      currentCompanyIds.add(normalizedCompanyId);

      await connection.query(
        `
          INSERT INTO company_sampling_records (
            company_id, announcement_id, announcement_detail_id, product_name,
            product_type, announcement_type, sampled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          companyId,
          announcementId,
          detail.id,
          detail.product_name || null,
          productType,
          announcementType,
          sampledAt
        ]
      );

    }
  }

  await recalculateCompanySampledCount(connection, Array.from(affectedCompanyIds));
  const cleanupResult = await deleteOrphanCompanies(connection, Array.from(affectedCompanyIds));

  return {
    company_count: currentCompanyIds.size,
    deleted_company_count: cleanupResult.deleted_count,
    detail_count: detailRows.length
  };
}

async function syncCompaniesFromFlightInspectionDetails(connection, supervisionId) {
  await ensureCompaniesSamplingSchema(connection);

  const [oldCompanyRows] = await connection.query(
    'SELECT DISTINCT company_id FROM company_supervision_records WHERE supervision_id = ?',
    [supervisionId]
  );
  const affectedCompanyIds = new Set(oldCompanyRows.map((item) => Number(item.company_id)).filter(Boolean));
  const currentCompanyIds = new Set();
  const linkedCompanyIds = new Set();

  await connection.query('DELETE FROM company_supervision_records WHERE supervision_id = ?', [supervisionId]);

  const [detailRows] = await connection.query(
    `
      SELECT id, company_name, company_address
      FROM flight_inspection_detail
      WHERE supervision_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [supervisionId]
  );
  const [supervisionRows] = await connection.query(
    `
      SELECT company_name, company_address, product_type, announcement_type
      FROM supervisions
      WHERE id = ?
      LIMIT 1
    `,
    [supervisionId]
  );
  const supervision = supervisionRows[0] || {};
  const productType = normalizeProductType(supervision.product_type);
  const announcementType = normalizeAnnouncementType(supervision.announcement_type || 'flight_inspection');


  const sourceRows = [...detailRows];
  if (supervision.company_name) {
    sourceRows.push({
      id: null,
      company_name: supervision.company_name,
      company_address: supervision.company_address
    });
  }


  for (const detail of sourceRows) {
    const companyName = normalizeText(detail.company_name);
    if (!companyName) {
      continue;
    }

    const companyAddress = normalizeText(detail.company_address) || null;
    const region = deriveProvinceCity(null, companyAddress);
    const sourceProductName = normalizeText(detail.product_name) || null;
    const companyId = await upsertCompany(
      connection,
      companyName,
      companyAddress,
      region.province === '未标注' ? null : region.province,
      region.city === '未标注' ? null : region.city,
      sourceProductName
    );

    if (!companyId) {
      continue;
    }

    const normalizedCompanyId = Number(companyId);
    affectedCompanyIds.add(normalizedCompanyId);
    currentCompanyIds.add(normalizedCompanyId);

    if (linkedCompanyIds.has(normalizedCompanyId)) {
      continue;
    }

    await connection.query(
      `
        INSERT INTO company_supervision_records (
          company_id, supervision_id, supervision_detail_id, product_type, announcement_type
        )
        VALUES (?, ?, ?, ?, ?)
      `,
      [companyId, supervisionId, detail.id || null, productType, announcementType]
    );

    linkedCompanyIds.add(normalizedCompanyId);
  }

  const cleanupResult = await deleteOrphanCompanies(connection, Array.from(affectedCompanyIds));

  return {
    company_count: currentCompanyIds.size,
    deleted_company_count: cleanupResult.deleted_count,
    detail_count: detailRows.length
  };
}


async function getSupervisionRelatedCompanyIds(connection, supervisionId) {
  await ensureCompaniesSamplingSchema(connection);

  const [relationRows] = await connection.query(
    'SELECT DISTINCT company_id FROM company_supervision_records WHERE supervision_id = ?',
    [supervisionId]
  );
  const relationCompanyIds = relationRows.map((item) => Number(item.company_id)).filter(Boolean);

  if (relationCompanyIds.length > 0) {
    return relationCompanyIds;
  }

  const [detailRows] = await connection.query(
    `
      SELECT DISTINCT TRIM(company_name) AS company_name
      FROM flight_inspection_detail
      WHERE supervision_id = ? AND company_name IS NOT NULL AND TRIM(company_name) != ''
    `,
    [supervisionId]
  );
  const [supervisionRows] = await connection.query(
    `
      SELECT DISTINCT TRIM(company_name) AS company_name
      FROM supervisions
      WHERE id = ? AND company_name IS NOT NULL AND TRIM(company_name) != ''
    `,
    [supervisionId]
  );

  const companyNames = Array.from(
    new Set(
      [...detailRows, ...supervisionRows]
        .map((item) => normalizeText(item.company_name))
        .filter(Boolean)
    )
  );

  if (companyNames.length === 0) {
    return [];
  }

  const placeholders = companyNames.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `
      SELECT id
      FROM companies
      WHERE name IN (${placeholders})
    `,
    companyNames
  );

  return rows.map((item) => Number(item.id)).filter(Boolean);
}



async function removeAnnouncementCompanySampling(connection, announcementId) {
  await ensureCompaniesSamplingSchema(connection);

  const [rows] = await connection.query(
    'SELECT DISTINCT company_id, product_name FROM company_sampling_records WHERE announcement_id = ?',
    [announcementId]
  );
  const companyIds = rows.map((item) => Number(item.company_id)).filter(Boolean);

  await connection.query('DELETE FROM company_sampling_records WHERE announcement_id = ?', [announcementId]);
  await recalculateCompanySampledCount(connection, companyIds);
  await refreshCompanySourceProductNamesAfterSamplingRemoval(connection, rows);

  return deleteOrphanCompanies(connection, companyIds);
}

module.exports = {
  normalizeText,
  deriveProvince,
  ensureCompaniesSamplingSchema,
  upsertCompany,
  deleteOrphanCompanies,
  cleanupOrphanSupervisionArtifacts,
  syncCompaniesFromAnnouncementDetails,

  syncCompaniesFromFlightInspectionDetails,
  getSupervisionRelatedCompanyIds,
  removeAnnouncementCompanySampling
};


