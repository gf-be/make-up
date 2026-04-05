const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有政策列表
router.get('/', async (req, res) => {
  try {
    const { level, category_id, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, pc.name as category_name, u.username as author_name
      FROM policies p
      LEFT JOIN policy_categories pc ON p.category_id = pc.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (level) {
      query += ' AND p.level = ?';
      params.push(level);
    }
    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY p.publish_date DESC, p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM policies p WHERE 1=1';
    const countParams = [];
    if (level) {
      countQuery += ' AND p.level = ?';
      countParams.push(level);
    }
    if (category_id) {
      countQuery += ' AND p.category_id = ?';
      countParams.push(category_id);
    }
    if (status) {
      countQuery += ' AND p.status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countQuery += ' AND (p.title LIKE ? OR p.content LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
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
    console.error('获取政策列表失败:', error);
    res.status(500).json({ success: false, message: '获取政策列表失败' });
  }
});

// 获取政策详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT p.*, pc.name as category_name, u.username as author_name
      FROM policies p
      LEFT JOIN policy_categories pc ON p.category_id = pc.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '政策不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE policies SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取政策详情失败:', error);
    res.status(500).json({ success: false, message: '获取政策详情失败' });
  }
});

// 创建政策
router.post('/', async (req, res) => {
  try {
    const { title, content, category_id, level, publish_date, effective_date, status, source, author_id } = req.body;

    const [result] = await pool.query(`
      INSERT INTO policies (title, content, category_id, level, publish_date, effective_date, status, source, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, content, category_id, level, publish_date, effective_date, status, source, author_id]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建政策失败:', error);
    res.status(500).json({ success: false, message: '创建政策失败' });
  }
});

// 更新政策
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category_id, level, publish_date, effective_date, status, source } = req.body;

    await pool.query(`
      UPDATE policies
      SET title = ?, content = ?, category_id = ?, level = ?, publish_date = ?,
          effective_date = ?, status = ?, source = ?
      WHERE id = ?
    `, [title, content, category_id, level, publish_date, effective_date, status, source, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新政策失败:', error);
    res.status(500).json({ success: false, message: '更新政策失败' });
  }
});

// 删除政策
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM policies WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除政策失败:', error);
    res.status(500).json({ success: false, message: '删除政策失败' });
  }
});

// 获取政策分类
router.get('/categories/list', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM policy_categories ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败' });
  }
});

module.exports = router;
