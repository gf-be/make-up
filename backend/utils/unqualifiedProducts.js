const DEFAULT_BATCH_TITLE = '40批次不符合规定化妆品信息';
const DEFAULT_TOTAL_BATCHES = 40;
const DEFAULT_PRODUCT_TYPE = 'cosmetics';
const DEFAULT_ANNOUNCEMENT_TYPE = 'sampling';
const {
  extractIssueItems,
  buildDerivedAnalyticsFields
} = require('./dataAnalysisHelpers');
const {
  ensureUnqualifiedProductTreeRollupTable,
  rebuildUnqualifiedProductTreeRollupsForSource,
  backfillUnqualifiedProductTreeRollupsIfNeeded
} = require('./unqualifiedProductTreeRollup');

const PRODUCT_TYPE_LABELS = {
  cosmetics: '化妆品',
  food: '食品',
  medical_device: '医疗器械',
  unknown: '未知'
};

const PRODUCT_TYPE_ALIASES = {
  cosmetics: 'cosmetics',
  '化妆品': 'cosmetics',
  food: 'food',
  '食品': 'food',
  medical_device: 'medical_device',
  'medical-device': 'medical_device',
  medicaldevice: 'medical_device',
  '医疗器械': 'medical_device',
  unknown: 'unknown',
  '未知': 'unknown',
  '未分类': 'unknown',
  '未回复': 'unknown',
  '空值': 'unknown'
};


const ANNOUNCEMENT_TYPE_LABELS = {
  sampling: '抽检通告',
  flight_inspection: '飞行检查'
};

const ANNOUNCEMENT_TYPE_ALIASES = {
  sampling: 'sampling',
  '抽检通告': 'sampling',
  '抽样检查': 'sampling',
  '抽样检查公告': 'sampling',
  flight_inspection: 'flight_inspection',
  'flight-inspection': 'flight_inspection',
  flightinspection: 'flight_inspection',
  '飞行检查': 'flight_inspection',
  '飞检': 'flight_inspection'
};


const UNQUALIFIED_PRODUCT_FIELDS = [
  'batch_title',
  'total_batches',
  'sequence_no',
  'product_name',
  'company_names',
  'company_addresses',
  'manufacturer_name',
  'manufacturer_address',
  'operator_name',
  'operator_address',
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
  'remarks',
  'product_category',
  'manufacturer_province',
  'manufacturer_city',
  'sampled_province',
  'sampled_city',
  'issue_category',
  'product_type',
  'announcement_type',
  'source_key',
  'source_no',
  'source_title',
  'source_publish_date',
  'source_year',
  'province_display',
  'company_id'
];

const SOURCE_LINK_FIELDS = [
  'announcement_id',
  'announcement_detail_id',
  'supervision_id',
  'supervision_detail_id',
  'is_counterfeit'
];

function normalizeOptionValue(value, aliases, defaultValue) {
  const rawValue = String(value || '').trim();
  if (!rawValue) {
    return defaultValue;
  }

  const normalizedKey = rawValue.toLowerCase().replace(/[\s-]+/g, '_');
  return aliases[normalizedKey] || aliases[rawValue] || rawValue;
}

function buildTypeOptions(values = [], getLabel) {
  const normalizedValues = Array.from(
    new Set(
      values
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );

  return normalizedValues.map((value) => ({
    value,
    label: getLabel(value)
  }));
}

function normalizeProductType(value) {
  return normalizeOptionValue(value, PRODUCT_TYPE_ALIASES, DEFAULT_PRODUCT_TYPE);
}

function normalizeAnnouncementType(value) {
  return normalizeOptionValue(value, ANNOUNCEMENT_TYPE_ALIASES, DEFAULT_ANNOUNCEMENT_TYPE);
}

function getProductTypeLabel(value) {
  const normalized = normalizeProductType(value);
  return PRODUCT_TYPE_LABELS[normalized] || normalized || PRODUCT_TYPE_LABELS[DEFAULT_PRODUCT_TYPE];
}

function getAnnouncementTypeLabel(value) {
  const normalized = normalizeAnnouncementType(value);
  return ANNOUNCEMENT_TYPE_LABELS[normalized] || normalized || ANNOUNCEMENT_TYPE_LABELS[DEFAULT_ANNOUNCEMENT_TYPE];
}

function getProductTypeOptions(extraValues = []) {
  return buildTypeOptions([
    ...Object.keys(PRODUCT_TYPE_LABELS),
    ...extraValues.map((item) => normalizeProductType(item))
  ], getProductTypeLabel);
}

function getAnnouncementTypeOptions(extraValues = []) {
  return buildTypeOptions([
    ...Object.keys(ANNOUNCEMENT_TYPE_LABELS),
    ...extraValues.map((item) => normalizeAnnouncementType(item))
  ], getAnnouncementTypeLabel);
}


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
      remarks: '/',
      product_type: DEFAULT_PRODUCT_TYPE,
      announcement_type: DEFAULT_ANNOUNCEMENT_TYPE
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
      remarks: '/',
      product_type: DEFAULT_PRODUCT_TYPE,
      announcement_type: DEFAULT_ANNOUNCEMENT_TYPE
    }
  ];
}

function buildSourceBatchTitle(source = {}, options = {}) {
  const title = String(source.title || '').trim();
  const announcementNo = String(source.announcement_no || '').trim();
  const productTypeLabel = getProductTypeLabel(options.productType);
  const announcementTypeLabel = getAnnouncementTypeLabel(options.announcementType);
  const prefix = `[${productTypeLabel}·${announcementTypeLabel}]`;
  return [prefix, announcementNo, title].filter(Boolean).join(' ') || DEFAULT_BATCH_TITLE;
}

function normalizeRequiredTextField(value) {
  return value === undefined || value === null ? '' : String(value);
}

