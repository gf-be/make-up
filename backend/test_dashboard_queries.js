const pool = require('./config/database');

async function testDashboard() {
  console.log('开始测试 Dashboard API...\n');

  try {
    console.log('测试数据库连接...');
    const conn = await pool.getConnection();
    console.log('✓ 数据库连接成功\n');
    conn.release();

    console.log('测试查询 announcements 表...');
    const [announcements] = await pool.query('SELECT COUNT(*) as count FROM announcements');
    console.log('✓ announcements 表:', announcements[0].count, '条记录\n');

    console.log('测试查询 inspections 表...');
    const [inspections] = await pool.query('SELECT COUNT(*) as count FROM inspections');
    console.log('✓ inspections 表:', inspections[0].count, '条记录\n');

    console.log('测试查询 companies 表...');
    const [companies] = await pool.query('SELECT COUNT(*) as count FROM companies');
    console.log('✓ companies 表:', companies[0].count, '条记录\n');

    console.log('测试查询 supervisions 表...');
    const [supervisions] = await pool.query('SELECT COUNT(*) as count FROM supervisions');
    console.log('✓ supervisions 表:', supervisions[0].count, '条记录\n');

    console.log('测试查询 inspection_details 表...');
    const [inspectionDetails] = await pool.query('SELECT COUNT(*) as count FROM inspection_details');
    console.log('✓ inspection_details 表:', inspectionDetails[0].count, '条记录\n');

    console.log('测试 dashboard stats 查询...');
    const [stats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(inspection_count) as total_inspection_batches,
        SUM(view_count) as total_views
      FROM announcements
    `);
    console.log('✓ stats 查询成功:', stats[0], '\n');

    console.log('测试 dashboard trends 查询...');
    const [trends] = await pool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM announcements
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month
    `);
    console.log('✓ trends 查询成功:', trends, '\n');

    console.log('✅ 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDashboard();
