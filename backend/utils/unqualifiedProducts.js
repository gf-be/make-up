const DEFAULT_BATCH_TITLE = '40批次不符合规定化妆品信息';
const DEFAULT_TOTAL_BATCHES = 40;

const UNQUALIFIED_PRODUCT_FIELDS = [
  'batch_title',
  'total_batches',
  'sequence_no',
  'product_name',
  'company_names',
  'company_addresses',
  'sample_unit_name',
  'sample_unit_address',
  'package_spec',
  'batch_no',
  'production_date',
  'expiry_date',
  'product_region',
  'registration_no',
  'production_license_no',
  'inspection_institution',
  'unqualified_items',
  'inspection_result',
  'requirement',
  'remarks'
];

const ANNOUNCEMENT_LINK_FIELDS = [
  'announcement_id',
  'announcement_detail_id',
  'is_counterfeit'
];

function getDefaultUnqualifiedProducts() {
  return [
    {
      batch_title: DEFAULT_BATCH_TITLE,
      total_batches: DEFAULT_TOTAL_BATCHES,
      sequence_no: 1,
      product_name: 'Orginese祛痘净肤水光面膜',
      company_names: '中幸（广州）化妆品股份有限公司',
      company_addresses: '广州市花都区红棉大道北48号7栋101厂房',
      sample_unit_name: '长沙久烁电子商务有限公司，网店商铺名称：京东欧橘ORGINESE旗舰店',
      sample_unit_address: '湖南省长沙市雨花区汇金路877号嘉华智谷产业园Q1、A2、A3栋1606房',
      package_spec: '25ml×10片',
      batch_no: 'ZPC0311',
      production_date: '/',
      expiry_date: '20280302',
      product_region: '广东',
      registration_no: '粤G妆网备字2023468030',
      production_license_no: '粤妆20160344',
      inspection_institution: '浙江省食品药品检验研究院',
      unqualified_items: '菌落总数',
      inspection_result: '14000CFU/g',
      requirement: '≤1000CFU/g',
      remarks: '/'
    },
    {
      batch_title: DEFAULT_BATCH_TITLE,
      total_batches: DEFAULT_TOTAL_BATCHES,
      sequence_no: 2,
      product_name: '舒晨云南三七草本清吙护龈牙膏双重薄荷香型',
      company_names: '佛山市珠光生物科技有限公司',
      company_addresses: '佛山市南海区大沥镇黄岐泌冲村“烟斗岗泌冲路99号D座首层（住所申报）',
      sample_unit_name: '霍山县大沙埂如海超市',
      sample_unit_address: '安徽省六安市霍山县与儿街镇大沙埂村大别山农博城2#1F、2F',
      package_spec: '180g',
      batch_no: '24031001',
      production_date: '/',
      expiry_date: '20270309',
      product_region: '广东',
      registration_no: '粤国牙膏网备字2023404589',
      production_license_no: '粤妆20220035',
      inspection_institution: '安徽省食品药品检验研究院',
      unqualified_items: '菌落总数',
      inspection_result: '7.9×104CFU/g',
      requirement: '≤500CFU/g',
      remarks: '/'
    }
  ];
}

function buildAnnouncementBatchTitle(announcement = {}) {
  const title = String(announcement.title || '').trim();
  const announcementNo = String(announcement.announcement_no || '').trim();
  return [announcementNo, title].filter(Boolean).join(' - ') || title || announcementNo || DEFAULT_BATCH_TITLE;
}

async function ensureColumn(connection, columnName, definition) {
  const [rows] = await connection.query('SHOW COLUMNS FROM unqualified_products LIKE ?', [columnName]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE unqualified_products ADD COLUMN ${columnName} ${definition}`);
  }
}

async function ensureIndex(connection, indexName, definitionSql) {
  const [rows] = await connection.query('SHOW INDEX FROM unqualified_products WHERE Key_name = ?', [indexName]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE unqualified_products ADD ${definitionSql}`);
  }
}

async function ensureUnqualifiedProductsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sequence_no INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      company_names TEXT,
      company_addresses TEXT,
      sample_unit_name VARCHAR(500),
      sample_unit_address TEXT,
      package_spec VARCHAR(255),
      batch_no VARCHAR(255),
      production_date VARCHAR(100),
      expiry_date VARCHAR(255),
      product_region VARCHAR(255),
      registration_no VARCHAR(255),
      production_license_no VARCHAR(255),
      inspection_institution VARCHAR(255),
      unqualified_items LONGTEXT,
      inspection_result LONGTEXT,
      requirement LONGTEXT,
      remarks LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_unqualified_products_product_name (product_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumn(connection, 'batch_title', "VARCHAR(255) NOT NULL DEFAULT '40批次不符合规定化妆品信息' AFTER id");
  await ensureColumn(connection, 'total_batches', 'INT DEFAULT 0 AFTER batch_title');
  await ensureColumn(connection, 'sequence_no', 'INT NOT NULL');
  await ensureColumn(connection, 'product_name', 'VARCHAR(255) NOT NULL');
  await ensureColumn(connection, 'company_names', 'TEXT NULL');
  await ensureColumn(connection, 'company_addresses', 'TEXT NULL');
  await ensureColumn(connection, 'sample_unit_name', 'VARCHAR(500) NULL');
  await ensureColumn(connection, 'sample_unit_address', 'TEXT NULL');
  await ensureColumn(connection, 'package_spec', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'batch_no', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'production_date', 'VARCHAR(100) NULL');
  await ensureColumn(connection, 'expiry_date', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'product_region', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'registration_no', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'production_license_no', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'inspection_institution', 'VARCHAR(255) NULL');
  await ensureColumn(connection, 'unqualified_items', 'LONGTEXT NULL');
  await ensureColumn(connection, 'inspection_result', 'LONGTEXT NULL');
  await ensureColumn(connection, 'requirement', 'LONGTEXT NULL');
  await ensureColumn(connection, 'remarks', 'LONGTEXT NULL');
  await ensureColumn(connection, 'announcement_id', 'INT NULL AFTER remarks');
  await ensureColumn(connection, 'announcement_detail_id', 'INT NULL AFTER announcement_id');
  await ensureColumn(connection, 'is_counterfeit', 'TINYINT(1) DEFAULT 0 AFTER announcement_detail_id');
  await ensureColumn(connection, 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn(connection, 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await ensureIndex(connection, 'idx_unqualified_products_sample_unit_name', 'INDEX idx_unqualified_products_sample_unit_name (sample_unit_name)');
  await ensureIndex(connection, 'idx_unqualified_products_inspection_institution', 'INDEX idx_unqualified_products_inspection_institution (inspection_institution)');
  await ensureIndex(connection, 'idx_unqualified_products_announcement', 'INDEX idx_unqualified_products_announcement (announcement_id)');
  await ensureIndex(connection, 'idx_unqualified_products_counterfeit', 'INDEX idx_unqualified_products_counterfeit (is_counterfeit)');
}

async function seedDefaultUnqualifiedProducts(connection) {
  const rows = getDefaultUnqualifiedProducts();

  for (const row of rows) {
    const [existingRows] = await connection.query(
      `
        SELECT id
        FROM unqualified_products
        WHERE announcement_id IS NULL AND sequence_no = ? AND product_name = ?
        LIMIT 1
      `,
      [row.sequence_no, row.product_name]
    );

    if (existingRows.length > 0) {
      await connection.query(
        `
          UPDATE unqualified_products
          SET batch_title = ?, total_batches = ?, company_names = ?, company_addresses = ?,
              sample_unit_name = ?, sample_unit_address = ?, package_spec = ?, batch_no = ?,
              production_date = ?, expiry_date = ?, product_region = ?, registration_no = ?,
              production_license_no = ?, inspection_institution = ?, unqualified_items = ?,
              inspection_result = ?, requirement = ?, remarks = ?, is_counterfeit = 0,
              announcement_id = NULL, announcement_detail_id = NULL
          WHERE id = ?
        `,
        [
          row.batch_title,
          row.total_batches,
          row.company_names,
          row.company_addresses,
          row.sample_unit_name,
          row.sample_unit_address,
          row.package_spec,
          row.batch_no,
          row.production_date,
          row.expiry_date,
          row.product_region,
          row.registration_no,
          row.production_license_no,
          row.inspection_institution,
          row.unqualified_items,
          row.inspection_result,
          row.requirement,
          row.remarks,
          existingRows[0].id
        ]
      );
      continue;
    }

    const placeholders = [...UNQUALIFIED_PRODUCT_FIELDS, ...ANNOUNCEMENT_LINK_FIELDS].map(() => '?').join(', ');
    await connection.query(
      `
        INSERT INTO unqualified_products (${[...UNQUALIFIED_PRODUCT_FIELDS, ...ANNOUNCEMENT_LINK_FIELDS].join(', ')})
        VALUES (${placeholders})
      `,
      [...UNQUALIFIED_PRODUCT_FIELDS.map((field) => row[field] ?? null), null, null, 0]
    );
  }

  return rows.length;
}

async function replaceUnqualifiedProductsFromAnnouncementDetails(connection, announcementId) {
  await ensureUnqualifiedProductsTable(connection);

  const [announcementRows] = await connection.query(
    'SELECT id, title, announcement_no FROM announcements WHERE id = ? LIMIT 1',
    [announcementId]
  );
  const announcement = announcementRows[0];

  await connection.query('DELETE FROM unqualified_products WHERE announcement_id = ?', [announcementId]);

  if (!announcement) {
    return {
      synced_count: 0,
      batch_title: DEFAULT_BATCH_TITLE,
      total_batches: 0
    };
  }

  const [detailRows] = await connection.query(
    `
      SELECT id, sequence_no, product_name, company_names, company_addresses, sample_unit_name,
             sample_unit_address, package_spec, batch_no, production_date, expiry_date,
             product_region, registration_no, production_license_no, inspection_institution,
             unqualified_items, inspection_result, requirement, remarks, is_counterfeit
      FROM announcement_product_details
      WHERE announcement_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [announcementId]
  );

  if (detailRows.length === 0) {
    return {
      synced_count: 0,
      batch_title: buildAnnouncementBatchTitle(announcement),
      total_batches: 0
    };
  }

  const batchTitle = buildAnnouncementBatchTitle(announcement);
  const totalBatches = detailRows.length;
  const insertFields = [...UNQUALIFIED_PRODUCT_FIELDS, ...ANNOUNCEMENT_LINK_FIELDS];
  const placeholders = insertFields.map(() => '?').join(', ');

  for (const row of detailRows) {
    const payload = {
      batch_title: batchTitle,
      total_batches: totalBatches,
      sequence_no: row.sequence_no,
      product_name: row.product_name,
      company_names: row.company_names,
      company_addresses: row.company_addresses,
      sample_unit_name: row.sample_unit_name,
      sample_unit_address: row.sample_unit_address,
      package_spec: row.package_spec,
      batch_no: row.batch_no,
      production_date: row.production_date,
      expiry_date: row.expiry_date,
      product_region: row.product_region,
      registration_no: row.registration_no,
      production_license_no: row.production_license_no,
      inspection_institution: row.inspection_institution,
      unqualified_items: row.unqualified_items,
      inspection_result: row.inspection_result,
      requirement: row.requirement,
      remarks: row.remarks,
      announcement_id: Number(announcementId),
      announcement_detail_id: row.id,
      is_counterfeit: row.is_counterfeit ? 1 : 0
    };

    await connection.query(
      `
        INSERT INTO unqualified_products (${insertFields.join(', ')})
        VALUES (${placeholders})
      `,
      insertFields.map((field) => payload[field] ?? null)
    );
  }

  return {
    synced_count: detailRows.length,
    batch_title: batchTitle,
    total_batches: totalBatches
  };
}

module.exports = {
  DEFAULT_BATCH_TITLE,
  DEFAULT_TOTAL_BATCHES,
  UNQUALIFIED_PRODUCT_FIELDS,
  getDefaultUnqualifiedProducts,
  ensureUnqualifiedProductsTable,
  seedDefaultUnqualifiedProducts,
  replaceUnqualifiedProductsFromAnnouncementDetails
};

