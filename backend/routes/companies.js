const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { ensureCompaniesSamplingSchema } = require('../utils/companySamplingSync');

ensureCompaniesSamplingSchema(pool).catch((error) => {
  console.error('初始化企业抽查统计失败:', error);
});

function buildUnqualifiedCompanySourceSql() {
  return `
    SELECT company_id, product_name, sampled_at AS record_date
    FROM company_sampling_records
    UNION ALL
    SELECT company_id, product_name, DATE(created_at) AS record_date
    FROM inspection_details
    WHERE inspection_result = 'unqualified' AND company_id IS NOT NULL
    UNION ALL
    SELECT csr.company_id, NULL AS product_name, DATE(s.publish_date) AS record_date
    FROM company_supervision_records csr
    JOIN supervisions s ON csr.supervision_id = s.id
    WHERE s.status != 'completed' AND s.defects_and_problems IS NOT NULL AND s.defects_and_problems != ''
  `;
}

// 获取企业列表（支持筛选和搜索）
router.get('/', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { name, brand, province, has_unqualified, page = 1, limit = 10 } = req.query;
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;

    let query = `
      SELECT c.*, COALESCE(c.sampled_count, 0) AS sampled_count
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

    if (has_unqualified === 'true') {
      const condition = ` AND c.id IN (
        SELECT DISTINCT source.company_id
        FROM (
          ${buildUnqualifiedCompanySourceSql()}
        ) source
      )`;
      query += condition;
      countQuery += condition;
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

    const [totalCompanies] = await pool.query('SELECT COUNT(*) as count FROM companies');
    const [totalInspections] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as count
      FROM (
        SELECT company_id FROM company_sampling_records
        UNION
        SELECT company_id FROM inspection_details WHERE company_id IS NOT NULL
        UNION
        SELECT company_id FROM company_supervision_records
      ) sampled_companies
    `);
    const [unqualifiedCompanies] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as count
      FROM (
        ${buildUnqualifiedCompanySourceSql()}
      ) unqualified_source
    `);

    const [topUnqualified] = await pool.query(`
      SELECT
        c.id, c.name, c.brand, c.province,
        COUNT(*) as unqualified_count,
        GROUP_CONCAT(DISTINCT source.product_name ORDER BY source.product_name SEPARATOR '、') as unqualified_products,
        MAX(source.record_date) as last_unqualified_date,
        COALESCE(c.sampled_count, 0) as sampled_count
      FROM companies c
      JOIN (
        ${buildUnqualifiedCompanySourceSql()}
      ) source ON c.id = source.company_id
      GROUP BY c.id, c.name, c.brand, c.province, c.sampled_count
      ORDER BY unqualified_count DESC, last_unqualified_date DESC
      LIMIT 10
    `);

    const [provinceStats] = await pool.query(`
      SELECT province, COUNT(*) as count
      FROM companies
      WHERE province IS NOT NULL AND province != ''
      GROUP BY province
      ORDER BY count DESC
    `);
    const [unqualifiedProvinceStats] = await pool.query(`
      SELECT c.province, COUNT(DISTINCT c.id) as count
      FROM companies c
      JOIN (
        SELECT DISTINCT company_id
        FROM (
          ${buildUnqualifiedCompanySourceSql()}
        ) unqualified_source
      ) unqualified_companies ON unqualified_companies.company_id = c.id
      WHERE c.province IS NOT NULL AND c.province != ''
      GROUP BY c.province
      ORDER BY count DESC
    `);

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

// 获取不合格企业列表（必须在 /:id 之前定义）
router.get('/unqualified/list', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { page = 1, limit = 10 } = req.query;
    const currentPage = parseInt(page, 10) || 1;
    const pageSize = parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;

    const [rows] = await pool.query(`
      SELECT
        c.id, c.name, c.brand, c.province,
        COUNT(*) as unqualified_count,
        GROUP_CONCAT(DISTINCT source.product_name ORDER BY source.product_name SEPARATOR '、') as unqualified_products,
        MAX(source.record_date) as last_unqualified_date,
        COALESCE(c.sampled_count, 0) as sampled_count
      FROM companies c
      JOIN (
        ${buildUnqualifiedCompanySourceSql()}
      ) source ON c.id = source.company_id
      GROUP BY c.id, c.name, c.brand, c.province, c.sampled_count
      ORDER BY unqualified_count DESC, last_unqualified_date DESC
      LIMIT ? OFFSET ?
    `, [pageSize, offset]);

    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as total
      FROM (
        ${buildUnqualifiedCompanySourceSql()}
      ) source
    `);

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

    const [statsRows] = await pool.query(`
      SELECT
        COUNT(*) AS record_count,
        COUNT(DISTINCT inspection_id) AS inspection_count,
        COUNT(DISTINCT product_name) AS product_count,
        SUM(CASE WHEN inspection_result = 'qualified' THEN 1 ELSE 0 END) AS qualified_count,
        SUM(CASE WHEN inspection_result = 'unqualified' THEN 1 ELSE 0 END) AS unqualified_count
      FROM inspection_details
      WHERE company_id = ?
    `, [id]);

    const [supervisionStatsRows] = await pool.query(`
      SELECT
        COUNT(*) AS supervision_count,
        COUNT(DISTINCT supervision_id) AS unique_supervision_count
      FROM company_supervision_records
      WHERE company_id = ?
    `, [id]);

    const [historyRows] = await pool.query(`
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
    `, [id, id, id]);

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
        history: historyRows
      }
    });
  } catch (error) {
    console.error('获取企业详情失败:', error);
    res.status(500).json({ success: false, message: '获取企业详情失败' });
  }
});

// 创建企业
router.post('/', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { name, brand, type, address, province, city } = req.body;

    const [result] = await pool.query(`
      INSERT INTO companies (name, brand, type, address, province, city, sampled_count, last_sampled_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
    `, [name, brand, type, address, province, city]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建企业失败:', error);
    res.status(500).json({ success: false, message: '创建企业失败' });
  }
});

// 更新企业
router.put('/:id', async (req, res) => {
  try {
    await ensureCompaniesSamplingSchema(pool);

    const { id } = req.params;
    const { name, brand, type, address, province, city } = req.body;

    await pool.query(`
      UPDATE companies
      SET name = ?, brand = ?, type = ?, address = ?, province = ?, city = ?
      WHERE id = ?
    `, [name, brand, type, address, province, city, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新企业失败:', error);
    res.status(500).json({ success: false, message: '更新企业失败' });
  }
});

// 删除企业
router.delete('/:id', async (req, res) => {
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
