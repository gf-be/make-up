const { normalizeText } = require('./companySamplingSync');

function splitCompanyNames(value) {
  return String(value || '')
    .split(/\r?\n|；|;|、/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function deriveRegionFromAddress(address) {
  const normalizedAddress = normalizeText(address);
  if (!normalizedAddress) {
    return null;
  }

  const match = normalizedAddress.match(/^(.*?(?:省|市|自治区|特别行政区))/);
  return match ? match[1] : null;
}

function deriveInspectionRegion(detailRows = []) {
  const candidates = Array.from(new Set(
    detailRows
      .flatMap((row) => [
        normalizeText(row.product_region),
        deriveRegionFromAddress(row.company_addresses),
        deriveRegionFromAddress(row.sample_unit_address)
      ])
      .filter(Boolean)
  ));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.slice(0, 6).join('、');
}

function deriveInspectionLevel(announcement = {}, region = '') {
  const sourceText = `${announcement.title || ''} ${announcement.inspection_unit || ''} ${region || ''}`;
  if (/地市|市级|市场监督管理局/.test(sourceText)) {
    return 'municipal';
  }
  if (/省级|省药监|自治区|特别行政区/.test(sourceText)) {
    return 'provincial';
  }
  return 'national';
}

function normalizeDateForSql(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized || normalized === '/' || normalized === '-') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const slashMatch = normalized.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

function buildInspectionSummary(announcement = {}, detailRows = []) {
  const totalSamples = detailRows.length;
  const counterfeitCount = detailRows.filter((row) => Number(row.is_counterfeit || 0) === 1).length;
  const issueSamples = detailRows
    .map((row) => {
      const productName = normalizeText(row.product_name) || `第${row.sequence_no || 0}条样品`;
      const issue = normalizeText(row.unqualified_items) || '未填写不符合规定项目';
      return `${productName}：${issue}`;
    })
    .slice(0, 12)
    .join('；');

  return [
    `${announcement.title || '抽检通告'}自动派生抽样检查记录`,
    `共 ${totalSamples} 条不合格明细`,
    counterfeitCount > 0 ? `其中涉嫌假冒 ${counterfeitCount} 条` : '',
    issueSamples ? `问题概览：${issueSamples}` : ''
  ].filter(Boolean).join('。');
}

async function ensureInspectionDetailsSchema(connection) {
  const [tableRows] = await connection.query("SHOW TABLES LIKE 'inspection_details'");
  if (tableRows.length === 0) {
    return;
  }

  const [columnRows] = await connection.query("SHOW COLUMNS FROM inspection_details LIKE 'inspection_standard'");
  if (columnRows.length === 0) {
    await connection.query('ALTER TABLE inspection_details ADD COLUMN inspection_standard LONGTEXT NULL AFTER unqualified_items');
    return;
  }

  const columnType = String(columnRows[0].Type || '').toLowerCase();
  if (!/(tinytext|text|mediumtext|longtext)/.test(columnType)) {
    await connection.query('ALTER TABLE inspection_details MODIFY COLUMN inspection_standard LONGTEXT NULL');
  }
}

async function syncInspectionsFromAnnouncementDetails(connection, announcementId) {

  const normalizedAnnouncementId = Number(announcementId);
  if (!normalizedAnnouncementId) {
    return {
      inspection_id: null,
      detail_count: 0,
      deleted_inspection_count: 0
    };
  }

  const [announcementRows] = await connection.query(
    `
      SELECT id, title, announcement_no, publish_date, inspection_unit, inspection_count
      FROM announcements
      WHERE id = ?
      LIMIT 1
    `,
    [normalizedAnnouncementId]
  );
  const announcement = announcementRows[0] || null;

  const [existingInspectionRows] = await connection.query(
    'SELECT id FROM inspections WHERE announcement_id = ?',
    [normalizedAnnouncementId]
  );
  const existingInspectionIds = existingInspectionRows.map((row) => Number(row.id)).filter(Boolean);

  if (existingInspectionIds.length > 0) {
    const placeholders = existingInspectionIds.map(() => '?').join(', ');
    await connection.query(
      `DELETE FROM inspection_details WHERE inspection_id IN (${placeholders})`,
      existingInspectionIds
    );
  }
  await connection.query('DELETE FROM inspections WHERE announcement_id = ?', [normalizedAnnouncementId]);

  if (!announcement) {
    return {
      inspection_id: null,
      detail_count: 0,
      deleted_inspection_count: existingInspectionIds.length
    };
  }

  const [detailRows] = await connection.query(
    `
      SELECT
        apd.*,
        csr.company_id
      FROM announcement_product_details apd
      LEFT JOIN company_sampling_records csr
        ON csr.announcement_detail_id = apd.id
       AND csr.announcement_id = apd.announcement_id
      WHERE apd.announcement_id = ?
      ORDER BY apd.sequence_no ASC, apd.id ASC
    `,
    [normalizedAnnouncementId]
  );

  if (detailRows.length === 0) {
    return {
      inspection_id: null,
      detail_count: 0,
      deleted_inspection_count: existingInspectionIds.length
    };
  }

  const totalSamples = detailRows.length;
  const unqualifiedCount = detailRows.length;
  const qualifiedCount = 0;
  const qualifiedRate = 0;
  const region = deriveInspectionRegion(detailRows);
  const level = deriveInspectionLevel(announcement, region);
  const summary = buildInspectionSummary(announcement, detailRows);

  const [inspectionResult] = await connection.query(
    `
      INSERT INTO inspections (
        announcement_id,
        title,
        batch_number,
        inspection_date,
        inspection_unit,
        region,
        level,
        total_samples,
        qualified_count,
        unqualified_count,
        qualified_rate,
        summary,
        status,
        source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', '抽检通告派生')
    `,
    [
      normalizedAnnouncementId,
      announcement.title,
      announcement.announcement_no || null,
      announcement.publish_date || null,
      announcement.inspection_unit || null,
      region,
      level,
      totalSamples,
      qualifiedCount,
      unqualifiedCount,
      qualifiedRate,
      summary
    ]
  );

  const inspectionId = Number(inspectionResult.insertId);

  const chunkSize = 200;
  for (let index = 0; index < detailRows.length; index += chunkSize) {
    const chunk = detailRows.slice(index, index + chunkSize);
    const values = chunk.flatMap((row) => {
      const companyNames = splitCompanyNames(row.company_names);
      return [
        inspectionId,
        row.product_name || null,
        null,
        row.company_id ? Number(row.company_id) : null,
        companyNames[0] || normalizeText(row.company_names) || null,
        normalizeDateForSql(row.production_date),
        row.sample_unit_name || row.sample_unit_address || row.product_region || null,
        'unqualified',
        row.unqualified_items || null,
        row.requirement || null
      ];
    });

    await connection.query(
      `
        INSERT INTO inspection_details (
          inspection_id,
          product_name,
          brand,
          company_id,
          manufacturer,
          production_date,
          sample_source,
          inspection_result,
          unqualified_items,
          inspection_standard
        ) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `,
      values
    );
  }

  await connection.query(
    'UPDATE announcements SET inspection_count = ? WHERE id = ?',
    [Math.max(totalSamples, Number(announcement.inspection_count || 0)), normalizedAnnouncementId]
  );

  return {
    inspection_id: inspectionId,
    detail_count: detailRows.length,
    deleted_inspection_count: existingInspectionIds.length,
    total_samples: totalSamples,
    qualified_count: qualifiedCount,
    unqualified_count: unqualifiedCount,
    region,
    level
  };
}

module.exports = {
  ensureInspectionDetailsSchema,
  syncInspectionsFromAnnouncementDetails
};

