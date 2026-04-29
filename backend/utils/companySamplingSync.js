const {
  normalizeProductType,
  normalizeAnnouncementType
} = require('./unqualifiedProducts');
const { deriveProductCategory } = require('./dataAnalysisHelpers');


function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}


function splitCompanyValues(value) {
  const normalized = String(value || '')
    .split(/\r?\n|；|;/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [];
}

function deriveProvince(region, address) {
  const normalizedRegion = normalizeText(region);
  if (normalizedRegion) {
    return normalizedRegion;
  }

  const normalizedAddress = normalizeText(address);
  const match = normalizedAddress.match(/^(.*?(?:省|市|自治区|特别行政区))/);
  return match ? match[1] : null;
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

  const [productCategoryColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['product_category']);
  if (productCategoryColumn.length === 0) {
    await connection.query("ALTER TABLE companies ADD COLUMN product_category VARCHAR(100) NULL AFTER city");
  }
  await ensureIndexExists(connection, 'companies', 'idx_companies_product_category', 'INDEX idx_companies_product_category (product_category)');


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

async function upsertCompany(connection, companyName, companyAddress, province, productCategory = null) {

  const [existingRows] = await connection.query(
    'SELECT id, address, province, product_category FROM companies WHERE name = ? LIMIT 1',
    [companyName]
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const shouldUpdateAddress = (!existing.address && companyAddress);
    const shouldUpdateProvince = (!existing.province && province);
    const shouldUpdateCategory = (!existing.product_category && productCategory);
    if (shouldUpdateAddress || shouldUpdateProvince || shouldUpdateCategory) {
      await connection.query(
        'UPDATE companies SET address = COALESCE(address, ?), province = COALESCE(province, ?), product_category = COALESCE(product_category, ?) WHERE id = ?',
        [companyAddress || null, province || null, productCategory || null, existing.id]
      );
    }
    return existing.id;
  }

  const [result] = await connection.query(
    `
      INSERT INTO companies (name, type, address, province, product_category, sampled_count, last_sampled_at)
      VALUES (?, 'manufacturer', ?, ?, ?, 0, NULL)
    `,
    [companyName, companyAddress || null, province || null, productCategory || null]
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
             manufacturer_name, manufacturer_address, product_region
      FROM announcement_product_details
      WHERE announcement_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [announcementId]
  );


  for (const detail of detailRows) {
    const companyNames = splitCompanyValues(detail.manufacturer_name || detail.company_names);
    const companyAddresses = splitCompanyValues(detail.manufacturer_address || detail.company_addresses);
    const defaultAddress = companyAddresses[0] || normalizeText(detail.manufacturer_address || detail.company_addresses) || null;

    for (const [index, companyName] of companyNames.entries()) {
      const companyAddress = companyAddresses[index] || defaultAddress;
      const province = deriveProvince(detail.product_region, companyAddress);
      const productCategory = deriveProductCategory(detail.product_name);
      const companyId = await upsertCompany(connection, companyName, companyAddress, province, productCategory);

      const normalizedCompanyId = Number(companyId);
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
    const province = deriveProvince(null, companyAddress);
    const productCategory = deriveProductCategory(detail.product_name);
    const companyId = await upsertCompany(connection, companyName, companyAddress, province, productCategory);

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
    'SELECT DISTINCT company_id FROM company_sampling_records WHERE announcement_id = ?',
    [announcementId]
  );
  const companyIds = rows.map((item) => Number(item.company_id)).filter(Boolean);

  await connection.query('DELETE FROM company_sampling_records WHERE announcement_id = ?', [announcementId]);
  await recalculateCompanySampledCount(connection, companyIds);

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


