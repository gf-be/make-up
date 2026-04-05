const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// 获取仪表板统计数据
router.get('/stats', async (req, res) => {
  try {
    // 政策统计
    const [policyStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN level = 'national' THEN 1 ELSE 0 END) as national,
        SUM(CASE WHEN level = 'provincial' THEN 1 ELSE 0 END) as provincial,
        SUM(CASE WHEN level = 'municipal' THEN 1 ELSE 0 END) as municipal,
        SUM(view_count) as total_views
      FROM policies
    `);

    // 标准统计
    const [standardStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN type = 'national' THEN 1 ELSE 0 END) as national,
        SUM(CASE WHEN type = 'industry' THEN 1 ELSE 0 END) as industry,
        SUM(CASE WHEN type = 'local' THEN 1 ELSE 0 END) as local,
        SUM(view_count) as total_views
      FROM standards
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

    // 公告统计
    const [announcementStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_top = 1 THEN 1 ELSE 0 END) as top_announcements,
        SUM(view_count) as total_views
      FROM announcements
    `);

    // 最新政策
    const [latestPolicies] = await pool.query(`
      SELECT id, title, level, publish_date, view_count
      FROM policies
      WHERE status = 'published'
      ORDER BY publish_date DESC
      LIMIT 5
    `);

    // 最新标准
    const [latestStandards] = await pool.query(`
      SELECT id, code, title, type, effective_date, view_count
      FROM standards
      WHERE status = 'valid'
      ORDER BY effective_date DESC
      LIMIT 5
    `);

    // 最新检查
    const [latestInspections] = await pool.query(`
      SELECT id, title, level, inspection_date, total_samples, qualified_rate
      FROM inspections
      ORDER BY inspection_date DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        policies: policyStats[0],
        standards: standardStats[0],
        inspections: inspectionStats[0],
        supervisions: supervisionStats[0],
        announcements: announcementStats[0],
        latest: {
          policies: latestPolicies,
          standards: latestStandards,
          inspections: latestInspections
        }
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

    // 政策月度统计
    const [policyTrends] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM policies
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
        AVG(qualified_rate) as avg_rate
      FROM inspections
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `, [months]);

    res.json({
      success: true,
      data: {
        policies: policyTrends,
        inspections: inspectionTrends
      }
    });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ success: false, message: '获取趋势数据失败' });
  }
});

module.exports = router;
