const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  DEFAULT_FOOD_JSON_DIR,
  ensureFoodInspectionSchema,
  importFoodInspectionJsonDirectory
} = require('../utils/foodInspectionStore');

ensureFoodInspectionSchema(pool).catch((error) => {
  console.error('初始化食品抽检原始表失败:', error);
});

function clampLimit(limit, defaultValue = 20, maxValue = 200) {
  const n = Number.parseInt(limit, 10);
  if (Number.isNaN(n) || n <= 0) return defaultValue;
  return Math.min(n, maxValue);
}

router.post('/import-json', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const directory = req.body?.directory || DEFAULT_FOOD_JSON_DIR;
    const result = await importFoodInspectionJsonDirectory(connection, directory);
    res.json({
      success: true,
      message: `食品抽检 JSON 入库完成：成功 ${result.imported_count} 个，异常 ${result.error_count} 个`,
      data: result
    });
  } catch (error) {
    console.error('食品抽检 JSON 入库失败:', error);
    res.status(500).json({ success: false, message: error.message || '食品抽检 JSON 入库失败' });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureFoodInspectionSchema(pool);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = clampLimit(req.query.limit);
    const offset = (page - 1) * limit;
    const keyword = String(req.query.keyword || '').trim();
    const where = [];
    const params = [];
    if (keyword) {
      where.push('(title LIKE ? OR announcement_no LIKE ? OR source_detail_url LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `
        SELECT *
        FROM food_inspection
        ${whereSql}
        ORDER BY publish_date DESC, id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM food_inspection ${whereSql}`,
      params
    );
    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.total || 0)
      }
    });
  } catch (error) {
    console.error('查询食品抽检原始表失败:', error);
    res.status(500).json({ success: false, message: '查询食品抽检原始表失败' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await ensureFoodInspectionSchema(pool);
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT * FROM food_inspection WHERE id = ? LIMIT 1', [id]);
    const row = rows[0] || null;
    if (!row) {
      res.status(404).json({ success: false, message: '食品抽检记录不存在' });
      return;
    }
    const [attachments] = await pool.query(
      'SELECT * FROM food_inspection_attachments WHERE food_inspection_id = ? ORDER BY id ASC',
      [id]
    );
    const [products] = await pool.query(
      'SELECT * FROM food_inspection_products WHERE food_inspection_id = ? ORDER BY sequence_no ASC, id ASC',
      [id]
    );
    const [foodContents] = await pool.query(
      'SELECT * FROM food_content WHERE food_inspection_id = ? ORDER BY ordinal_index ASC, id ASC',
      [id]
    );
    res.json({
      success: true,
      data: {
        ...row,
        attachments,
        products,
        food_contents: foodContents
      }
    });
  } catch (error) {
    console.error('获取食品抽检详情失败:', error);
    res.status(500).json({ success: false, message: '获取食品抽检详情失败' });
  }
});

module.exports = router;