function enrichPayload(payload = {}) {
  const productType = normalizeProductType(payload.product_type);
  const announcementType = normalizeAnnouncementType(payload.announcement_type);
  const derivedAnalyticsFields = buildDerivedAnalyticsFields(payload);
  const normalizedPayload = {
    ...payload,
    company_names: normalizeRequiredTextField(payload.company_names),
    company_addresses: normalizeRequiredTextField(payload.company_addresses),
    manufacturer_name: normalizeRequiredTextField(payload.manufacturer_name || payload.company_names),
    manufacturer_address: normalizeRequiredTextField(payload.manufacturer_address || payload.company_addresses),
    operator_name: normalizeRequiredTextField(payload.operator_name || payload.sample_unit_name),
    operator_address: normalizeRequiredTextField(payload.operator_address || payload.sample_unit_address),
    sample_unit_name: normalizeRequiredTextField(payload.sample_unit_name),
    sample_unit_address: normalizeRequiredTextField(payload.sample_unit_address),
    unqualified_items: normalizeRequiredTextField(payload.unqualified_items),
    inspection_result: normalizeRequiredTextField(payload.inspection_result),
    requirement: normalizeRequiredTextField(payload.requirement)
  };

  return {
    ...normalizedPayload,
    product_type: productType,
    announcement_type: announcementType,
    ...derivedAnalyticsFields,
    ...buildSearchHotFields({
      ...normalizedPayload,
      product_type: productType,
      announcement_type: announcementType,
      ...derivedAnalyticsFields
    })
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const text = String(value).trim();
  return text || null;
}

function resolveSourceYear(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.getFullYear();
  }

  const matched = String(value).match(/\b(20\d{2})\b/);
  return matched ? Number(matched[1]) : null;
}

function buildProvinceDisplayValue(payload = {}) {
  return String(
    payload.manufacturer_province
    || payload.manufacturer_city
    || payload.sampled_province
    || payload.sampled_city
    || payload.product_region
    || ''
  ).trim() || null;
}

function buildSearchHotFields(payload = {}) {
  const sourceType = payload.announcement_id ? 'announcement' : (payload.supervision_id ? 'supervision' : '');
  const sourceId = payload.announcement_id || payload.supervision_id || null;
  const sourceKey = sourceType && sourceId ? `${sourceType}:${sourceId}` : null;
  const sourceNo = String(payload.source_no || '').trim()
    || (payload.announcement_id ? `公告#${payload.announcement_id}` : '')
    || (payload.supervision_id ? `飞检通告#${payload.supervision_id}` : '')
    || null;
  const sourceTitle = String(payload.source_title || payload.batch_title || '').trim() || null;
  const sourcePublishDate = normalizeDateValue(payload.source_publish_date);

  return {
    source_key: sourceKey,
    source_no: sourceNo,
    source_title: sourceTitle,
    source_publish_date: sourcePublishDate,
    source_year: resolveSourceYear(sourcePublishDate),
    province_display: buildProvinceDisplayValue(payload),
    company_id: payload.company_id ? Number(payload.company_id) : null
  };
}



