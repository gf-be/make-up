// 插入公告数据的脚本
const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

// 使用环境变量配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'cosmetics_info',
  charset: 'utf8mb4'
};

async function insertAnnouncementData() {
  let connection;

  try {
    console.log('连接配置:', {
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database
    });

    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');

    // 插入公告
    const [result] = await connection.query(`
      INSERT INTO announcements (
        title, content, type, publish_date, expiry_date, is_top, status, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      '国家药监局关于50批次不符合规定化妆品的通告（2026年第6号）',
      `<h3>发布时间：2026-02-05</h3>
      <p>在2025年国家化妆品抽样检验工作中，经贵州省食品药品检验所等单位检验，产品标签标示名称为俏因子草本清肌泥膜粉等50批次化妆品不符合规定（见附件）。</p>

      <p>根据《化妆品监督管理条例》《化妆品生产经营监督管理办法》《化妆品抽样检验管理办法》，国家药品监督管理局已要求浙江、广东、青海省药品监督管理部门对上述不符合规定化妆品涉及的注册人、备案人、受托生产企业等依法立案调查，责令相关企业依法采取风险控制措施并开展自查整改。各省级药品监督管理部门要依法责令相关化妆品经营者停止经营上述化妆品，并依法调查其进货查验记录等情况，对违法产品进行追根溯源，发现违法行为的，依法严肃查处；涉嫌犯罪的，依法移送公安机关。</p>

      <p>特此通告。</p>

      <h3>附件：50批次不符合规定化妆品信息</h3>
      <p>相关附件可通过国家药品监督管理局官网查询。</p>

      <p><strong>国家药监局</strong></p>
      <p>2026年2月3日</p>`,
      'urgent',
      '2026-02-05',
      '2027-02-05',
      true,
      'published',
      1  // 假设管理员用户ID为1
    ]);

    console.log('公告插入成功！');
    console.log(`公告ID: ${result.insertId}`);
    console.log('\n你可以在系统查看此公告（如果添加了公告模块）');

  } catch (error) {
    console.error('插入数据失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行插入
insertAnnouncementData()
  .then(() => {
    console.log('\n✓ 操作完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ 执行失败:', error.message);
    process.exit(1);
  });
