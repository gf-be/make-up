const {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions
} = require('./unqualifiedProducts');

function parseListParam(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseListParam(item));
  }
  if (value === undefined || value === null) {
    return [];
  }
  const text = String(value).trim();
  if (!text) {
    return [];
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      return parseListParam(JSON.parse(text));
    } catch {
      // ignore
    }
  }
  return text
    .split('|')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function parseYearValue(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year > 1990 && year < 2100 ? year : null;
}

function buildProvinceDisplayExpr(alias = 'up') {
  return `COALESCE(NULLIF(TRIM(${alias}.manufacturer_province), ''), NULLIF(TRIM(${alias}.sampled_province), ''), NULLIF(TRIM(${alias}.product_region), ''))`;
}

function buildSourceDateExpr(announcementAlias = 'a', supervisionAlias = 's') {
  return `COALESCE(${announcementAlias}.publish_date, ${supervisionAlias}.publish_date, ${supervisionAlias}.supervision_date)`;
}

function buildSourceTitleExpr(announcementAlias = 'a', supervisionAlias = 's', productAlias = 'up') {
  return `COALESCE(NULLIF(TRIM(${announcementAlias}.title), ''), NULLIF(TRIM(${supervisionAlias}.title), ''), ${productAlias}.batch_title)`;
}

function buildSourceUrlExpr(announcementAlias = 'a', supervisionAlias = 's') {
  return `COALESCE(${announcementAlias}.source_detail_url, ${supervisionAlias}.source_detail_url)`;
}

function buildCompanyIdExpr(alias = 'up') {
  return `COALESCE(
    (
      SELECT MIN(csr.company_id)
      FROM company_sampling_records csr
      WHERE csr.announcement_id = ${alias}.announcement_id
        AND csr.announcement_detail_id = ${alias}.announcement_detail_id
    ),
    (
      SELECT MIN(csr2.company_id)
      FROM company_supervision_records csr2
      WHERE csr2.supervision_id = ${alias}.supervision_id
        AND (${alias}.supervision_detail_id IS NULL OR csr2.supervision_detail_id = ${alias}.supervision_detail_id)
    )
  )`;
}

function buildIssueFilterJoin(issueItems, params) {
  if (!issueItems.length) {
    return '';
  }
  params.push(...issueItems);
  return `
    INNER JOIN (
      SELECT DISTINCT unqualified_product_id
      FROM unqualified_product_issue_items
      WHERE issue_item IN (${issueItems.map(() => '?').join(', ')})
    ) issue_filter ON issue_filter.unqualified_product_id = up.id
  `;
}

const SORT_FIELD_SQL = {
  source_publish_date: null,
  product_name: 'up.product_name',
  company_names: 'up.company_names',
  province_display: null,
  unqualified_items: 'up.unqualified_items',
  batch_title: 'up.batch_title',
  sequence_no: 'up.sequence_no',
  product_category: 'up.product_category',
  inspection_institution: 'up.inspection_institution'
};

function buildOrderClause(sortField, sortOrder, sourceDateExpr) {
  const dir = String(sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const field = SORT_FIELD_SQL[sortField];
  if (sortField === 'source_publish_date' || sortField === 'province_display') {
    const expr = sortField === 'province_display' ? buildProvinceDisplayExpr('up') : sourceDateExpr;
    return `ORDER BY ${expr} ${dir}, up.id ${dir}`;
  }
  if (field) {
    return `ORDER BY ${field} ${dir}, up.id ${dir}`;
  }
  return `ORDER BY ${sourceDateExpr} DESC, COALESCE(up.announcement_id, up.supervision_id) DESC, up.sequence_no ASC, up.id ASC`;
}

/**
 * @returns {{ joinClause: string, conditions: string[], params: any[], joinParams: any[] }}
 */
function buildSamplingSearchFilters(input = {}) {
  const yearStart = parseYearValue(input.year_start ?? input.yearStart);
  const yearEnd = parseYearValue(input.year_end ?? input.yearEnd);
  const provinces = parseListParam(input.provinces);
  const productCategories = parseListParam(input.product_categories ?? input.productCategories);
  const issueItems = parseListParam(input.issue_items ?? input.issueItems);
  const announcementIds = parseListParam(input.announcement_ids ?? input.announcementIds)
    .map((id) => Number.parseInt(id, 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  const companyKeyword = normalizeOptionalText(input.company_keyword ?? input.companyKeyword);
  const sourceDateExpr = buildSourceDateExpr('a', 's');
  const sourceTitleExpr = buildSourceTitleExpr('a', 's', 'up');

  const joinParams = [];
  const joinClause = buildIssueFilterJoin(issueItems, joinParams);

  const conditions = ['(up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)'];
  const params = [...joinParams];

  if (yearStart !== null) {
    conditions.push(`(${sourceDateExpr} IS NOT NULL AND YEAR(${sourceDateExpr}) >= ?)`);
    params.push(yearStart);
  }
  if (yearEnd !== null) {
    conditions.push(`(${sourceDateExpr} IS NOT NULL AND YEAR(${sourceDateExpr}) <= ?)`);
    params.push(yearEnd);
  }

  if (provinces.length) {
    conditions.push(`${buildProvinceDisplayExpr('up')} IN (${provinces.map(() => '?').join(', ')})`);
    params.push(...provinces);
  }

  if (companyKeyword) {
    conditions.push(`(
      up.company_names LIKE ?
      OR up.company_addresses LIKE ?
      OR up.manufacturer_name LIKE ?
      OR up.manufacturer_address LIKE ?
      OR up.sample_unit_name LIKE ?
      OR up.sample_unit_address LIKE ?
      OR up.operator_name LIKE ?
      OR up.operator_address LIKE ?
    )`);
    params.push(
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`,
      `%${companyKeyword}%`
    );
  }

  if (productCategories.length) {
    const placeholders = productCategories.map(() => '?').join(', ');
    conditions.push(`(
      up.product_category IN (${placeholders})
      OR EXISTS (
        SELECT 1 FROM unqualified_product_category_items upci
        WHERE upci.unqualified_product_id = up.id
          AND upci.product_category IN (${placeholders})
      )
    )`);
    params.push(...productCategories, ...productCategories);
  }

  if (announcementIds.length) {
    conditions.push(`up.announcement_id IN (${announcementIds.map(() => '?').join(', ')})`);
    params.push(...announcementIds);
  }

  return {
    joinClause,
    conditions,
    params,
    joinParams,
    sourceDateExpr,
    sourceTitleExpr
  };
}

module.exports = {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions,
  parseListParam,
  normalizeOptionalText,
  parseYearValue,
  buildProvinceDisplayExpr,
  buildSourceDateExpr,
  buildSourceTitleExpr,
  buildSourceUrlExpr,
  buildCompanyIdExpr,
  buildOrderClause,
  buildSamplingSearchFilters
};