async function ensureTableColumn(connection, tableName, columnName, definition) {
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${tableName} LIKE ?`, [columnName]);
  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') {
        throw error;
      }
    }
  }
}


async function ensureColumn(connection, columnName, definition) {
  await ensureTableColumn(connection, 'unqualified_products', columnName, definition);
}

async function ensureIndex(connection, tableName, indexName, definitionSql) {
  const [rows] = await connection.query(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD ${definitionSql}`);
  }
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function ensureForeignKey(connection, tableName, constraintName, definitionSql) {
  const [rows] = await connection.query(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      LIMIT 1
    `,
    [tableName, constraintName]
  );

  if (rows.length === 0) {
    try {
      await connection.query(`ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definitionSql}`);
    } catch (error) {
      if (error?.code === 'ER_FK_DUP_NAME' || error?.errno === 1826) {
        return;
      }
      throw error;
    }
  }
}

async function execQueryRetryDeadlock(connection, sql, params = [], attempts = 5) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await connection.query(sql, params);
      return;
    } catch (error) {
      if (error?.code === 'ER_LOCK_DEADLOCK' && i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 + i * 40));
        continue;
      }
      throw error;
    }
  }
}

async function ensureUnqualifiedProductIssueItemsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_issue_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unqualified_product_id INT NOT NULL,
      announcement_id INT NULL,
      announcement_detail_id INT NULL,
      issue_item VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_unqualified_product_issue_item (unqualified_product_id, issue_item),
      INDEX idx_upii_issue_item (issue_item),
      INDEX idx_upii_product (unqualified_product_id),
      INDEX idx_upii_announcement (announcement_id),
      INDEX idx_upii_announcement_detail (announcement_detail_id),
      CONSTRAINT fk_upii_unqualified_product
        FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureIndex(connection, 'unqualified_product_issue_items', 'idx_upii_issue_item_announcement', 'INDEX idx_upii_issue_item_announcement (issue_item, announcement_id)');
}

async function ensureUnqualifiedProductCopyRecordsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_copy_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      username VARCHAR(191) NOT NULL DEFAULT '',
      display_name VARCHAR(255) NULL,
      copy_text LONGTEXT NOT NULL,
      product_ids JSON NOT NULL,
      dimension_label VARCHAR(512) NULL,
      range_label VARCHAR(512) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_upcr_user_id (user_id),
      INDEX idx_upcr_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (await tableExists(connection, 'users')) {
    await ensureForeignKey(
      connection,
      'unqualified_product_copy_records',
      'fk_upcr_user',
      'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL'
    );
  }
}

function normalizeCategoryValue(value) {
  const normalized = String(value || '').trim();
  return normalized || '其他';
}

async function ensureUnqualifiedProductCategoryItemsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_category_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unqualified_product_id INT NOT NULL,
      announcement_id INT NULL,
      announcement_detail_id INT NULL,
      product_category VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_unqualified_product_category_item (unqualified_product_id, product_category),
      INDEX idx_upci_product_category (product_category),
      INDEX idx_upci_product (unqualified_product_id),
      INDEX idx_upci_announcement (announcement_id),
      INDEX idx_upci_announcement_detail (announcement_detail_id),
      CONSTRAINT fk_upci_unqualified_product
        FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureIndex(connection, 'unqualified_product_category_items', 'idx_upci_category_announcement', 'INDEX idx_upci_category_announcement (product_category, announcement_id)');
}

/** 数据管理员维护：按产品类型管理可选「产品分类」词条（并从明细拆分表 / 主表回填初始数据） */
async function ensureUnqualifiedProductCategoryCatalogTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_category_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      category_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_upccc_type_category (product_type, category_name),
      INDEX idx_upccc_product_type (product_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await execQueryRetryDeadlock(
    connection,
    `
    INSERT IGNORE INTO unqualified_product_category_catalog (product_type, category_name)
    SELECT DISTINCT up.product_type, TRIM(upci.product_category)
    FROM unqualified_product_category_items upci
    INNER JOIN unqualified_products up ON up.id = upci.unqualified_product_id
    WHERE TRIM(upci.product_category) <> ''
  `
  );

  await execQueryRetryDeadlock(
    connection,
    `
    INSERT IGNORE INTO unqualified_product_category_catalog (product_type, category_name)
    SELECT DISTINCT up.product_type, TRIM(up.product_category)
    FROM unqualified_products up
    WHERE up.product_category IS NOT NULL AND TRIM(up.product_category) <> ''
  `
  );
}

/** 分类管理页：自定义产品类型（键值存入明细 product_type 时应与此一致） */
async function ensureUnqualifiedProductTypeCatalogTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_type_catalog (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_type VARCHAR(50) NOT NULL,
      display_label VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_uptc_product_type (product_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function buildSourceCondition(filter = {}, params = []) {
  if (filter.announcementId !== undefined && filter.announcementId !== null) {
    params.push(Number(filter.announcementId));
    return 'announcement_id = ?';
  }

  if (filter.supervisionId !== undefined && filter.supervisionId !== null) {
    params.push(Number(filter.supervisionId));
    return 'supervision_id = ?';
  }

  params.push(0);
  return '1 = ?';
}

async function syncProductCategoryItemsForSource(connection, filter = {}) {
  await ensureUnqualifiedProductCategoryItemsTable(connection);

  const sourceParams = [];
  const sourceCondition = buildSourceCondition(filter, sourceParams);
  const [rows] = await connection.query(
    `
      SELECT id, announcement_id, announcement_detail_id, product_category
      FROM unqualified_products
      WHERE ${sourceCondition}
    `,
    sourceParams
  );

  const productIds = rows.map((row) => Number(row.id)).filter(Boolean);
  if (productIds.length > 0) {
    const deletePlaceholders = productIds.map(() => '?').join(', ');
    await connection.query(
      `DELETE FROM unqualified_product_category_items WHERE unqualified_product_id IN (${deletePlaceholders})`,
      productIds
    );
  }

  const insertValues = rows.map((row) => [
    row.id,
    row.announcement_id,
    row.announcement_detail_id,
    normalizeCategoryValue(row.product_category)
  ]);

  if (insertValues.length === 0) {
    return { synced_product_category_count: 0 };
  }

  const sql = `
    INSERT INTO unqualified_product_category_items (
      unqualified_product_id,
      announcement_id,
      announcement_detail_id,
      product_category
    ) VALUES ${insertValues.map(() => '(?, ?, ?, ?)').join(', ')}
  `;
  await connection.query(sql, insertValues.flat());

  return { synced_product_category_count: insertValues.length };
}

async function backfillDerivedFields(connection) {
  const [rows] = await connection.query(`
    SELECT id, product_name, company_addresses, manufacturer_address, product_region,
           sample_unit_address, operator_address, unqualified_items, inspection_result, requirement
    FROM unqualified_products
    WHERE product_category IS NULL
       OR manufacturer_province IS NULL
       OR manufacturer_city IS NULL
       OR sampled_province IS NULL
       OR sampled_city IS NULL
       OR issue_category IS NULL
    LIMIT 5000
  `);

  for (const row of rows) {
    const derived = buildDerivedAnalyticsFields(row);
    await connection.query(
      `
        UPDATE unqualified_products
        SET product_category = ?, manufacturer_province = ?, manufacturer_city = ?,
            sampled_province = ?, sampled_city = ?, issue_category = ?
        WHERE id = ?
      `,
      [
        derived.product_category,
        derived.manufacturer_province,
        derived.manufacturer_city,
        derived.sampled_province,
        derived.sampled_city,
        derived.issue_category,
        row.id
      ]
    );
  }
}

async function backfillSearchHotFields(connection) {
  const hasSamplingRecords = await tableExists(connection, 'company_sampling_records');
  const hasSupervisionRecords = await tableExists(connection, 'company_supervision_records');
  const joinSql = [
    'LEFT JOIN announcements a ON up.announcement_id = a.id',
    'LEFT JOIN supervisions s ON up.supervision_id = s.id'
  ];
  const companyParts = ['up.company_id'];

  if (hasSamplingRecords) {
    joinSql.push(`
      LEFT JOIN (
        SELECT
          announcement_id,
          announcement_detail_id,
          MIN(company_id) AS company_id
        FROM company_sampling_records
        GROUP BY announcement_id, announcement_detail_id
      ) csr ON csr.announcement_id = up.announcement_id
        AND csr.announcement_detail_id = up.announcement_detail_id
    `);
    companyParts.unshift('csr.company_id');
  }

  if (hasSupervisionRecords) {
    joinSql.push(`
      LEFT JOIN (
        SELECT
          supervision_id,
          COALESCE(supervision_detail_id, 0) AS supervision_detail_key,
          MIN(company_id) AS company_id
        FROM company_supervision_records
        GROUP BY supervision_id, COALESCE(supervision_detail_id, 0)
      ) csr2 ON csr2.supervision_id = up.supervision_id
        AND csr2.supervision_detail_key = COALESCE(up.supervision_detail_id, 0)
    `);
    companyParts.unshift('csr2.company_id');
  }

  await connection.query(`
    UPDATE unqualified_products up
    ${joinSql.join('\n')}
    SET
      up.source_key = CASE
        WHEN up.announcement_id IS NOT NULL THEN CONCAT('announcement:', up.announcement_id)
        WHEN up.supervision_id IS NOT NULL THEN CONCAT('supervision:', up.supervision_id)
        ELSE NULL
      END,
      up.source_no = COALESCE(
        NULLIF(TRIM(a.announcement_no), ''),
        CASE
          WHEN up.supervision_id IS NOT NULL THEN CONCAT('飞检通告#', up.supervision_id)
          WHEN up.announcement_id IS NOT NULL THEN CONCAT('公告#', up.announcement_id)
          ELSE NULL
        END
      ),
      up.source_title = COALESCE(
        NULLIF(TRIM(a.title), ''),
        NULLIF(TRIM(s.title), ''),
        NULLIF(TRIM(up.batch_title), '')
      ),
      up.source_publish_date = COALESCE(a.publish_date, s.publish_date, s.supervision_date),
      up.source_year = CASE
        WHEN COALESCE(a.publish_date, s.publish_date, s.supervision_date) IS NOT NULL
          THEN YEAR(COALESCE(a.publish_date, s.publish_date, s.supervision_date))
        ELSE NULL
      END,
      up.province_display = COALESCE(
        NULLIF(TRIM(up.manufacturer_province), ''),
        NULLIF(TRIM(up.sampled_province), ''),
        NULLIF(TRIM(up.product_region), '')
      ),
      up.company_id = COALESCE(${companyParts.join(', ')})
    WHERE (
      up.source_key IS NULL
      OR up.source_no IS NULL
      OR up.source_title IS NULL
      OR up.source_publish_date IS NULL
      OR up.source_year IS NULL
      OR up.province_display IS NULL
      OR COALESCE(up.province_display, '') <> COALESCE(
        NULLIF(TRIM(up.manufacturer_province), ''),
        NULLIF(TRIM(up.sampled_province), ''),
        NULLIF(TRIM(up.product_region), ''),
        ''
      )
      OR up.company_id IS NULL
    )
      AND (up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)
  `);
}

async function syncIssueItemsForSource(connection, filter = {}) {
  await ensureUnqualifiedProductIssueItemsTable(connection);

  const sourceParams = [];
  const sourceCondition = buildSourceCondition(filter, sourceParams);
  const [rows] = await connection.query(
    `
      SELECT id, announcement_id, announcement_detail_id, unqualified_items
      FROM unqualified_products
      WHERE ${sourceCondition}
    `,
    sourceParams
  );

  const productIds = rows.map((row) => Number(row.id)).filter(Boolean);
  if (productIds.length > 0) {
    const deletePlaceholders = productIds.map(() => '?').join(', ');
    await connection.query(
      `DELETE FROM unqualified_product_issue_items WHERE unqualified_product_id IN (${deletePlaceholders})`,
      productIds
    );
  }

  const insertValues = [];
  rows.forEach((row) => {
    extractIssueItems(row.unqualified_items).forEach((issueItem) => {
      insertValues.push([row.id, row.announcement_id, row.announcement_detail_id, issueItem]);
    });
  });

  if (insertValues.length === 0) {
    return { synced_issue_item_count: 0 };
  }

  const sql = `
    INSERT INTO unqualified_product_issue_items (
      unqualified_product_id,
      announcement_id,
      announcement_detail_id,
      issue_item
    ) VALUES ${insertValues.map(() => '(?, ?, ?, ?)').join(', ')}
  `;
  await connection.query(sql, insertValues.flat());

  return { synced_issue_item_count: insertValues.length };
}

async function backfillIssueItemsIfNeeded(connection) {
  await ensureUnqualifiedProductIssueItemsTable(connection);

  const [issueCountRows] = await connection.query('SELECT COUNT(*) AS total FROM unqualified_product_issue_items');
  const issueTotal = Number(issueCountRows[0]?.total || 0);
  if (issueTotal > 0) {
    return;
  }

  const [productRows] = await connection.query(`
    SELECT id, announcement_id, announcement_detail_id, unqualified_items
    FROM unqualified_products
    WHERE announcement_id IS NOT NULL
  `);

  const insertValues = [];
  productRows.forEach((row) => {
    extractIssueItems(row.unqualified_items).forEach((issueItem) => {
      insertValues.push([row.id, row.announcement_id, row.announcement_detail_id, issueItem]);
    });
  });

  if (insertValues.length === 0) {
    return;
  }

  const sql = `
    INSERT INTO unqualified_product_issue_items (
      unqualified_product_id,
      announcement_id,
      announcement_detail_id,
      issue_item
    ) VALUES ${insertValues.map(() => '(?, ?, ?, ?)').join(', ')}
  `;
  await connection.query(sql, insertValues.flat());
}

async function backfillProductCategoryItemsIfNeeded(connection) {
  await ensureUnqualifiedProductCategoryItemsTable(connection);

  const [categoryCountRows] = await connection.query('SELECT COUNT(*) AS total FROM unqualified_product_category_items');
  const categoryTotal = Number(categoryCountRows[0]?.total || 0);
  if (categoryTotal > 0) {
    return;
  }

  const [productRows] = await connection.query(`
    SELECT id, announcement_id, announcement_detail_id, product_category
    FROM unqualified_products
    WHERE announcement_id IS NOT NULL
  `);

  const insertValues = productRows.map((row) => [
    row.id,
    row.announcement_id,
    row.announcement_detail_id,
    normalizeCategoryValue(row.product_category)
  ]);

  if (insertValues.length === 0) {
    return;
  }

  const sql = `
    INSERT INTO unqualified_product_category_items (
      unqualified_product_id,
      announcement_id,
      announcement_detail_id,
      product_category
    ) VALUES ${insertValues.map(() => '(?, ?, ?, ?)').join(', ')}
  `;
  await connection.query(sql, insertValues.flat());
}

async function getUnqualifiedProductCategoryOptions(connection, limit = 200) {
  await ensureUnqualifiedProductCategoryItemsTable(connection);

  const [rows] = await connection.query(
    `
      SELECT product_category, COUNT(*) AS count
      FROM unqualified_product_category_items
      GROUP BY product_category
      ORDER BY count DESC, product_category ASC
      LIMIT ?
    `,
    [Number(limit)]
  );

  return rows.map((row) => ({
    value: row.product_category,
    label: row.product_category,
    count: Number(row.count || 0)
  }));
}

async function getUnqualifiedProductIssueOptions(connection, limit = 200) {
  await ensureUnqualifiedProductIssueItemsTable(connection);

  const [rows] = await connection.query(
    `
      SELECT issue_item, COUNT(*) AS count
      FROM unqualified_product_issue_items
      GROUP BY issue_item
      ORDER BY count DESC, issue_item ASC
      LIMIT ?
    `,
    [Number(limit)]
  );

  return rows.map((row) => ({
    value: row.issue_item,
    label: row.issue_item,
    count: Number(row.count || 0)
  }));
}

async function ensureUnqualifiedProductsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_title VARCHAR(255) NOT NULL DEFAULT '40批次不符合规定化妆品信息',
      total_batches INT DEFAULT 0,
      sequence_no INT NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      company_names TEXT,
      company_addresses TEXT,
      manufacturer_name VARCHAR(500),
      manufacturer_address TEXT,
      operator_name VARCHAR(500),
      operator_address TEXT,
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
      product_category VARCHAR(100) NULL,
      manufacturer_province VARCHAR(100) NULL,
      manufacturer_city VARCHAR(100) NULL,
      sampled_province VARCHAR(100) NULL,
      sampled_city VARCHAR(100) NULL,
      issue_category VARCHAR(100) NULL,
      product_type VARCHAR(50) NOT NULL DEFAULT 'cosmetics',
      announcement_type VARCHAR(50) NOT NULL DEFAULT 'sampling',
      source_key VARCHAR(80) NULL,
      source_no VARCHAR(255) NULL,
      source_title VARCHAR(500) NULL,
      source_publish_date DATETIME NULL,
      source_year INT NULL,
      province_display VARCHAR(100) NULL,
      company_id INT NULL,
      announcement_id INT NULL,
      announcement_detail_id INT NULL,
      supervision_id INT NULL,
      supervision_detail_id INT NULL,
      is_counterfeit TINYINT(1) DEFAULT 0,
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
  await ensureColumn(connection, 'manufacturer_name', 'VARCHAR(500) NULL AFTER company_addresses');
  await ensureColumn(connection, 'manufacturer_address', 'TEXT NULL AFTER manufacturer_name');
  await ensureColumn(connection, 'operator_name', 'VARCHAR(500) NULL AFTER manufacturer_address');
  await ensureColumn(connection, 'operator_address', 'TEXT NULL AFTER operator_name');
  await ensureColumn(connection, 'sample_unit_name', 'VARCHAR(500) NULL');
  await ensureColumn(connection, 'sample_unit_address', 'TEXT NULL');
  await connection.query(`
    UPDATE unqualified_products
    SET
      manufacturer_name = COALESCE(NULLIF(TRIM(manufacturer_name), ''), company_names),
      manufacturer_address = COALESCE(NULLIF(TRIM(manufacturer_address), ''), company_addresses),
      operator_name = COALESCE(NULLIF(TRIM(operator_name), ''), sample_unit_name),
      operator_address = COALESCE(NULLIF(TRIM(operator_address), ''), sample_unit_address)
    WHERE manufacturer_name IS NULL
       OR manufacturer_address IS NULL
       OR operator_name IS NULL
       OR operator_address IS NULL
  `);
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
  await ensureColumn(connection, 'product_category', 'VARCHAR(100) NULL AFTER remarks');
  await ensureColumn(connection, 'manufacturer_province', 'VARCHAR(100) NULL AFTER product_category');
  await ensureColumn(connection, 'manufacturer_city', 'VARCHAR(100) NULL AFTER manufacturer_province');
  await ensureColumn(connection, 'sampled_province', 'VARCHAR(100) NULL AFTER manufacturer_city');
  await ensureColumn(connection, 'sampled_city', 'VARCHAR(100) NULL AFTER sampled_province');
  await ensureColumn(connection, 'issue_category', 'VARCHAR(100) NULL AFTER sampled_city');
  await ensureColumn(connection, 'product_type', "VARCHAR(50) NOT NULL DEFAULT 'cosmetics' AFTER issue_category");
  await ensureColumn(connection, 'announcement_type', "VARCHAR(50) NOT NULL DEFAULT 'sampling' AFTER product_type");
  await ensureColumn(connection, 'source_key', 'VARCHAR(80) NULL AFTER announcement_type');
  await ensureColumn(connection, 'source_no', 'VARCHAR(255) NULL AFTER source_key');
  await ensureColumn(connection, 'source_title', 'VARCHAR(500) NULL AFTER source_no');
  await ensureColumn(connection, 'source_publish_date', 'DATETIME NULL AFTER source_title');
  await ensureColumn(connection, 'source_year', 'INT NULL AFTER source_publish_date');
  await ensureColumn(connection, 'province_display', 'VARCHAR(100) NULL AFTER source_year');
  await ensureColumn(connection, 'company_id', 'INT NULL AFTER province_display');
  await ensureColumn(connection, 'announcement_id', 'INT NULL AFTER company_id');
  await ensureColumn(connection, 'announcement_detail_id', 'INT NULL AFTER announcement_id');
  await ensureColumn(connection, 'supervision_id', 'INT NULL AFTER announcement_detail_id');
  await ensureColumn(connection, 'supervision_detail_id', 'INT NULL AFTER supervision_id');
  await ensureColumn(connection, 'is_counterfeit', 'TINYINT(1) DEFAULT 0 AFTER supervision_detail_id');
  await ensureColumn(
    connection,
    'usage_user',
    "TEXT NULL COMMENT '使用用户（保存文案时追加 JSON 记录）' AFTER is_counterfeit"
  );
  await ensureColumn(connection, 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn(connection, 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_sample_unit_name', 'INDEX idx_unqualified_products_sample_unit_name (sample_unit_name)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_manufacturer_name', 'INDEX idx_unqualified_products_manufacturer_name (manufacturer_name)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_operator_name', 'INDEX idx_unqualified_products_operator_name (operator_name)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_inspection_institution', 'INDEX idx_unqualified_products_inspection_institution (inspection_institution)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_announcement', 'INDEX idx_unqualified_products_announcement (announcement_id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_announcement_detail', 'INDEX idx_unqualified_products_announcement_detail (announcement_detail_id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_supervision', 'INDEX idx_unqualified_products_supervision (supervision_id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_supervision_detail', 'INDEX idx_unqualified_products_supervision_detail (supervision_detail_id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_counterfeit', 'INDEX idx_unqualified_products_counterfeit (is_counterfeit)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_list_order', 'INDEX idx_unqualified_products_list_order (announcement_id, sequence_no, id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_product_region', 'INDEX idx_unqualified_products_product_region (product_region)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_product_category', 'INDEX idx_unqualified_products_product_category (product_category)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_manufacturer_province', 'INDEX idx_unqualified_products_manufacturer_province (manufacturer_province)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_manufacturer_city', 'INDEX idx_unqualified_products_manufacturer_city (manufacturer_city)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_sampled_province', 'INDEX idx_unqualified_products_sampled_province (sampled_province)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_sampled_city', 'INDEX idx_unqualified_products_sampled_city (sampled_city)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_issue_category', 'INDEX idx_unqualified_products_issue_category (issue_category)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_product_type', 'INDEX idx_unqualified_products_product_type (product_type)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_announcement_type', 'INDEX idx_unqualified_products_announcement_type (announcement_type)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_source_key', 'INDEX idx_unqualified_products_source_key (source_key)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_source_year', 'INDEX idx_unqualified_products_source_year (source_year)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_source_publish_date', 'INDEX idx_unqualified_products_source_publish_date (source_publish_date)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_province_display', 'INDEX idx_unqualified_products_province_display (province_display)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_company_id', 'INDEX idx_unqualified_products_company_id (company_id)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_tree_filters', 'INDEX idx_unqualified_products_tree_filters (source_year, announcement_type, product_type)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_province_year', 'INDEX idx_unqualified_products_province_year (province_display, source_year)');
  await ensureIndex(connection, 'unqualified_products', 'idx_unqualified_products_source_order', 'INDEX idx_unqualified_products_source_order (source_publish_date, id)');

  if (await tableExists(connection, 'announcements')) {
    await ensureForeignKey(
      connection,
      'unqualified_products',
      'fk_unqualified_products_announcement',
      'FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'announcement_product_details')) {
    await ensureForeignKey(
      connection,
      'unqualified_products',
      'fk_unqualified_products_announcement_detail',
      'FOREIGN KEY (announcement_detail_id) REFERENCES announcement_product_details(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'supervisions')) {
    await ensureForeignKey(
      connection,
      'unqualified_products',
      'fk_unqualified_products_supervision',
      'FOREIGN KEY (supervision_id) REFERENCES supervisions(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'flight_inspection_detail')) {
    await ensureForeignKey(
      connection,
      'unqualified_products',
      'fk_unqualified_products_supervision_detail',
      'FOREIGN KEY (supervision_detail_id) REFERENCES flight_inspection_detail(id) ON DELETE CASCADE'
    );
  }
  if (await tableExists(connection, 'companies')) {
    await ensureForeignKey(
      connection,
      'unqualified_products',
      'fk_unqualified_products_company',
      'FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL'
    );
  }

  await ensureUnqualifiedProductCategoryItemsTable(connection);

  await ensureUnqualifiedProductCategoryCatalogTable(connection);

  await ensureUnqualifiedProductTypeCatalogTable(connection);

  await ensureUnqualifiedProductIssueItemsTable(connection);
  await ensureUnqualifiedProductCopyRecordsTable(connection);
  await ensureUnqualifiedProductTreeRollupTable(connection);
  await backfillDerivedFields(connection);
  await backfillSearchHotFields(connection);
  await backfillProductCategoryItemsIfNeeded(connection);
  await backfillIssueItemsIfNeeded(connection);
  await backfillUnqualifiedProductTreeRollupsIfNeeded(connection);
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

    const payload = enrichPayload({
      ...row,
      announcement_id: null,
      announcement_detail_id: null,
      supervision_id: null,
      supervision_detail_id: null,
      source_no: null,
      source_title: row.batch_title,
      source_publish_date: null,
      company_id: null,
      is_counterfeit: 0
    });

    if (existingRows.length > 0) {
      await connection.query(
        `
          UPDATE unqualified_products
          SET batch_title = ?, total_batches = ?, company_names = ?, company_addresses = ?,
              sample_unit_name = ?, sample_unit_address = ?, package_spec = ?, batch_no = ?,
              production_date = ?, expiry_date = ?, product_region = ?, registration_no = ?,
              production_license_no = ?, inspection_institution = ?, unqualified_items = ?,
              inspection_result = ?, requirement = ?, remarks = ?, product_category = ?,
              manufacturer_province = ?, manufacturer_city = ?, sampled_province = ?, sampled_city = ?, issue_category = ?,
              product_type = ?, announcement_type = ?, is_counterfeit = 0,
              announcement_id = NULL, announcement_detail_id = NULL,
              supervision_id = NULL, supervision_detail_id = NULL
          WHERE id = ?
        `,
        [
          payload.batch_title,
          payload.total_batches,
          payload.company_names,
          payload.company_addresses,
          payload.sample_unit_name,
          payload.sample_unit_address,
          payload.package_spec,
          payload.batch_no,
          payload.production_date,
          payload.expiry_date,
          payload.product_region,
          payload.registration_no,
          payload.production_license_no,
          payload.inspection_institution,
          payload.unqualified_items,
          payload.inspection_result,
          payload.requirement,
          payload.remarks,
          payload.product_category,
          payload.manufacturer_province,
          payload.manufacturer_city,
          payload.sampled_province,
          payload.sampled_city,
          payload.issue_category,
          payload.product_type,
          payload.announcement_type,
          existingRows[0].id
        ]
      );
      continue;
    }

    const insertFields = [...UNQUALIFIED_PRODUCT_FIELDS, ...SOURCE_LINK_FIELDS];
    await connection.query(
      `
        INSERT INTO unqualified_products (${insertFields.join(', ')})
        VALUES (${insertFields.map(() => '?').join(', ')})
      `,
      insertFields.map((field) => payload[field] ?? null)
    );
  }

  return rows.length;
}

async function replaceUnqualifiedProductsFromAnnouncementDetails(connection, announcementId) {
  await ensureUnqualifiedProductsTable(connection);

  const [announcementRows] = await connection.query(
    `
      SELECT id, title, announcement_no, publish_date, product_type, announcement_type
      FROM announcements
      WHERE id = ?
      LIMIT 1
    `,
    [announcementId]
  );
  const announcement = announcementRows[0];

  await connection.query('DELETE FROM unqualified_products WHERE announcement_id = ?', [announcementId]);

  if (!announcement) {
    return {
      synced_count: 0,
      batch_title: DEFAULT_BATCH_TITLE,
      total_batches: 0,
      synced_product_category_count: 0,
      synced_issue_item_count: 0
    };
  }

  const [detailRows] = await connection.query(
    `
      SELECT id, sequence_no, product_name, company_names, company_addresses,
             manufacturer_name, manufacturer_address, operator_name, operator_address,
             sample_unit_name, sample_unit_address, package_spec, batch_no, production_date, expiry_date,
             product_region, registration_no, production_license_no, inspection_institution,
             unqualified_items, inspection_result, requirement, remarks, is_counterfeit
      FROM announcement_product_details
      WHERE announcement_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [announcementId]
  );

  if (detailRows.length === 0) {
    const productCategorySyncResult = await syncProductCategoryItemsForSource(connection, { announcementId });
    const issueSyncResult = await syncIssueItemsForSource(connection, { announcementId });

    return {
      synced_count: 0,
      batch_title: buildSourceBatchTitle(announcement, {
        productType: announcement.product_type,
        announcementType: announcement.announcement_type
      }),
      total_batches: 0,
      synced_product_category_count: productCategorySyncResult.synced_product_category_count,
      synced_issue_item_count: issueSyncResult.synced_issue_item_count
    };
  }

  const productType = normalizeProductType(announcement.product_type);
  const announcementType = normalizeAnnouncementType(announcement.announcement_type);
  const batchTitle = buildSourceBatchTitle(announcement, { productType, announcementType });
  const totalBatches = detailRows.length;
  const insertFields = [...UNQUALIFIED_PRODUCT_FIELDS, ...SOURCE_LINK_FIELDS];
  const payloadRows = detailRows.map((row) => enrichPayload({
    batch_title: batchTitle,
    total_batches: totalBatches,
    sequence_no: row.sequence_no,
    product_name: row.product_name,
    company_names: row.company_names,
    company_addresses: row.company_addresses,
    manufacturer_name: row.manufacturer_name,
    manufacturer_address: row.manufacturer_address,
    operator_name: row.operator_name,
    operator_address: row.operator_address,
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
    product_type: productType,
    announcement_type: announcementType,
    announcement_id: Number(announcementId),
    announcement_detail_id: row.id,
    supervision_id: null,
    supervision_detail_id: null,
    source_no: announcement.announcement_no,
    source_title: announcement.title,
    source_publish_date: announcement.publish_date || null,
    company_id: null,
    is_counterfeit: row.is_counterfeit ? 1 : 0
  }));

  const chunkSize = 200;
  for (let index = 0; index < payloadRows.length; index += chunkSize) {
    const chunk = payloadRows.slice(index, index + chunkSize);
    const sql = `
      INSERT INTO unqualified_products (${insertFields.join(', ')})
      VALUES ${chunk.map(() => `(${insertFields.map(() => '?').join(', ')})`).join(', ')}
    `;
    const values = chunk.flatMap((payload) => insertFields.map((field) => payload[field] ?? null));
    await connection.query(sql, values);
  }

  const productCategorySyncResult = await syncProductCategoryItemsForSource(connection, { announcementId });
  const issueSyncResult = await syncIssueItemsForSource(connection, { announcementId });
  await backfillSearchHotFields(connection);
  const rollupSyncResult = await rebuildUnqualifiedProductTreeRollupsForSource(connection, { announcementId });

  return {
    synced_count: detailRows.length,
    batch_title: batchTitle,
    total_batches: totalBatches,
    synced_product_category_count: productCategorySyncResult.synced_product_category_count,
    synced_issue_item_count: issueSyncResult.synced_issue_item_count,
    synced_rollup_count: rollupSyncResult.synced_rollup_count
  };
}

