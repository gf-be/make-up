const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions,
  getProductTypeLabel,
  getAnnouncementTypeLabel,
  getProductTypeOptions,
  getAnnouncementTypeOptions,
  normalizeProductType,
  normalizeAnnouncementType
} = require('../utils/unqualifiedProducts');

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
    } catch (error) {
      // ignore
    }
  }

  return text
    .split('|')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function clampPageSize(limit, defaultValue = 10, maxValue = 200) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function parseYearValue(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year > 2000 ? year : null;
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

function buildOptionItems(rows = [], fieldName = 'value') {
  return rows
    .map((row) => String(row?.[fieldName] || '').trim())
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
}

async function ensureUnqualifiedProductsReady() {
  await ensureUnqualifiedProductsTable(pool);
}

function buildIssueFilterClause(issueItems, params) {
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

function appendUnqualifiedProductFilters(conditions, params, filters = {}) {
  const normalizedKeyword = normalizeOptionalText(filters.keyword);
  const normalizedCompanyKeyword = normalizeOptionalText(filters.company_keyword);
  const normalizedSourceKeyword = normalizeOptionalText(filters.source_keyword);
  const normalizedItem = normalizeOptionalText(filters.unqualified_item);
  const normalizedProductType = normalizeOptionalText(filters.product_type);
  const normalizedAnnouncementType = normalizeOptionalText(filters.announcement_type);
  const normalizedProvince = normalizeOptionalText(filters.province);
  const normalizedProductCategory = normalizeOptionalText(filters.product_category);
  const normalizedAnnouncementId = Number.parseInt(filters.announcement_id, 10) || null;
  const normalizedSupervisionId = Number.parseInt(filters.supervision_id, 10) || null;
  const normalizedYear = parseYearValue(filters.year);
  const sourceDateExpr = buildSourceDateExpr('a', 's');
  const sourceTitleExpr = buildSourceTitleExpr('a', 's', 'up');

  if (normalizedKeyword) {
    conditions.push(`(
      up.product_name LIKE ? OR
      up.company_names LIKE ? OR
      up.company_addresses LIKE ? OR
      up.sample_unit_name LIKE ? OR
      up.sample_unit_address LIKE ? OR
      up.inspection_institution LIKE ? OR
      up.batch_title LIKE ? OR
      up.product_region LIKE ? OR
      ${sourceTitleExpr} LIKE ?
    )`);
    params.push(
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`
    );
  }

  if (normalizedCompanyKeyword) {
    conditions.push('(up.company_names LIKE ? OR up.company_addresses LIKE ? OR up.sample_unit_name LIKE ?)');
    params.push(`%${normalizedCompanyKeyword}%`, `%${normalizedCompanyKeyword}%`, `%${normalizedCompanyKeyword}%`);
  }

  if (normalizedSourceKeyword) {
    conditions.push(`${sourceTitleExpr} LIKE ?`);
    params.push(`%${normalizedSourceKeyword}%`);
  }

  if (normalizedItem) {
    conditions.push('up.unqualified_items LIKE ?');
    params.push(`%${normalizedItem}%`);
  }

  if (normalizedProductType) {
    conditions.push('up.product_type = ?');
    params.push(normalizeProductType(normalizedProductType));
  }

  if (normalizedAnnouncementType) {
    conditions.push('up.announcement_type = ?');
    params.push(normalizeAnnouncementType(normalizedAnnouncementType));
  }

  if (normalizedProvince) {
    conditions.push(`${buildProvinceDisplayExpr('up')} = ?`);
    params.push(normalizedProvince);
  }

  if (normalizedProductCategory) {
    conditions.push('up.product_category = ?');
    params.push(normalizedProductCategory);
  }

  if (normalizedAnnouncementId) {
    conditions.push('up.announcement_id = ?');
    params.push(normalizedAnnouncementId);
  }

  if (normalizedSupervisionId) {
    conditions.push('up.supervision_id = ?');
    params.push(normalizedSupervisionId);
  }

  if (normalizedYear) {
    conditions.push(`YEAR(${sourceDateExpr}) = ?`);
    params.push(normalizedYear);
  }
}

ensureUnqualifiedProductsReady().catch((error) => {
  console.error('初始化不合格产品数据失败:', error);
});

router.get('/stats/overview', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS loaded_count,
        COUNT(*) AS total_batches,
        COUNT(DISTINCT COALESCE(announcement_id, supervision_id)) AS source_count,
        COUNT(DISTINCT CASE WHEN announcement_type = 'sampling' THEN announcement_id END) AS announcement_count,
        COUNT(DISTINCT CASE WHEN announcement_type = 'flight_inspection' THEN supervision_id END) AS supervision_count,
        COUNT(DISTINCT sample_unit_name) AS sample_unit_count,
        COUNT(DISTINCT inspection_institution) AS institution_count
      FROM unqualified_products
      WHERE announcement_id IS NOT NULL OR supervision_id IS NOT NULL
    `);
    const [companyRows] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) AS company_count
      FROM (
        SELECT company_id FROM company_sampling_records
        UNION ALL
        SELECT company_id FROM company_supervision_records
      ) company_sources
    `);

    const [issueRows] = await pool.query(`
      SELECT COUNT(DISTINCT issue_item) AS issue_item_count
      FROM unqualified_product_issue_items
    `);

    res.json({
      success: true,
      data: {
        loaded_count: Number(rows[0]?.loaded_count || 0),
        total_batches: Number(rows[0]?.total_batches || 0),
        source_count: Number(rows[0]?.source_count || 0),
        announcement_count: Number(rows[0]?.announcement_count || 0),
        supervision_count: Number(rows[0]?.supervision_count || 0),
        company_count: Number(companyRows[0]?.company_count || 0),
        sample_unit_count: Number(rows[0]?.sample_unit_count || 0),
        institution_count: Number(rows[0]?.institution_count || 0),
        issue_item_count: Number(issueRows[0]?.issue_item_count || 0)
      }
    });
  } catch (error) {
    console.error('获取不合格产品统计失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品统计失败' });
  }
});

router.get('/filter-options', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();
    const sourceDateExpr = buildSourceDateExpr('a', 's');
    const [productCategories, issueItems, productTypeRows, announcementTypeRows, provinceRows, yearRows] = await Promise.all([
      getUnqualifiedProductCategoryOptions(pool, 300),
      getUnqualifiedProductIssueOptions(pool, 300),
      pool.query(`
        SELECT DISTINCT product_type
        FROM unqualified_products
        WHERE product_type IS NOT NULL AND TRIM(product_type) != ''
        ORDER BY product_type ASC
      `),
      pool.query(`
        SELECT DISTINCT announcement_type
        FROM unqualified_products
        WHERE announcement_type IS NOT NULL AND TRIM(announcement_type) != ''
        ORDER BY announcement_type ASC
      `),
      pool.query(`
        SELECT DISTINCT ${buildProvinceDisplayExpr('up')} AS province
        FROM unqualified_products up
        WHERE ${buildProvinceDisplayExpr('up')} IS NOT NULL
          AND TRIM(${buildProvinceDisplayExpr('up')}) != ''
        ORDER BY province ASC
      `),
      pool.query(`
        SELECT DISTINCT YEAR(${sourceDateExpr}) AS year
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        WHERE ${sourceDateExpr} IS NOT NULL
        ORDER BY year DESC
      `)
    ]);
    const productTypes = getProductTypeOptions((productTypeRows[0] || []).map((row) => row.product_type));
    const announcementTypes = getAnnouncementTypeOptions((announcementTypeRows[0] || []).map((row) => row.announcement_type));
    const provinces = buildOptionItems(provinceRows[0] || [], 'province');
    const years = (yearRows[0] || [])
      .map((row) => Number(row.year))
      .filter((value) => Number.isInteger(value) && value > 0)
      .map((value) => ({ value: String(value), label: `${value}年` }));

    res.json({
      success: true,
      data: {
        product_categories: productCategories,
        issue_items: issueItems,
        product_types: productTypes,
        announcement_types: announcementTypes,
        provinces,
        years
      }
    });
  } catch (error) {
    console.error('获取不合格项目筛选项失败:', error);
    res.status(500).json({ success: false, message: '获取不合格项目筛选项失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const { id } = req.params;
    const [rows] = await pool.query(
      `
        SELECT
          up.*,
          ${buildProvinceDisplayExpr('up')} AS province_display,
          ${buildSourceDateExpr('a', 's')} AS source_publish_date,
          ${buildSourceTitleExpr('a', 's', 'up')} AS source_title,
          ${buildSourceUrlExpr('a', 's')} AS source_detail_url,
          ${buildCompanyIdExpr('up')} AS company_id,
          CASE
            WHEN up.announcement_id IS NOT NULL THEN 'announcement'
            WHEN up.supervision_id IS NOT NULL THEN 'supervision'
            ELSE 'unknown'
          END AS source_type,
          a.announcement_no,
          s.supervision_unit,
          s.level AS supervision_level
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        WHERE up.id = ?
        LIMIT 1
      `,
      [id]
    );

    const detail = rows[0] || null;
    if (!detail) {
      return res.status(404).json({ success: false, message: '问题产品不存在' });
    }

    const [[issueRows], [categoryRows]] = await Promise.all([
      pool.query(
        `
          SELECT issue_item
          FROM unqualified_product_issue_items
          WHERE unqualified_product_id = ?
          ORDER BY issue_item ASC
        `,
        [id]
      ),
      pool.query(
        `
          SELECT product_category
          FROM unqualified_product_category_items
          WHERE unqualified_product_id = ?
          ORDER BY product_category ASC
        `,
        [id]
      )
    ]);

    res.json({
      success: true,
      data: {
        ...detail,
        product_type_label: getProductTypeLabel(detail.product_type),
        announcement_type_label: getAnnouncementTypeLabel(detail.announcement_type),
        issue_items: (issueRows || []).map((row) => row.issue_item).filter(Boolean),
        product_categories: (categoryRows || []).map((row) => row.product_category).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('获取不合格产品详情失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品详情失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const {
      keyword = '',
      company_keyword = '',
      source_keyword = '',
      unqualified_item = '',
      issue_items = '',
      product_type = '',
      announcement_type = '',
      province = '',
      product_category = '',
      year = '',
      announcement_id = '',
      supervision_id = '',
      page = 1,
      limit = 10
    } = req.query;

    const selectedIssueItems = parseListParam(issue_items);
    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = clampPageSize(limit);
    const offset = (currentPage - 1) * pageSize;

    const joinParams = [];
    const joinClause = buildIssueFilterClause(selectedIssueItems, joinParams);
    const conditions = ['(up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)'];
    const params = [...joinParams];

    appendUnqualifiedProductFilters(conditions, params, {
      keyword,
      company_keyword,
      source_keyword,
      unqualified_item,
      product_type,
      announcement_type,
      province,
      product_category,
      year,
      announcement_id,
      supervision_id
    });

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(
      `
        SELECT
          up.*, 
          ${buildProvinceDisplayExpr('up')} AS province_display,
          ${buildSourceDateExpr('a', 's')} AS source_publish_date,
          ${buildSourceTitleExpr('a', 's', 'up')} AS source_title,
          ${buildSourceUrlExpr('a', 's')} AS source_detail_url,
          ${buildCompanyIdExpr('up')} AS company_id,
          CASE
            WHEN up.announcement_id IS NOT NULL THEN 'announcement'
            WHEN up.supervision_id IS NOT NULL THEN 'supervision'
            ELSE 'unknown'
          END AS source_type
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
        ORDER BY ${buildSourceDateExpr('a', 's')} DESC, COALESCE(up.announcement_id, up.supervision_id) DESC, up.sequence_no ASC, up.id ASC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
      `,
      params
    );

    const [summaryRows] = await pool.query(
      `
        SELECT
          COUNT(*) AS loaded_count,
          COUNT(*) AS total_batches,
          COUNT(DISTINCT COALESCE(up.announcement_id, up.supervision_id)) AS source_count,
          COUNT(DISTINCT ${buildProvinceDisplayExpr('up')}) AS province_count,
          CASE
            WHEN COUNT(DISTINCT COALESCE(up.announcement_id, up.supervision_id)) = 1 THEN MAX(${buildSourceTitleExpr('a', 's', 'up')})
            ELSE '全部问题通告'
          END AS batch_title
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        product_type_label: getProductTypeLabel(row.product_type),
        announcement_type_label: getAnnouncementTypeLabel(row.announcement_type)
      })),
      summary: {
        batch_title: summaryRows[0]?.batch_title || '',
        loaded_count: Number(summaryRows[0]?.loaded_count || 0),
        total_batches: Number(summaryRows[0]?.total_batches || 0),
        source_count: Number(summaryRows[0]?.source_count || 0),
        matched_count: total,
        current_page_count: rows.length,
        province_count: Number(summaryRows[0]?.province_count || 0)
      },
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(total / pageSize)
      },
      filters_applied: {
        keyword: normalizeOptionalText(keyword),
        company_keyword: normalizeOptionalText(company_keyword),
        source_keyword: normalizeOptionalText(source_keyword),
        unqualified_item: normalizeOptionalText(unqualified_item),
        issue_items: selectedIssueItems,
        product_type: normalizeOptionalText(product_type),
        announcement_type: normalizeOptionalText(announcement_type),
        province: normalizeOptionalText(province),
        product_category: normalizeOptionalText(product_category),
        year: normalizeOptionalText(year),
        announcement_id: normalizeOptionalText(announcement_id),
        supervision_id: normalizeOptionalText(supervision_id)
      }
    });
  } catch (error) {
    console.error('获取不合格产品列表失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品列表失败' });
  }
});

module.exports = router;
