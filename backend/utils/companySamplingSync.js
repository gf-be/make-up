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

async function ensureCompaniesSamplingSchema(connection) {
  const [sampledCountColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['sampled_count']);
  if (sampledCountColumn.length === 0) {
    await connection.query('ALTER TABLE companies ADD COLUMN sampled_count INT DEFAULT 0 AFTER city');
  }

  const [lastSampledAtColumn] = await connection.query('SHOW COLUMNS FROM companies LIKE ?', ['last_sampled_at']);
  if (lastSampledAtColumn.length === 0) {
    await connection.query('ALTER TABLE companies ADD COLUMN last_sampled_at DATE NULL AFTER sampled_count');
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS company_sampling_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      announcement_id INT NOT NULL,
      announcement_detail_id INT NOT NULL,
      product_name VARCHAR(255),
      sampled_at DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_company_sampling_detail_company (announcement_detail_id, company_id),
      INDEX idx_company_sampling_company (company_id),
      INDEX idx_company_sampling_announcement (announcement_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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

async function upsertCompany(connection, companyName, companyAddress, province) {
  const [existingRows] = await connection.query(
    'SELECT id, address, province FROM companies WHERE name = ? LIMIT 1',
    [companyName]
  );

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    if ((!existing.address && companyAddress) || (!existing.province && province)) {
      await connection.query(
        'UPDATE companies SET address = COALESCE(address, ?), province = COALESCE(province, ?) WHERE id = ?',
        [companyAddress || null, province || null, existing.id]
      );
    }
    return existing.id;
  }

  const [result] = await connection.query(
    `
      INSERT INTO companies (name, type, address, province, sampled_count, last_sampled_at)
      VALUES (?, 'manufacturer', ?, ?, 0, NULL)
    `,
    [companyName, companyAddress || null, province || null]
  );

  return result.insertId;
}

async function syncCompaniesFromAnnouncementDetails(connection, announcementId, publishDate = null) {
  await ensureCompaniesSamplingSchema(connection);

  const [oldCompanyRows] = await connection.query(
    'SELECT DISTINCT company_id FROM company_sampling_records WHERE announcement_id = ?',
    [announcementId]
  );
  const affectedCompanyIds = new Set(oldCompanyRows.map((item) => Number(item.company_id)).filter(Boolean));

  await connection.query('DELETE FROM company_sampling_records WHERE announcement_id = ?', [announcementId]);

  const [detailRows] = await connection.query(
    `
      SELECT id, product_name, company_names, company_addresses, product_region
      FROM announcement_product_details
      WHERE announcement_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [announcementId]
  );

  for (const detail of detailRows) {
    const companyNames = splitCompanyValues(detail.company_names);
    const companyAddresses = splitCompanyValues(detail.company_addresses);
    const defaultAddress = companyAddresses[0] || normalizeText(detail.company_addresses) || null;

    for (const [index, companyName] of companyNames.entries()) {
      const companyAddress = companyAddresses[index] || defaultAddress;
      const province = deriveProvince(detail.product_region, companyAddress);
      const companyId = await upsertCompany(connection, companyName, companyAddress, province);
      affectedCompanyIds.add(Number(companyId));

      await connection.query(
        `
          INSERT INTO company_sampling_records (
            company_id, announcement_id, announcement_detail_id, product_name, sampled_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [companyId, announcementId, detail.id, detail.product_name || null, publishDate || null]
      );
    }
  }

  await recalculateCompanySampledCount(connection, Array.from(affectedCompanyIds));

  return {
    company_count: affectedCompanyIds.size,
    detail_count: detailRows.length
  };
}

async function syncCompaniesFromFlightInspectionDetails(connection, supervisionId) {
  await ensureCompaniesSamplingSchema(connection);

  const [detailRows] = await connection.query(
    `
      SELECT company_name, company_address
      FROM flight_inspection_detail
      WHERE supervision_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [supervisionId]
  );

  const companyIds = new Set();

  for (const detail of detailRows) {
    const companyName = normalizeText(detail.company_name);
    if (!companyName) {
      continue;
    }

    const companyAddress = normalizeText(detail.company_address) || null;
    const province = deriveProvince(null, companyAddress);
    const companyId = await upsertCompany(connection, companyName, companyAddress, province);
    companyIds.add(Number(companyId));
  }

  return {
    company_count: companyIds.size,
    detail_count: detailRows.length
  };
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
}

module.exports = {
  normalizeText,
  deriveProvince,
  ensureCompaniesSamplingSchema,
  upsertCompany,
  syncCompaniesFromAnnouncementDetails,
  syncCompaniesFromFlightInspectionDetails,
  removeAnnouncementCompanySampling
};