async function replaceUnqualifiedProductsFromFlightInspectionDetails(connection, supervisionId) {
  await ensureUnqualifiedProductsTable(connection);

  const [supervisionRows] = await connection.query(
    `
      SELECT id, title, company_name, production_license_no, company_address, publish_date,
             supervision_date, supervision_unit, inspection_basis, defects_and_problems,
             handling_measures, region, product_type, announcement_type, content
      FROM supervisions
      WHERE id = ?
      LIMIT 1
    `,
    [supervisionId]
  );
  const supervision = supervisionRows[0];

  await connection.query('DELETE FROM unqualified_products WHERE supervision_id = ?', [supervisionId]);

  if (!supervision) {
    return {
      synced_count: 0,
      batch_title: DEFAULT_BATCH_TITLE,
      total_batches: 0,
      synced_product_category_count: 0,
      synced_issue_item_count: 0
    };
  }

  const [detailRows] = await connection.query(
    `
      SELECT id, sequence_no, title, company_name, production_license_no, company_address,
             inspection_unit, inspection_basis, defects_and_problems, handling_measures,
             publish_date, publish_date_text, raw_text
      FROM flight_inspection_detail
      WHERE supervision_id = ?
      ORDER BY sequence_no ASC, id ASC
    `,
    [supervisionId]
  );

  const sourceRows = detailRows.length > 0
    ? detailRows
    : [{
        id: null,
        sequence_no: 1,
        title: supervision.title,
        company_name: supervision.company_name,
        production_license_no: supervision.production_license_no,
        company_address: supervision.company_address,
        inspection_unit: supervision.supervision_unit,
        inspection_basis: supervision.inspection_basis,
        defects_and_problems: supervision.defects_and_problems,
        handling_measures: supervision.handling_measures,
        publish_date: supervision.publish_date || supervision.supervision_date,
        publish_date_text: supervision.publish_date || supervision.supervision_date || null,
        raw_text: supervision.content
      }];

  const productType = normalizeProductType(supervision.product_type || DEFAULT_PRODUCT_TYPE);
  const announcementType = normalizeAnnouncementType(supervision.announcement_type || 'flight_inspection');
  const batchTitle = buildSourceBatchTitle(supervision, { productType, announcementType });
  const totalBatches = sourceRows.length;
  const insertFields = [...UNQUALIFIED_PRODUCT_FIELDS, ...SOURCE_LINK_FIELDS];
  const payloadRows = sourceRows.map((row, index) => enrichPayload({
    batch_title: batchTitle,
    total_batches: totalBatches,
    sequence_no: Number(row.sequence_no || index + 1),
    product_name: row.title || `${row.company_name || supervision.company_name || '企业'}飞行检查问题项`,
    company_names: row.company_name || supervision.company_name || null,
    company_addresses: row.company_address || supervision.company_address || null,
    manufacturer_name: row.company_name || supervision.company_name || null,
    manufacturer_address: row.company_address || supervision.company_address || null,
    operator_name: null,
    operator_address: null,
    sample_unit_name: null,
    sample_unit_address: null,
    package_spec: null,
    batch_no: null,
    production_date: null,
    expiry_date: row.publish_date_text || row.publish_date || null,
    product_region: supervision.region || null,
    registration_no: null,
    production_license_no: row.production_license_no || supervision.production_license_no || null,
    inspection_institution: row.inspection_unit || supervision.supervision_unit || null,
    unqualified_items: row.defects_and_problems || supervision.defects_and_problems || null,
    inspection_result: row.handling_measures || supervision.handling_measures || null,
    requirement: row.inspection_basis || supervision.inspection_basis || null,
    remarks: row.raw_text || supervision.content || null,
    product_type: productType,
    announcement_type: announcementType,
    announcement_id: null,
    announcement_detail_id: null,
    supervision_id: Number(supervisionId),
    supervision_detail_id: row.id || null,
    source_no: `飞检通告#${supervisionId}`,
    source_title: supervision.title,
    source_publish_date: supervision.publish_date || supervision.supervision_date || row.publish_date || null,
    company_id: null,
    is_counterfeit: 0
  }));

  const chunkSize = 200;
  for (let index = 0; index < payloadRows.length; index += chunkSize) {
    const chunk = payloadRows.slice(index, index + chunkSize);
    const sql = `
      INSERT INTO unqualified_products (${insertFields.join(', ')})
      VALUES ${chunk.map(() => `(${insertFields.map(() => '?').join(', ')})`).join(', ')}
    `;
    const values = chunk.flatMap((payload) => insertFields.map((field) => payload[field] ?? null));
    await connection.query(sql, values);
  }

  const productCategorySyncResult = await syncProductCategoryItemsForSource(connection, { supervisionId });
  const issueSyncResult = await syncIssueItemsForSource(connection, { supervisionId });
  await backfillSearchHotFields(connection);
  const rollupSyncResult = await rebuildUnqualifiedProductTreeRollupsForSource(connection, { supervisionId });

  return {
    synced_count: payloadRows.length,
    batch_title: batchTitle,
    total_batches: totalBatches,
    synced_product_category_count: productCategorySyncResult.synced_product_category_count,
    synced_issue_item_count: issueSyncResult.synced_issue_item_count,
    synced_rollup_count: rollupSyncResult.synced_rollup_count
  };
}

module.exports = {
  DEFAULT_BATCH_TITLE,
  DEFAULT_TOTAL_BATCHES,
  DEFAULT_PRODUCT_TYPE,
  DEFAULT_ANNOUNCEMENT_TYPE,
  UNQUALIFIED_PRODUCT_FIELDS,
  getDefaultUnqualifiedProducts,
  ensureUnqualifiedProductsTable,
  ensureUnqualifiedProductCategoryItemsTable,
  ensureUnqualifiedProductIssueItemsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions,
  seedDefaultUnqualifiedProducts,
  replaceUnqualifiedProductsFromAnnouncementDetails,
  replaceUnqualifiedProductsFromFlightInspectionDetails,
  normalizeProductType,
  normalizeAnnouncementType,
  getProductTypeLabel,
  getAnnouncementTypeLabel,
  getProductTypeOptions,
  getAnnouncementTypeOptions
};

