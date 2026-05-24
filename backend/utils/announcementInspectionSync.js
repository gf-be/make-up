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

function isValidSqlDateParts(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    return false;
  }
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return false;
  }
  if (!Number.isInteger(d) || d < 1 || d > 31) {
    return false;
  }
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function toSqlDateOrNull(yearStr, monthStr, dayStr) {
  const y = String(yearStr).trim();
  const mo = String(monthStr).trim().padStart(2, '0');
  const da = String(dayStr).trim().padStart(2, '0');
  if (!isValidSqlDateParts(y, mo, da)) {
    return null;
  }
  return `${y}-${mo}-${da}`;
}

function normalizeDateForSql(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    if (!isValidSqlDateParts(y, m, d)) {
      return null;
    }
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const normalized = String(value).trim();
  if (!normalized || normalized === '/' || normalized === '-') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [y, m, d] = normalized.split('-');
    return toSqlDateOrNull(y, m, d);
  }

  const slashMatch = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (slashMatch) {
    const [, year, month, day] = slashMatch;
    return toSqlDateOrNull(year, month, day);
  }

  const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return toSqlDateOrNull(year, month, day);
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

/** 移除由抽检通告派生的 inspections / inspection_details（不再写入派生明细） */
async function removeInspectionsDerivedFromAnnouncement(connection, announcementId) {
  const normalizedAnnouncementId = Number(announcementId);
  if (!normalizedAnnouncementId) {
    return {
      deleted_inspection_count: 0
    };
  }

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

  return {
    deleted_inspection_count: existingInspectionIds.length
  };
}

module.exports = {
  ensureInspectionDetailsSchema,
  removeInspectionsDerivedFromAnnouncement
};

