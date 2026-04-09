const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { ensureUnqualifiedProductsTable } = require('../utils/unqualifiedProducts');

async function ensureUnqualifiedProductsReady() {
  await ensureUnqualifiedProductsTable(pool);
}

ensureUnqualifiedProductsReady().catch((error) => {
  console.error('初始化不符合规定化妆品数据失败:', error);
});

router.get('/stats/overview', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS loaded_count,
        COUNT(*) AS total_batches,
        COUNT(DISTINCT announcement_id) AS announcement_count,
        COUNT(DISTINCT sample_unit_name) AS sample_unit_count,
        COUNT(DISTINCT inspection_institution) AS institution_count
      FROM unqualified_products
      WHERE announcement_id IS NOT NULL
    `);
    const [companyRows] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) AS company_count
      FROM company_sampling_records
    `);

    res.json({
      success: true,
      data: {
        loaded_count: Number(rows[0]?.loaded_count || 0),
        total_batches: Number(rows[0]?.total_batches || 0),
        announcement_count: Number(rows[0]?.announcement_count || 0),
        company_count: Number(companyRows[0]?.company_count || 0),
        sample_unit_count: Number(rows[0]?.sample_unit_count || 0),
        institution_count: Number(rows[0]?.institution_count || 0)
      }
    });
  } catch (error) {
    console.error('获取不符合规定化妆品统计失败:', error);
    res.status(500).json({ success: false, message: '获取不符合规定化妆品统计失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const { keyword = '', unqualified_item = '', page = 1, limit = 10 } = req.query;
    const normalizedKeyword = String(keyword).trim();
    const normalizedItem = String(unqualified_item).trim();
    const currentPage = Number.parseInt(page, 10) || 1;
    const pageSize = Number.parseInt(limit, 10) || 10;
    const offset = (currentPage - 1) * pageSize;

    const conditions = ['announcement_id IS NOT NULL'];
    const params = [];

    if (normalizedKeyword) {
      conditions.push(`(
        product_name LIKE ? OR
        company_names LIKE ? OR
        sample_unit_name LIKE ? OR
        inspection_institution LIKE ?
      )`);
      params.push(
        `%${normalizedKeyword}%`,
        `%${normalizedKeyword}%`,
        `%${normalizedKeyword}%`,
        `%${normalizedKeyword}%`
      );
    }

    if (normalizedItem) {
      conditions.push('unqualified_items LIKE ?');
      params.push(`%${normalizedItem}%`);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(
      `
        SELECT *
        FROM unqualified_products
        WHERE ${whereClause}
        ORDER BY sequence_no ASC, id ASC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM unqualified_products
        WHERE ${whereClause}
      `,
      params
    );

    const [summaryRows] = await pool.query(
      `
        SELECT
          COUNT(*) AS loaded_count,
          COUNT(*) AS total_batches,
          COUNT(DISTINCT announcement_id) AS announcement_count,
          CASE
            WHEN COUNT(DISTINCT announcement_id) = 1 THEN MAX(batch_title)
            ELSE '全部抽检通告'
          END AS batch_title
        FROM unqualified_products
        WHERE ${whereClause}
      `,
      params
    );

    res.json({
      success: true,
      data: rows,
      summary: {
        batch_title: summaryRows[0]?.batch_title || '',
        loaded_count: Number(summaryRows[0]?.loaded_count || 0),
        total_batches: Number(summaryRows[0]?.total_batches || 0),
        announcement_count: Number(summaryRows[0]?.announcement_count || 0)
      },
      pagination: {
        total: Number(countRows[0]?.total || 0),
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(Number(countRows[0]?.total || 0) / pageSize)
      }
    });
  } catch (error) {
    console.error('获取不符合规定化妆品列表失败:', error);
    res.status(500).json({ success: false, message: '获取不符合规定化妆品列表失败' });
  }
});

module.exports = router;
