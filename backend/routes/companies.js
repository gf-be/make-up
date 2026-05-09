const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { requireRoles } = require('../utils/auth');
const { ensureCompaniesSamplingSchema } = require('../utils/companySamplingSync');
const { getProductTypeOptions, normalizeProductType } = require('../utils/unqualifiedProducts');

const USCC_CHARSET_RE = /^[0-9A-HJ-NPQRTUWXY]{18}$/i;
const JP_CORP_NUM_RE = /^\d{13}$/;
const US_EIN_DIGITS_RE = /^\d{9}$/;

const CREDIT_CODE_TYPE_ERROR =
  '须为中国 18 位统一社会信用代码、日本 13 位法人番号、或美国 9 位 EIN（可含连字符）';

function normalizeUsEinDigits(raw) {
  const compact = String(raw || '').replace(/\s+/g, '').replace(/-/g, '');
  return US_EIN_DIGITS_RE.test(compact) ? compact : null;
}

/** 中国 USCC / 日本法人番号 / 美国 EIN，返回存库用字符串；不合法则 null */
function normalizeCreditCodeValue(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const noSpace = trimmed.replace(/\s+/g, '');
  if (!noSpace) return null;
  const cn = noSpace.toUpperCase();
  if (USCC_CHARSET_RE.test(cn)) return cn;
  if (JP_CORP_NUM_RE.test(noSpace)) return noSpace;
  const ein = normalizeUsEinDigits(noSpace);
  if (ein) return ein;
  return null;
}

function resolveCreditCodeFromBody(body = {}, existing = null) {
  if (!Object.prototype.hasOwnProperty.call(body, 'credit_code')) {
    return { value: existing == null ? null : existing };
  }
  const raw = body.credit_code;
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }
  const value = normalizeCreditCodeValue(raw);
  if (value === null && String(raw).replace(/\s+/g, '') !== '') {
    return { error: CREDIT_CODE_TYPE_ERROR };
  }
  return { value };
}

function normalizeStandaloneCreditCode(raw) {
  const value = normalizeCreditCodeValue(raw);
  if (value === null) {
    const empty = !String(raw || '').replace(/\s+/g, '');
    return { error: empty ? '信用代码不能为空' : CREDIT_CODE_TYPE_ERROR };
  }
  return { value };
}

ensureCompaniesSamplingSchema(pool).catch((error) => {
  console.error('初始化企业抽查统计失败:', error);
});

/** 仅限开发管理员 / 数据管理员修改或创建企业档案（与企业管理页对齐） */
const requireCompanyManagers = () => requireRoles(['developer', 'data_admin']);

