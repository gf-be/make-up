const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有标准列表
router.get('/', async (req, res) => {
  try {
    const { type, category_id, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT s.*, sc.name as category_name
      FROM standards s
      LEFT JOIN standard_categories sc ON s.category_id = sc.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND s.type = ?';
      params.push(type);
    }
    if (category_id) {
      query += ' AND s.category_id = ?';
      params.push(category_id);
    }
    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (s.title LIKE ? OR s.code LIKE ? OR s.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY s.effective_date DESC, s.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM standards s WHERE 1=1';
    const countParams = [];
    if (type) {
      countQuery += ' AND s.type = ?';
      countParams.push(type);
    }
    if (category_id) {
      countQuery += ' AND s.category_id = ?';
      countParams.push(category_id);
    }
    if (status) {
      countQuery += ' AND s.status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countQuery += ' AND (s.title LIKE ? OR s.code LIKE ? OR s.content LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('获取标准列表失败:', error);
    res.status(500).json({ success: false, message: '获取标准列表失败' });
  }
});

// 获取标准详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT s.*, sc.name as category_name
      FROM standards s
      LEFT JOIN standard_categories sc ON s.category_id = sc.id
      WHERE s.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '标准不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE standards SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取标准详情失败:', error);
    res.status(500).json({ success: false, message: '获取标准详情失败' });
  }
});

// 创建标准
router.post('/', async (req, res) => {
  try {
    const { code, title, content, category_id, type, publish_date, effective_date, obsolete_date, status, source } = req.body;

    const [result] = await pool.query(`
      INSERT INTO standards (code, title, content, category_id, type, publish_date, effective_date, obsolete_date, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, title, content, category_id, type, publish_date, effective_date, obsolete_date, status, source]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建标准失败:', error);
    res.status(500).json({ success: false, message: '创建标准失败' });
  }
});

// 更新标准
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, title, content, category_id, type, publish_date, effective_date, obsolete_date, status, source } = req.body;

    await pool.query(`
      UPDATE standards
      SET code = ?, title = ?, content = ?, category_id = ?, type = ?, publish_date = ?,
          effective_date = ?, obsolete_date = ?, status = ?, source = ?
      WHERE id = ?
    `, [code, title, content, category_id, type, publish_date, effective_date, obsolete_date, status, source, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新标准失败:', error);
    res.status(500).json({ success: false, message: '更新标准失败' });
  }
});

// 删除标准
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM standards WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除标准失败:', error);
    res.status(500).json({ success: false, message: '删除标准失败' });
  }
});

// 获取标准分类
router.get('/categories/list', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM standard_categories ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败' });
  }
});

module.exports = router;
