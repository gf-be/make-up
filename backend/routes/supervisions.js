const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有督查结果列表
router.get('/', async (req, res) => {
  try {
    const { level, region, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM supervisions WHERE 1=1';
    const params = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    if (region) {
      query += ' AND region LIKE ?';
      params.push(`%${region}%`);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (title LIKE ? OR content LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY supervision_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM supervisions WHERE 1=1';
    const countParams = [];
    if (level) {
      countQuery += ' AND level = ?';
      countParams.push(level);
    }
    if (region) {
      countQuery += ' AND region LIKE ?';
      countParams.push(`%${region}%`);
    }
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countQuery += ' AND (title LIKE ? OR content LIKE ?)';
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
    console.error('获取督查结果列表失败:', error);
    res.status(500).json({ success: false, message: '获取督查结果列表失败' });
  }
});

// 获取督查结果详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM supervisions WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '督查记录不存在' });
    }

    // 更新浏览次数
    await pool.query('UPDATE supervisions SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取督查结果详情失败:', error);
    res.status(500).json({ success: false, message: '获取督查结果详情失败' });
  }
});

// 创建督查结果
router.post('/', async (req, res) => {
  try {
    const {
      title, supervision_date, supervision_unit, region,
      level, supervision_type, content, rectification_deadline,
      status, source
    } = req.body;

    const [result] = await pool.query(`
      INSERT INTO supervisions (title, supervision_date, supervision_unit, region, level,
        supervision_type, content, rectification_deadline, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, supervision_date, supervision_unit, region, level,
        supervision_type, content, rectification_deadline, status, source]);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建督查结果失败:', error);
    res.status(500).json({ success: false, message: '创建督查结果失败' });
  }
});

// 更新督查结果
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, supervision_date, supervision_unit, region,
      level, supervision_type, content, rectification_deadline, status
    } = req.body;

    await pool.query(`
      UPDATE supervisions
      SET title = ?, supervision_date = ?, supervision_unit = ?, region = ?, level = ?,
          supervision_type = ?, content = ?, rectification_deadline = ?, status = ?
      WHERE id = ?
    `, [title, supervision_date, supervision_unit, region, level,
        supervision_type, content, rectification_deadline, status, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新督查结果失败:', error);
    res.status(500).json({ success: false, message: '更新督查结果失败' });
  }
});

// 删除督查结果
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM supervisions WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除督查结果失败:', error);
    res.status(500).json({ success: false, message: '删除督查结果失败' });
  }
});

// 获取统计数据
router.get('/stats/overview', async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as count FROM supervisions');
    const [ongoing] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE status = 'ongoing'");
    const [completed] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE status = 'completed'");
    const [pending] = await pool.query("SELECT COUNT(*) as count FROM supervisions WHERE status = 'pending_rectification'");

    res.json({
      success: true,
      data: {
        total: total[0].count,
        ongoing: ongoing[0].count,
        completed: completed[0].count,
        pending: pending[0].count
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

module.exports = router;