function normalizeOptionalText(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function buildUnqualifiedCompanySourceSql() {
  return `
    SELECT
      csr.company_id,
      csr.product_name,
      csr.sampled_at AS record_date,
      csr.product_type,
      csr.announcement_type,
      'announcement' AS source_type,
      csr.announcement_id AS source_id,
      a.title AS source_title
    FROM company_sampling_records csr
    LEFT JOIN announcements a ON csr.announcement_id = a.id

    UNION ALL

    SELECT
      d.company_id,
      d.product_name,
      COALESCE(i.inspection_date, DATE(d.created_at), DATE(i.created_at)) AS record_date,
      a.product_type AS product_type,
      COALESCE(a.announcement_type, 'sampling') AS announcement_type,
      'inspection' AS source_type,
      i.id AS source_id,
      i.title AS source_title
    FROM inspection_details d
    LEFT JOIN inspections i ON d.inspection_id = i.id
    LEFT JOIN announcements a ON i.announcement_id = a.id
    WHERE d.inspection_result = 'unqualified' AND d.company_id IS NOT NULL

    UNION ALL

    SELECT
      csr.company_id,
      NULL AS product_name,
      COALESCE(s.publish_date, s.supervision_date) AS record_date,
      csr.product_type,
      csr.announcement_type,
      'supervision' AS source_type,
      csr.supervision_id AS source_id,
      s.title AS source_title
    FROM company_supervision_records csr
    JOIN supervisions s ON csr.supervision_id = s.id
    WHERE s.status != 'completed' AND s.defects_and_problems IS NOT NULL AND s.defects_and_problems != ''
  `;
}

function applyUnqualifiedCompanyFilters(queryParts, params, filters = {}) {
  const keyword = normalizeOptionalText(filters.keyword);
  const province = normalizeOptionalText(filters.province);
  const productType = normalizeOptionalText(filters.product_type);
  const sourceType = normalizeOptionalText(filters.source_type);
  const year = Number.parseInt(filters.year, 10);
  const productKeyword = normalizeOptionalText(filters.product_keyword);
  const sourceKeyword = normalizeOptionalText(filters.source_keyword);

  if (keyword) {
    queryParts.push('(c.name LIKE ? OR c.brand LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  if (province) {
    queryParts.push('c.province = ?');
    params.push(province);
  }

  if (productType) {
    queryParts.push('source.product_type = ?');
    params.push(normalizeProductType(productType));
  }

  if (sourceType) {
    queryParts.push('source.source_type = ?');
    params.push(sourceType);
  }

  if (Number.isInteger(year)) {
    queryParts.push('YEAR(source.record_date) = ?');
    params.push(year);
  }

  if (productKeyword) {
    queryParts.push('source.product_name LIKE ?');
    params.push(`%${productKeyword}%`);
  }

  if (sourceKeyword) {
    queryParts.push('source.source_title LIKE ?');
    params.push(`%${sourceKeyword}%`);
  }
}

/** 与列表筛选 has_unqualified、不合格来源 UNION 语义一致（按企业粒度 EXISTS，避免对大 UNION 结果做 IN） */
function buildCompanyHasUnqualifiedExists(alias = 'c') {
  return `(
    EXISTS (SELECT 1 FROM company_sampling_records csr WHERE csr.company_id = ${alias}.id)
    OR EXISTS (
      SELECT 1 FROM inspection_details d
      WHERE d.company_id = ${alias}.id AND d.inspection_result = 'unqualified'
    )
    OR EXISTS (
      SELECT 1 FROM company_supervision_records csr2
      INNER JOIN supervisions s ON s.id = csr2.supervision_id
      WHERE csr2.company_id = ${alias}.id
        AND s.status != 'completed'
        AND s.defects_and_problems IS NOT NULL
        AND s.defects_and_problems != ''
    )
  )`;
}

/** DISTINCT 不合格关联企业 ID，仅 company_id 列 UNION，供大盘 COUNT 使用 */
function buildUnqualifiedDistinctCompanyUnionSql() {
  return `
    SELECT company_id FROM company_sampling_records
    UNION
    SELECT company_id FROM inspection_details
    WHERE company_id IS NOT NULL AND inspection_result = 'unqualified'
    UNION
    SELECT csr.company_id FROM company_supervision_records csr
    INNER JOIN supervisions s ON s.id = csr.supervision_id
    WHERE csr.company_id IS NOT NULL
      AND s.status != 'completed'
      AND s.defects_and_problems IS NOT NULL
      AND s.defects_and_problems != ''
  `;
}

// 获取企业列表（支持筛选和搜索）
router.get('/', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const {
      name,
      brand,
      province,
      product_category,
      has_unqualified,
      credit_code,
      credit_code_empty,
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;

    let query = `
      SELECT
        c.id, c.name, c.brand, c.credit_code, c.type, c.province, c.city, c.address,
        c.product_category, c.created_at, c.updated_at,
        COALESCE(c.sampled_count, 0) AS sampled_count,
        COALESCE(c.last_sampled_at, NULL) AS last_sampled_at
      FROM companies c
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM companies c WHERE 1=1';
    const params = [];
    const countParams = [];

    if (name) {
      query += ' AND c.name LIKE ?';
      countQuery += ' AND c.name LIKE ?';
      params.push(`%${name}%`);
      countParams.push(`%${name}%`);
    }
    if (brand) {
      query += ' AND c.brand LIKE ?';
      countQuery += ' AND c.brand LIKE ?';
      params.push(`%${brand}%`);
      countParams.push(`%${brand}%`);
    }
    if (province) {
      query += ' AND c.province = ?';
      countQuery += ' AND c.province = ?';
      params.push(province);
      countParams.push(province);
    }
    if (product_category) {
      query += ' AND c.product_category = ?';
      countQuery += ' AND c.product_category = ?';
      params.push(product_category);
      countParams.push(product_category);
    }

    if (has_unqualified === 'true') {
      const condition = ` AND ${buildCompanyHasUnqualifiedExists('c')}`;
      query += condition;
      countQuery += condition;
    }

    if (credit_code_empty === 'true' || credit_code_empty === '1') {
      const emptyCond = ` AND (c.credit_code IS NULL OR TRIM(c.credit_code) = '')`;
      query += emptyCond;
      countQuery += emptyCond;
    }

    const creditCodeKw = typeof credit_code === 'string' ? credit_code.trim() : '';
    if (creditCodeKw) {
      query += ' AND c.credit_code LIKE ?';
      countQuery += ' AND c.credit_code LIKE ?';
      params.push(`%${creditCodeKw}%`);
      countParams.push(`%${creditCodeKw}%`);
    }

    query += ' ORDER BY COALESCE(c.sampled_count, 0) DESC, c.updated_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows] = await pool.query(query, params);
    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countResult[0].total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countResult[0].total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取企业列表失败:', error);
    res.status(500).json({ success: false, message: '获取企业列表失败' });
  }
});

// 获取企业统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const [
      [totalCompanies],
      [totalInspections],
      [unqualifiedCompanies],
      [topUnqualified],
      [provinceStats],
      [unqualifiedProvinceStats]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS count FROM companies'),
      pool.query(`
        SELECT COUNT(*) AS count FROM (
          SELECT company_id FROM company_sampling_records WHERE company_id IS NOT NULL
          UNION
          SELECT company_id FROM inspection_details WHERE company_id IS NOT NULL
          UNION
          SELECT company_id FROM company_supervision_records WHERE company_id IS NOT NULL
        ) sampled_companies
      `),
      pool.query(`
        SELECT COUNT(*) AS count FROM (
          ${buildUnqualifiedDistinctCompanyUnionSql()}
        ) unqualified_companies
      `),
      pool.query(`
        SELECT
          c.id,
          c.name,
          c.brand,
          c.province,
          COUNT(*) AS unqualified_count,
          GROUP_CONCAT(DISTINCT source.product_name ORDER BY source.product_name SEPARATOR '、') AS unqualified_products,
          MAX(source.record_date) AS last_unqualified_date,
          COALESCE(c.sampled_count, 0) AS sampled_count
        FROM companies c
        INNER JOIN (${buildUnqualifiedCompanySourceSql()}) source ON c.id = source.company_id
        GROUP BY c.id, c.name, c.brand, c.province, c.sampled_count
        ORDER BY unqualified_count DESC, last_unqualified_date DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT province, COUNT(*) AS count
        FROM companies
        WHERE province IS NOT NULL AND province != ''
        GROUP BY province
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT c.province, COUNT(DISTINCT c.id) AS count
        FROM companies c
        WHERE c.province IS NOT NULL AND c.province != ''
          AND ${buildCompanyHasUnqualifiedExists('c')}
        GROUP BY c.province
        ORDER BY count DESC
      `)
    ]);

    res.json({
      success: true,
      data: {
        total_companies: Number(totalCompanies[0].count || 0),
        inspected_companies: Number(totalInspections[0].count || 0),
        unqualified_companies: Number(unqualifiedCompanies[0].count || 0),
        top_unqualified: topUnqualified,
        province_stats: provinceStats,
        unqualified_province_stats: unqualifiedProvinceStats
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

router.get('/unqualified/filter-options', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const sourceSql = buildUnqualifiedCompanySourceSql();
    const [[provinceRows], [productTypeRows], [yearRows]] = await Promise.all([
      pool.query(`
        SELECT DISTINCT c.province
        FROM companies c
        JOIN (${sourceSql}) source ON c.id = source.company_id
        WHERE c.province IS NOT NULL AND TRIM(c.province) != ''
        ORDER BY c.province ASC
      `),
      pool.query(`
        SELECT DISTINCT source.product_type
        FROM (${sourceSql}) source
        WHERE source.product_type IS NOT NULL AND TRIM(source.product_type) != ''
        ORDER BY source.product_type ASC
      `),
      pool.query(`
        SELECT DISTINCT YEAR(source.record_date) AS year
        FROM (${sourceSql}) source
        WHERE source.record_date IS NOT NULL
        ORDER BY year DESC
      `)
    ]);

    res.json({
      success: true,
      data: {
        provinces: provinceRows.map((row) => ({ value: row.province, label: row.province })),
        product_types: getProductTypeOptions((productTypeRows || []).map((row) => row.product_type)),
        source_types: [
          { value: 'announcement', label: '抽检通告' },
          { value: 'inspection', label: '抽样检查' },
          { value: 'supervision', label: '飞行检查' }
        ],
        years: (yearRows || [])
          .map((row) => Number(row.year))
          .filter((value) => Number.isInteger(value) && value > 0)
          .map((value) => ({ value: String(value), label: `${value}年` }))
      }
    });
  } catch (error) {
    console.error('获取不合格企业筛选项失败:', error);
    res.status(500).json({ success: false, message: '获取不合格企业筛选项失败' });
  }
});

// 获取不合格企业列表（必须在 /:id 之前定义）
router.get('/unqualified/list', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const {
      page = 1,
      limit = 10,
      keyword = '',
      province = '',
      product_type = '',
      source_type = '',
      year = '',
      product_keyword = '',
      source_keyword = ''
    } = req.query;
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;
    const sourceSql = buildUnqualifiedCompanySourceSql();

    const queryParts = ['1=1'];
    const queryParams = [];
    applyUnqualifiedCompanyFilters(queryParts, queryParams, {
      keyword,
      province,
      product_type,
      source_type,
      year,
      product_keyword,
      source_keyword
    });

    const [rows] = await pool.query(
      `
        SELECT
          c.id,
          c.name,
          c.brand,
          c.province,
          COUNT(*) AS unqualified_count,
          GROUP_CONCAT(DISTINCT source.product_name ORDER BY source.product_name SEPARATOR '、') AS unqualified_products,
          GROUP_CONCAT(DISTINCT source.source_title ORDER BY source.record_date DESC SEPARATOR '；') AS source_titles,
          GROUP_CONCAT(DISTINCT source.source_type ORDER BY source.source_type SEPARATOR '、') AS source_types,
          MAX(source.record_date) AS last_unqualified_date,
          COALESCE(c.sampled_count, 0) AS sampled_count
        FROM companies c
        JOIN (${sourceSql}) source ON c.id = source.company_id
        WHERE ${queryParts.join(' AND ')}
        GROUP BY c.id, c.name, c.brand, c.province, c.sampled_count
        ORDER BY unqualified_count DESC, last_unqualified_date DESC, c.updated_at DESC
        LIMIT ? OFFSET ?
      `,
      [...queryParams, pageSize, offset]
    );

    const [countResult] = await pool.query(
      `
        SELECT COUNT(DISTINCT c.id) AS total
        FROM companies c
        JOIN (${sourceSql}) source ON c.id = source.company_id
        WHERE ${queryParts.join(' AND ')}
      `,
      queryParams
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: Number(countResult[0].total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countResult[0].total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取不合格企业列表失败:', error);
    res.status(500).json({ success: false, message: '获取不合格企业列表失败' });
  }
});


router.get('/filter-options', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const [[provinceRows], [productCategoryRows]] = await Promise.all([
      pool.query(`
        SELECT DISTINCT province
        FROM companies
        WHERE province IS NOT NULL AND TRIM(province) != ''
        ORDER BY province ASC
      `),
      pool.query(`
        SELECT DISTINCT product_category
        FROM companies
        WHERE product_category IS NOT NULL AND TRIM(product_category) != ''
        ORDER BY product_category ASC
      `)
    ]);

    res.json({
      success: true,
      data: {
        provinces: provinceRows.map((row) => ({ value: row.province, label: row.province })),
        product_categories: productCategoryRows.map((row) => ({ value: row.product_category, label: row.product_category }))
      }
    });
  } catch (error) {
    console.error('获取企业筛选项失败:', error);
    res.status(500).json({ success: false, message: '获取企业筛选项失败' });
  }
});

/**
 * 批量写入统一社会信用代码：按企业 id 或精确企业名称匹配；默认仅填充当前为空的记录
 * body: { items: [{ id?: number, name?: string, credit_code: string }], overwrite?: boolean }
 */
router.post('/bulk-credit-codes', requireCompanyManagers(), async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    const overwrite = body.overwrite === true || body.overwrite === 'true' || body.overwrite === '1';

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: '请提供 items 数组' });
    }

    const maxItems = 3000;
    if (items.length > maxItems) {
      return res.status(400).json({ success: false, message: `单次最多导入 ${maxItems} 条` });
    }

    const updated = [];
    const skipped = [];
    const failed = [];

    // 防重复：同一批内同一信用代码不可对应多家企业
    const codeToTarget = new Map();
    for (let i = 0; i < items.length; i += 1) {
      const row = items[i] || {};
      const codeNorm = normalizeStandaloneCreditCode(row.credit_code);
      if (codeNorm.error) {
        failed.push({ index: i, key: row.id ?? row.name, message: codeNorm.error });
        continue;
      }
      const code = codeNorm.value;
      let companyRow = null;

      if (row.id !== undefined && row.id !== null && row.id !== '') {
        const idNum = Number.parseInt(String(row.id), 10);
        if (!idNum || idNum < 1) {
          failed.push({ index: i, key: row.id, message: '无效的企业 id' });
          continue;
        }
        const [r0] = await pool.query(
          'SELECT id, name, credit_code FROM companies WHERE id = ? LIMIT 1',
          [idNum]
        );
        if (!r0.length) {
          failed.push({ index: i, key: idNum, message: '企业不存在' });
          continue;
        }
        companyRow = r0[0];
      } else if (row.name !== undefined && row.name !== null && String(row.name).trim()) {
        const nm = String(row.name).trim();
        const [r1] = await pool.query(
          'SELECT id, name, credit_code FROM companies WHERE name = ? ORDER BY id ASC',
          [nm]
        );
        if (!r1.length) {
          failed.push({ index: i, key: nm, message: '未找到同名企业' });
          continue;
        }
        if (r1.length > 1) {
          failed.push({ index: i, key: nm, message: `企业名称重复（${r1.length} 条），请改用 id` });
          continue;
        }
        companyRow = r1[0];
      } else {
        failed.push({ index: i, key: null, message: '每条需提供 id 或 name' });
        continue;
      }

      const companyId = companyRow.id;
      const matchLabel = companyRow.name ? `${companyRow.name}(id:${companyId})` : String(companyId);

      const prevId = codeToTarget.get(code);
      if (prevId !== undefined && prevId !== companyId) {
        failed.push({
          index: i,
          key: matchLabel,
          message: '本批次内该信用代码已对应其他企业'
        });
        continue;
      }
      codeToTarget.set(code, companyId);

      const existingVal = companyRow.credit_code;
      const hasExisting =
        existingVal != null && String(existingVal).replace(/\s/g, '') !== '';
      if (hasExisting && !overwrite) {
        skipped.push({
          id: companyId,
          name: companyRow.name || '',
          credit_code: code,
          reason: '已有信用代码'
        });
        continue;
      }

      try {
        await pool.query('UPDATE companies SET credit_code = ? WHERE id = ?', [code, companyId]);
        updated.push({ id: companyId, name: companyRow.name || '', credit_code: code });
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          failed.push({ index: i, key: matchLabel, message: '该信用代码已被其他企业占用' });
        } else {
          failed.push({ index: i, key: matchLabel, message: err.message || '更新失败' });
        }
      }
    }

    res.json({
      success: true,
      message: `完成：成功 ${updated.length}，跳过 ${skipped.length}，失败 ${failed.length}`,
      data: { updated, skipped, failed }
    });
  } catch (error) {
    console.error('批量导入信用代码失败:', error);
    res.status(500).json({ success: false, message: '批量导入信用代码失败' });
  }
});

// 获取企业详情
router.get('/:id', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { id } = req.params;

    const [companyRows] = await pool.query(
      'SELECT *, COALESCE(sampled_count, 0) AS sampled_count FROM companies WHERE id = ?',
      [id]
    );
    if (companyRows.length === 0) {
      return res.status(404).json({ success: false, message: '企业不存在' });
    }

    const includeHistory = req.query.include_history !== '0' && req.query.include_history !== 'false';

    let historyLimit = Number.parseInt(String(req.query.history_limit ?? '2000'), 10);
    if (!Number.isFinite(historyLimit)) historyLimit = 2000;
    if (historyLimit < 1) historyLimit = 2000;
    if (historyLimit > 10000) historyLimit = 10000;

    const historySql = `
      SELECT *
      FROM (
        SELECT
          'announcement' AS source_type,
          a.id AS source_id,
          a.title,
          a.publish_date AS inspection_date,
          NULL AS level,
          csr.product_name,
          NULL AS brand,
          'unqualified' AS inspection_result,
          apd.unqualified_items,
          apd.requirement AS inspection_standard
        FROM company_sampling_records csr
        LEFT JOIN announcements a ON csr.announcement_id = a.id
        LEFT JOIN announcement_product_details apd ON csr.announcement_detail_id = apd.id
        WHERE csr.company_id = ?

        UNION ALL

        SELECT
          'inspection' AS source_type,
          i.id AS source_id,
          i.title,
          i.inspection_date,
          i.level,
          d.product_name,
          d.brand,
          d.inspection_result,
          d.unqualified_items,
          d.inspection_standard
        FROM inspection_details d
        LEFT JOIN inspections i ON d.inspection_id = i.id
        WHERE d.company_id = ?

        UNION ALL

        SELECT
          'supervision' AS source_type,
          s.id AS source_id,
          s.title,
          COALESCE(s.publish_date, s.supervision_date) AS inspection_date,
          s.level,
          NULL AS product_name,
          NULL AS brand,
          CASE WHEN s.status != 'completed' THEN 'unqualified' ELSE 'qualified' END AS inspection_result,
          s.defects_and_problems AS unqualified_items,
          s.inspection_basis AS inspection_standard
        FROM company_supervision_records csr
        LEFT JOIN supervisions s ON csr.supervision_id = s.id
        LEFT JOIN flight_inspection_detail fid ON csr.supervision_detail_id = fid.id
        WHERE csr.company_id = ?
      ) history
      ORDER BY inspection_date DESC, source_type DESC, source_id DESC
      LIMIT ?
    `;

    const aggPromises = [
      pool.query(
        `
      SELECT
        COUNT(*) AS record_count,
        COUNT(DISTINCT inspection_id) AS inspection_count,
        COUNT(DISTINCT product_name) AS product_count,
        SUM(CASE WHEN inspection_result = 'qualified' THEN 1 ELSE 0 END) AS qualified_count,
        SUM(CASE WHEN inspection_result = 'unqualified' THEN 1 ELSE 0 END) AS unqualified_count
      FROM inspection_details
      WHERE company_id = ?
    `,
        [id]
      ),
      pool.query(
        `
      SELECT
        COUNT(*) AS supervision_count,
        COUNT(DISTINCT supervision_id) AS unique_supervision_count
      FROM company_supervision_records
      WHERE company_id = ?
    `,
        [id]
      )
    ];

    if (includeHistory) {
      aggPromises.push(pool.query(historySql, [id, id, id, historyLimit]));
    }

    const results = await Promise.all(aggPromises);
    const [statsRows] = results[0];
    const [supervisionStatsRows] = results[1];
    let historyRows = [];
    if (includeHistory) {
      const [hRows] = results[2];
      historyRows = hRows;
    }

    const stats = statsRows[0] || {};
    const supervisionStats = supervisionStatsRows[0] || {};
    const recordCount = Number(stats.record_count || 0);
    const qualifiedCount = Number(stats.qualified_count || 0);
    const unqualifiedCount = Number(stats.unqualified_count || 0);
    const supervisionCount = Number(supervisionStats.unique_supervision_count || 0);
    const sampledCount = Number(companyRows[0].sampled_count || 0);

    res.json({
      success: true,
      data: {
        company: companyRows[0],
        stats: {
          sampled_count: sampledCount,
          inspection_count: Number(stats.inspection_count || 0),
          supervision_count: supervisionCount,
          product_count: Number(stats.product_count || 0),
          qualified_count: qualifiedCount,
          unqualified_count: unqualifiedCount,
          qualified_rate: recordCount > 0 ? Number(((qualifiedCount / recordCount) * 100).toFixed(1)) : 0,
          last_sampled_at: companyRows[0].last_sampled_at || null
        },
        history: historyRows,
        history_meta: {
          included: includeHistory,
          limit: includeHistory ? historyLimit : 0,
          truncated: Boolean(includeHistory && historyRows.length >= historyLimit)
        }
      }
    });
  } catch (error) {
    console.error('获取企业详情失败:', error);
    res.status(500).json({ success: false, message: '获取企业详情失败' });
  }
});

// 创建企业
router.post('/', requireCompanyManagers(), async (req, res) => {


  try {
    await ensureCompaniesSamplingSchema(pool);

    const { name, brand, type, address, province, city, product_category } = req.body || {};


    const normalizedName = typeof name === 'string' ? name.trim() : '';


    if (!normalizedName) {


      return res.status(400).json({ success: false, message: '企业名称不能为空' });


    }

    const normalizedType = typeof type === 'string' && type.trim()


      ? type.trim()


      : 'manufacturer';


    const allowedTypes = new Set(['manufacturer', 'distributor', 'seller']);


    if (!allowedTypes.has(normalizedType)) {


      return res.status(400).json({ success: false, message: '企业类型无效' });


    }

    const normalizedCategory =
      typeof product_category === 'string' && product_category.trim()
        ? product_category.trim()
        : null;

    const creditResolved = resolveCreditCodeFromBody(req.body || {}, null);
    if (creditResolved.error) {
      return res.status(400).json({ success: false, message: creditResolved.error });
    }

    const [result] = await pool.query(`
      INSERT INTO companies (
        name,
        brand,
        credit_code,
        type,
        address,
        province,
        city,
        product_category,
        sampled_count,
        last_sampled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `, [
      normalizedName,
      brand || null,
      creditResolved.value,
      normalizedType,
      address || null,
      province || null,
      city || null,
      normalizedCategory
    ]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: '该统一社会信用代码已被其他企业使用' });
    }
    console.error('创建企业失败:', error);


    res.status(500).json({ success: false, message: '创建企业失败' });


  }


});

// 更新企业（主档字段；不含统计字段 sampled_count —— 仍由同步任务维护）
router.put('/:id', requireCompanyManagers(), async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { id } = req.params;

    const [existingRows] = await pool.query('SELECT * FROM companies WHERE id = ? LIMIT 1', [id]);

    if (!existingRows || !existingRows.length) {

      return res.status(404).json({ success: false, message: '企业不存在' });


    }



    const body = req.body || {};



    const name = typeof body.name === 'string' ? body.name.trim() : existingRows[0].name;



    const brand = typeof body.brand === 'string' ? body.brand.trim() : (body.brand === null ? null : existingRows[0].brand);



    const type = typeof body.type === 'string' ? body.type.trim() : existingRows[0].type;



    const address = typeof body.address === 'string' ? body.address.trim() : (body.address === null ? null : existingRows[0].address);



    const province = typeof body.province === 'string' ? body.province.trim() : (body.province === null ? null : existingRows[0].province);



    const city = typeof body.city === 'string' ? body.city.trim() : (body.city === null ? null : existingRows[0].city);



    const productCategoryRaw = body.product_category;



    let product_category = existingRows[0].product_category;



    if (productCategoryRaw === null || productCategoryRaw === '') {


      product_category = null;



    } else if (typeof productCategoryRaw === 'string') {


      product_category = productCategoryRaw.trim() || null;


    }



    const allowedTypes = new Set(['manufacturer', 'distributor', 'seller']);



    if (!name) {


      return res.status(400).json({ success: false, message: '企业名称不能为空' });



    }


    if (!allowedTypes.has(type)) {


      return res.status(400).json({ success: false, message: '企业类型无效，请使用 manufacturer / distributor / seller' });



    }

    const creditResolved = resolveCreditCodeFromBody(body, existingRows[0].credit_code);
    if (creditResolved.error) {
      return res.status(400).json({ success: false, message: creditResolved.error });
    }

    try {
      await pool.query(
        `
      UPDATE companies
      SET name = ?, brand = ?, credit_code = ?, type = ?, address = ?, province = ?, city = ?, product_category = ?
      WHERE id = ?
    `,
        [name, brand, creditResolved.value, type, address, province, city, product_category, id]
      );
    } catch (updateErr) {
      if (updateErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: '该统一社会信用代码已被其他企业使用' });
      }
      throw updateErr;
    }

    const [updatedRows] = await pool.query(
      'SELECT *, COALESCE(sampled_count, 0) AS sampled_count FROM companies WHERE id = ? LIMIT 1',
      [id]
    );

    res.json({ success: true, message: '企业信息已更新', data: updatedRows[0] });
  } catch (error) {
    console.error('更新企业失败:', error);


    res.status(500).json({ success: false, message: '更新企业失败' });


  }


});

// 删除企业


router.delete('/:id', requireCompanyManagers(), async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { id } = req.params;

    await pool.query('DELETE FROM company_sampling_records WHERE company_id = ?', [id]);
    await pool.query('DELETE FROM company_supervision_records WHERE company_id = ?', [id]);
    await pool.query('UPDATE inspection_details SET company_id = NULL WHERE company_id = ?', [id]);
    await pool.query('DELETE FROM companies WHERE id = ?', [id]);


    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除企业失败:', error);
    res.status(500).json({ success: false, message: '删除企业失败' });
  }
});

module.exports = router;
