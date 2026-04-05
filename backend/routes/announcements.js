const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有公告列表
router.get('/', async (req, res) => {
  try {
    const { type, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT a.*, u.username as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND a.type = ?';
      params.push(type);
    }
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (a.title LIKE ? OR a.content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY a.is_top DESC, a.publish_date DESC, a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM announcements a WHERE 1=1';
    const countParams = [];
    if (type) {
      countQuery += ' AND a.type = ?';
      countParams.push(type);
    }
    if (status) {
      countQuery += ' AND a.status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countQuery += ' AND (a.title LIKE ? OR a.content LIKE ?)';
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
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, message: '获取公告列表失败' });
  }
});

// 获取公告详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT a.*, u.username as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '公告不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE announcements SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({ success: false, message: '获取公告详情失败' });
  }
});

// 创建公告
router.post('/', async (req, res) => {
  try {
    const { title, content, type, publish_date, expiry_date, is_top, status, author_id } = req.body;

    const [result] = await pool.query(`
      INSERT INTO announcements (title, content, type, publish_date, expiry_date, is_top, status, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, content, type, publish_date, expiry_date, is_top, status, author_id]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, message: '创建公告失败' });
  }
});

// 更新公告
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, publish_date, expiry_date, is_top, status } = req.body;

    await pool.query(`
      UPDATE announcements
      SET title = ?, content = ?, type = ?, publish_date = ?, expiry_date = ?, is_top = ?, status = ?
      WHERE id = ?
    `, [title, content, type, publish_date, expiry_date, is_top, status, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, message: '更新公告失败' });
  }
});

// 删除公告
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM announcements WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, message: '删除公告失败' });
  }
});

// 获取公告相关的检查记录
router.get('/:id/inspections', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT
        id.id,
        id.product_name,
        id.brand,
        id.manufacturer,
        id.inspection_result,
        id.unqualified_items,
        id.inspection_standard
      FROM inspection_details id
      INNER JOIN inspections i ON id.inspection_id = i.id
      WHERE i.announcement_id = ?
      ORDER BY id.created_at DESC
    `, [id]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取相关检查记录失败:', error);
    res.status(500).json({ success: false, message: '获取相关检查记录失败' });
  }
});

module.exports = router;
