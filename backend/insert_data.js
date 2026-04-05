// 插入抽样检查数据的脚本
const mysql = require('mysql2/promise');
require('dotenv').config({ path: __dirname + '/.env' });

// 使用环境变量配置
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'qwaszx12',
  database: process.env.DB_NAME || 'cosmetics_info',
  charset: 'utf8mb4'
};

async function insertInspectionData() {
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

    await connection.beginTransaction();

    // 1. 插入主检查记录
    const [inspectionResult] = await connection.query(`
      INSERT INTO inspections (
        title, batch_number, inspection_date, inspection_unit, region,
        level, total_samples, qualified_count, unqualified_count,
        qualified_rate, summary, status, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      '国家药监局关于50批次不符合规定化妆品的通告（2026年第6号）',
      '2026年第6号',
      '2025-12-01',
      '贵州省食品药品检验所等单位',
      '全国',
      'national',
      50,
      0,
      50,
      0.00,
      `在2025年国家化妆品抽样检验工作中，经贵州省食品药品检验所等单位检验，产品标签标示名称为俏因子草本清肌泥膜粉等50批次化妆品不符合规定。

根据《化妆品监督管理条例》《化妆品生产经营监督管理办法》《化妆品抽样检验管理办法》，国家药品监督管理局已要求浙江、广东、青海省药品监督管理部门对上述不符合规定化妆品涉及的注册人、备案人、受托生产企业等依法立案调查，责令相关企业依法采取风险控制措施并开展自查整改。各省级药品监督管理部门要依法责令相关化妆品经营者停止经营上述化妆品，并依法调查其进货查验记录等情况，对违法产品进行追根溯源，发现违法行为的，依法严肃查处；涉嫌犯罪的，依法移送公安机关。`,
      'published',
      '国家药品监督管理局'
    ]);

    const inspectionId = inspectionResult.insertId;
    console.log(`检查记录插入成功，ID: ${inspectionId}`);

    // 2. 插入50批次不合格产品详情（示例数据）
    const sampleProducts = [
      { name: '俏因子草本清肌泥膜粉', brand: '俏因子', manufacturer: '浙江××化妆品有限公司', reason: '菌落总数超标' },
      { name: '美肌源水润修护面膜', brand: '美肌源', manufacturer: '广东××化妆品有限公司', reason: '防腐剂超标' },
      { name: '诗诗本草美白祛斑霜', brand: '诗诗本草', manufacturer: '青海××生物科技有限公司', reason: '检出禁用成分' },
      { name: '雅姿焕颜紧致精华液', brand: '雅姿', manufacturer: '浙江××生物科技有限公司', reason: '重金属超标' },
      { name: '韩媛草本洁面乳', brand: '韩媛', manufacturer: '广东××日用品有限公司', reason: '激素检出' },
      { name: '花间语保湿喷雾', brand: '花间语', manufacturer: '浙江××化妆品有限公司', reason: '微生物超标' },
      { name: '御颜堂抗皱眼霜', brand: '御颜堂', manufacturer: '青海××化妆品有限公司', reason: '标签标识不合格' },
      { name: '兰芝悦肤修护乳液', brand: '兰芝悦', manufacturer: '广东××生物科技有限公司', reason: '重金属超标' },
      { name: '本草世家祛痘膏', brand: '本草世家', manufacturer: '浙江××化妆品有限公司', reason: '检出禁用成分' },
      { name: '美之韵美白洁面泡沫', brand: '美之韵', manufacturer: '青海××化妆品有限公司', reason: 'pH值超标' }
    ];

    // 插入10条示例数据（实际50批次类似）
    let detailCount = 0;
    for (const product of sampleProducts) {
      await connection.query(`
        INSERT INTO inspection_details (
          inspection_id, product_name, brand, manufacturer,
          production_date, sample_source, inspection_result,
          unqualified_items, inspection_standard
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        inspectionId,
        product.name,
        product.brand,
        product.manufacturer,
        '2025-08-01',
        '市场抽样',
        'unqualified',
        product.reason,
        '《化妆品安全技术规范》（2015年版）'
      ]);
      detailCount++;
    }

    await connection.commit();
    console.log('数据插入成功！');
    console.log(`- 检查记录ID: ${inspectionId}`);
    console.log(`- 详情记录数: ${detailCount}`);
    console.log('\n你可以在系统的"抽样检查"模块中查看此记录');

  } catch (error) {
    console.error('插入数据失败:', error);
    if (connection) {
      await connection.rollback();
      console.log('事务已回滚');
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行插入
insertInspectionData()
  .then(() => {
    console.log('\n✓ 操作完成！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ 执行失败:', error.message);
    process.exit(1);
  });
