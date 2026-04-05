const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取企业列表（支持筛选和搜索）
router.get('/', async (req, res) => {
  try {
    const { name, brand, province, has_unqualified, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT * FROM companies
      WHERE 1=1
    `;
    const params = [];

    if (name) {
      query += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (brand) {
      query += ' AND brand LIKE ?';
      params.push(`%${brand}%`);
    }
    if (province) {
      query += ' AND province = ?';
      params.push(province);
    }

    // 如果筛选有不合格记录的企业
    if (has_unqualified === 'true') {
      query += ` AND id IN (SELECT DISTINCT company_id FROM inspection_details WHERE inspection_result = 'unqualified')`;
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.query(query, params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM companies WHERE 1=1';
    const countParams = [];
    if (name) {
      countQuery += ' AND name LIKE ?';
      countParams.push(`%${name}%`);
    }
    if (brand) {
      countQuery += ' AND brand LIKE ?';
      countParams.push(`%${brand}%`);
    }
    if (province) {
      countQuery += ' AND province = ?';
      countParams.push(province);
    }
    if (has_unqualified === 'true') {
      countQuery += ` AND id IN (SELECT DISTINCT company_id FROM inspection_details WHERE inspection_result = 'unqualified')`;
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
    console.error('获取企业列表失败:', error);
    res.status(500).json({ success: false, message: '获取企业列表失败' });
  }
});

// 获取企业统计信息
router.get('/stats/overview', async (req, res) => {
  try {
    const [totalCompanies] = await pool.query('SELECT COUNT(*) as count FROM companies');
    const [totalInspections] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as count
      FROM inspection_details
      WHERE company_id IS NOT NULL
    `);
    const [unqualifiedCompanies] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as count
      FROM inspection_details
      WHERE inspection_result = 'unqualified' AND company_id IS NOT NULL
    `);

    // 获取不合格次数最多的企业（前10）
    const [topUnqualified] = await pool.query(`
      SELECT c.id, c.name, c.brand, COUNT(*) as unqualified_count
      FROM companies c
      JOIN inspection_details id ON c.id = id.company_id
      WHERE id.inspection_result = 'unqualified'
      GROUP BY c.id, c.name, c.brand
      ORDER BY unqualified_count DESC
      LIMIT 10
    `);

    // 按省份统计
    const [provinceStats] = await pool.query(`
      SELECT province, COUNT(*) as count
      FROM companies
      WHERE province IS NOT NULL AND province != ''
      GROUP BY province
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        total_companies: totalCompanies[0].count,
        inspected_companies: totalInspections[0].count,
        unqualified_companies: unqualifiedCompanies[0].count,
        top_unqualified: topUnqualified,
        province_stats: provinceStats
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
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(`
      SELECT
        c.id, c.name, c.brand, c.province,
        COUNT(*) as unqualified_count,
        GROUP_CONCAT(DISTINCT id.product_name) as unqualified_products,
        MAX(id.created_at) as last_unqualified_date
      FROM companies c
      JOIN inspection_details id ON c.id = id.company_id
      WHERE id.inspection_result = 'unqualified'
      GROUP BY c.id, c.name, c.brand, c.province
      ORDER BY unqualified_count DESC, last_unqualified_date DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    // 获取总数
    const [countResult] = await pool.query(`
      SELECT COUNT(DISTINCT company_id) as total
      FROM inspection_details
      WHERE inspection_result = 'unqualified' AND company_id IS NOT NULL
    `);

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
    console.error('获取不合格企业列表失败:', error);
    res.status(500).json({ success: false, message: '获取不合格企业列表失败' });
  }
});

// 获取企业统计信息
router.post('/', async (req, res) => {
  try {
    const { name, brand, type, address, province, city } = req.body;

    const [result] = await pool.query(`
      INSERT INTO companies (name, brand, type, address, province, city)
      VALUES (?, ?, ?, ?, ?, ?)
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
    const { id } = req.params;

    // 删除关联的检查详情（company_id设为NULL）
    await pool.query('UPDATE inspection_details SET company_id = NULL WHERE company_id = ?', [id]);

    // 删除企业
    await pool.query('DELETE FROM companies WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除企业失败:', error);
    res.status(500).json({ success: false, message: '删除企业失败' });
  }
});

module.exports = router;
