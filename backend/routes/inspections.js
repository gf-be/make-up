const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取所有抽样检查列表
router.get('/', async (req, res) => {
  try {
    const { level, region, status, page = 1, limit = 10, keyword } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM inspections WHERE 1=1';
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
      query += ' AND (title LIKE ? OR batch_number LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    query += ' ORDER BY inspection_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM inspections WHERE 1=1';
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
      countQuery += ' AND (title LIKE ? OR batch_number LIKE ?)';
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
    console.error('获取抽样检查列表失败:', error);
    res.status(500).json({ success: false, message: '获取抽样检查列表失败' });
  }
});

// 获取抽样检查详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query('SELECT * FROM inspections WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '抽样检查记录不存在' });
    }

    // 获取检查详情
    const [details] = await pool.query('SELECT * FROM inspection_details WHERE inspection_id = ?', [id]);

    // 更新浏览次数
    await pool.query('UPDATE inspections SET view_count = view_count + 1 WHERE id = ?', [id]);

    res.json({ success: true, data: { ...rows[0], details } });
  } catch (error) {
    console.error('获取抽样检查详情失败:', error);
    res.status(500).json({ success: false, message: '获取抽样检查详情失败' });
  }
});

// 创建抽样检查
router.post('/', async (req, res) => {
  try {
    const {
      title, batch_number, inspection_date, inspection_unit, region,
      level, total_samples, qualified_count, unqualified_count,
      qualified_rate, summary, status, source, details
    } = req.body;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query(`
        INSERT INTO inspections (title, batch_number, inspection_date, inspection_unit, region, level,
          total_samples, qualified_count, unqualified_count, qualified_rate, summary, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, batch_number, inspection_date, inspection_unit, region, level,
          total_samples, qualified_count, unqualified_count, qualified_rate, summary, status, source]);

      const inspectionId = result.insertId;

      // 插入详情记录
      if (details && details.length > 0) {
        for (const detail of details) {
          await connection.query(`
            INSERT INTO inspection_details (inspection_id, product_name, brand, manufacturer,
              production_date, sample_source, inspection_result, unqualified_items, inspection_standard)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [inspectionId, detail.product_name, detail.brand, detail.manufacturer,
              detail.production_date, detail.sample_source, detail.inspection_result,
              detail.unqualified_items, detail.inspection_standard]);
        }
      }

      await connection.commit();
      res.json({ success: true, data: { id: inspectionId } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建抽样检查失败:', error);
    res.status(500).json({ success: false, message: '创建抽样检查失败' });
  }
});

// 更新抽样检查
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, batch_number, inspection_date, inspection_unit, region,
      level, total_samples, qualified_count, unqualified_count,
      qualified_rate, summary, status, source
    } = req.body;

    await pool.query(`
      UPDATE inspections
      SET title = ?, batch_number = ?, inspection_date = ?, inspection_unit = ?, region = ?,
          level = ?, total_samples = ?, qualified_count = ?, unqualified_count = ?,
          qualified_rate = ?, summary = ?, status = ?, source = ?
      WHERE id = ?
    `, [title, batch_number, inspection_date, inspection_unit, region, level,
        total_samples, qualified_count, unqualified_count, qualified_rate,
        summary, status, source, id]);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新抽样检查失败:', error);
    res.status(500).json({ success: false, message: '更新抽样检查失败' });
  }
});

// 删除抽样检查
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('DELETE FROM inspection_details WHERE inspection_id = ?', [id]);
    await pool.query('DELETE FROM inspections WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除抽样检查失败:', error);
    res.status(500).json({ success: false, message: '删除抽样检查失败' });
  }
});

// 获取统计数据
router.get('/stats/overview', async (req, res) => {
  try {
    const [total] = await pool.query('SELECT COUNT(*) as count FROM inspections');
    const [national] = await pool.query("SELECT COUNT(*) as count FROM inspections WHERE level = 'national'");
    const [provincial] = await pool.query("SELECT COUNT(*) as count FROM inspections WHERE level = 'provincial'");
    const [municipal] = await pool.query("SELECT COUNT(*) as count FROM inspections WHERE level = 'municipal'");

    res.json({
      success: true,
      data: {
        total: total[0].count,
        national: national[0].count,
        provincial: provincial[0].count,
        municipal: municipal[0].count
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

module.exports = router;
