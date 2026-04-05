const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取仪表板统计数据
router.get('/stats', async (req, res) => {
  try {
    // 公告统计
    const [announcementStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(inspection_count) as total_inspection_batches,
        SUM(view_count) as total_views
      FROM announcements
    `);

    // 抽样检查统计
    const [inspectionStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(total_samples) as total_samples,
        SUM(qualified_count) as total_qualified,
        SUM(unqualified_count) as total_unqualified,
        AVG(qualified_rate) as avg_qualified_rate,
        SUM(view_count) as total_views
      FROM inspections
    `);

    // 企业统计
    const [companyStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN type = 'manufacturer' THEN 1 ELSE 0 END) as manufacturers,
        SUM(CASE WHEN type = 'distributor' THEN 1 ELSE 0 END) as distributors,
        SUM(CASE WHEN type = 'seller' THEN 1 ELSE 0 END) as sellers
      FROM companies
    `);

    // 督查统计
    const [supervisionStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending_rectification' THEN 1 ELSE 0 END) as pending,
        SUM(view_count) as total_views
      FROM supervisions
    `);

    // 不合格产品统计
    const [unqualifiedStats] = await pool.query(`
      SELECT
        COUNT(*) as total_unqualified,
        COUNT(DISTINCT company_id) as affected_companies
      FROM inspection_details
      WHERE inspection_result = 'unqualified'
    `);

    // 最新公告
    const [latestAnnouncements] = await pool.query(`
      SELECT id, title, announcement_no, publish_date, inspection_count, view_count
      FROM announcements
      WHERE status = 'published'
      ORDER BY publish_date DESC
      LIMIT 5
    `);

    // 最新检查
    const [latestInspections] = await pool.query(`
      SELECT i.id, i.title, i.level, i.inspection_date, i.total_samples, i.qualified_rate, a.title as announcement_title
      FROM inspections i
      LEFT JOIN announcements a ON i.announcement_id = a.id
      ORDER BY i.inspection_date DESC
      LIMIT 5
    `);

    // 最新督查
    const [latestSupervisions] = await pool.query(`
      SELECT id, title, supervision_date, supervision_unit, status, view_count
      FROM supervisions
      ORDER BY supervision_date DESC
      LIMIT 5
    `);

    // 高频问题企业
    const [problemCompanies] = await pool.query(`
      SELECT
        c.id, c.name, c.brand, c.province,
        COUNT(DISTINCT id.id) as inspection_count,
        SUM(CASE WHEN id.inspection_result = 'unqualified' THEN 1 ELSE 0 END) as unqualified_count
      FROM companies c
      JOIN inspection_details id ON c.id = id.company_id
      WHERE id.inspection_result = 'unqualified'
      GROUP BY c.id, c.name, c.brand, c.province
      HAVING unqualified_count > 0
      ORDER BY unqualified_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        announcements: announcementStats[0],
        inspections: inspectionStats[0],
        companies: companyStats[0],
        supervisions: supervisionStats[0],
        unqualified: unqualifiedStats[0],
        latest: {
          announcements: latestAnnouncements,
          inspections: latestInspections,
          supervisions: latestSupervisions
        },
        problemCompanies
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

// 获取月度数据趋势
router.get('/trends', async (req, res) => {
  try {
    const months = 6;

    // 公告月度统计
    const [announcementTrends] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(inspection_count) as total_batches
      FROM announcements
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `, [months]);

    // 抽样检查月度统计
    const [inspectionTrends] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count,
        SUM(total_samples) as samples,
        SUM(unqualified_count) as unqualified,
        AVG(qualified_rate) as avg_rate
      FROM inspections
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `, [months]);

    // 企业新增统计
    const [companyTrends] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM companies
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `, [months]);

    res.json({
      success: true,
      data: {
        announcements: announcementTrends,
        inspections: inspectionTrends,
        companies: companyTrends
      }
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ success: false, message: '获取趋势数据失败' });
  }
});

module.exports = router;
