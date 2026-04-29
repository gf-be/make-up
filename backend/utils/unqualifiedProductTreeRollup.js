function normalizeText(value) {
  return String(value || '').trim()
}

function splitJoinedValues(value, fallbackValue = '') {
  const values = String(value || '')
    .split('||')
    .map((item) => normalizeText(item))
    .filter(Boolean)

  if (values.length) {
    return Array.from(new Set(values))
  }

  const fallback = normalizeText(fallbackValue)
  return fallback ? [fallback] : []
}

function buildSourceCondition(filter = {}, params = []) {
  if (filter.announcementId !== undefined && filter.announcementId !== null) {
    params.push(Number(filter.announcementId))
    return 'announcement_id = ?'
  }

  if (filter.supervisionId !== undefined && filter.supervisionId !== null) {
    params.push(Number(filter.supervisionId))
    return 'supervision_id = ?'
  }

  params.push(0)
  return '1 = ?'
}

async function ensureRollupColumn(connection, columnName, definition) {
  const [rows] = await connection.query('SHOW COLUMNS FROM unqualified_product_tree_rollups LIKE ?', [columnName])
  if (!rows.length) {
    try {
      await connection.query(`ALTER TABLE unqualified_product_tree_rollups ADD COLUMN ${columnName} ${definition}`)
    } catch (error) {
      if (error?.code !== 'ER_DUP_FIELDNAME') throw error
    }
  }
}

async function ensureRollupIndex(connection, indexName, definition) {
  const [rows] = await connection.query('SHOW INDEX FROM unqualified_product_tree_rollups WHERE Key_name = ?', [indexName])
  if (!rows.length) {
    try {
      await connection.query(`ALTER TABLE unqualified_product_tree_rollups ADD ${definition}`)
    } catch (error) {
      if (error?.code !== 'ER_DUP_KEYNAME') throw error
    }
  }
}

function expandRollupRows(row = {}) {
  const sourceKey = normalizeText(row.source_key)
  if (!sourceKey) {
    return []
  }

  const sourceLabel = normalizeText(row.source_no) || '未命名来源'
  const sourceTitle = normalizeText(row.source_title) || row.batch_title || ''
  const provinceDisplay = normalizeText(row.province_display) || '未标注省份'
  const manufacturerProvince = normalizeText(row.manufacturer_province) || provinceDisplay
  const manufacturerCity = normalizeText(row.manufacturer_city) || '未标注城市'
  const sampledProvince = normalizeText(row.sampled_province) || '未标注省份'
  const sampledCity = normalizeText(row.sampled_city) || '未标注城市'
  const yearValue = normalizeText(row.source_year) || '未标注年份'
  const productCategories = splitJoinedValues(row.product_categories_joined, row.product_category || '其他')
  const issueItems = splitJoinedValues(row.issue_items_joined, row.unqualified_items ? '' : '未拆分项目')
  const categoryValues = productCategories.length ? productCategories : ['其他']
  const issueValues = issueItems.length ? issueItems : ['未拆分项目']
  const records = []

  categoryValues.forEach((productCategory) => {
    issueValues.forEach((issueItem) => {
      records.push([
        Number(row.id),
        sourceKey,
        sourceLabel,
        sourceTitle,
        row.source_publish_date || null,
        provinceDisplay,
        manufacturerProvince,
        manufacturerCity,
        sampledProvince,
        sampledCity,
        productCategory,
        issueItem,
        yearValue
      ])
    })
  })

  return records
}

async function ensureUnqualifiedProductTreeRollupTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS unqualified_product_tree_rollups (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      unqualified_product_id INT NOT NULL,
      source_key VARCHAR(80) NOT NULL,
      source_label VARCHAR(255) NOT NULL,
      source_title VARCHAR(500) NULL,
      source_publish_date DATETIME NULL,
      province_display VARCHAR(100) NOT NULL,
      manufacturer_province VARCHAR(100) NOT NULL DEFAULT '未标注省份',
      manufacturer_city VARCHAR(100) NOT NULL DEFAULT '未标注城市',
      sampled_province VARCHAR(100) NOT NULL DEFAULT '未标注省份',
      sampled_city VARCHAR(100) NOT NULL DEFAULT '未标注城市',
      product_category VARCHAR(100) NOT NULL,
      issue_item VARCHAR(255) NOT NULL,
      year_value VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_unqualified_product_tree_rollup (
        unqualified_product_id,
        source_key,
        province_display,
        product_category,
        issue_item,
        year_value
      ),
      INDEX idx_uptr_product (unqualified_product_id),
      INDEX idx_uptr_source_key (source_key),
      INDEX idx_uptr_province (province_display),
      INDEX idx_uptr_manufacturer_region (manufacturer_province, manufacturer_city),
      INDEX idx_uptr_sampled_region (sampled_province, sampled_city),
      INDEX idx_uptr_product_category (product_category),
      INDEX idx_uptr_issue_item (issue_item),
      INDEX idx_uptr_year_value (year_value)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await ensureRollupColumn(connection, 'manufacturer_province', "VARCHAR(100) NOT NULL DEFAULT '未标注省份' AFTER province_display")
  await ensureRollupColumn(connection, 'manufacturer_city', "VARCHAR(100) NOT NULL DEFAULT '未标注城市' AFTER manufacturer_province")
  await ensureRollupColumn(connection, 'sampled_province', "VARCHAR(100) NOT NULL DEFAULT '未标注省份' AFTER manufacturer_city")
  await ensureRollupColumn(connection, 'sampled_city', "VARCHAR(100) NOT NULL DEFAULT '未标注城市' AFTER sampled_province")
  await ensureRollupIndex(connection, 'idx_uptr_manufacturer_region', 'INDEX idx_uptr_manufacturer_region (manufacturer_province, manufacturer_city)')
  await ensureRollupIndex(connection, 'idx_uptr_sampled_region', 'INDEX idx_uptr_sampled_region (sampled_province, sampled_city)')

  await connection.query(`
    UPDATE unqualified_product_tree_rollups utr
    INNER JOIN unqualified_products up ON up.id = utr.unqualified_product_id
    SET
      utr.manufacturer_province = COALESCE(NULLIF(TRIM(up.manufacturer_province), ''), NULLIF(TRIM(up.province_display), ''), '未标注省份'),
      utr.manufacturer_city = COALESCE(NULLIF(TRIM(up.manufacturer_city), ''), '未标注城市'),
      utr.sampled_province = COALESCE(NULLIF(TRIM(up.sampled_province), ''), '未标注省份'),
      utr.sampled_city = COALESCE(NULLIF(TRIM(up.sampled_city), ''), '未标注城市')
    WHERE utr.manufacturer_province = '未标注省份'
       OR utr.manufacturer_city = '未标注城市'
       OR utr.sampled_province = '未标注省份'
       OR utr.sampled_city = '未标注城市'
  `)

  const [fkRows] = await connection.query(
    `
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'unqualified_product_tree_rollups'
        AND CONSTRAINT_NAME = 'fk_uptr_unqualified_product'
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      LIMIT 1
    `
  )

  if (!fkRows.length) {
    await connection.query(`
      ALTER TABLE unqualified_product_tree_rollups
      ADD CONSTRAINT fk_uptr_unqualified_product
      FOREIGN KEY (unqualified_product_id) REFERENCES unqualified_products(id) ON DELETE CASCADE
    `)
  }
}

async function rebuildUnqualifiedProductTreeRollupsForSource(connection, filter = {}) {
  await ensureUnqualifiedProductTreeRollupTable(connection)

  const sourceParams = []
  const sourceCondition = buildSourceCondition(filter, sourceParams)
  const [rows] = await connection.query(
    `
      SELECT
        up.id,
        up.batch_title,
        up.source_key,
        up.source_no,
        up.source_title,
        up.source_publish_date,
        up.source_year,
        up.province_display,
        up.manufacturer_province,
        up.manufacturer_city,
        up.sampled_province,
        up.sampled_city,
        up.product_category,
        up.unqualified_items,
        upii_agg.issue_items_joined,
        upci_agg.product_categories_joined
      FROM unqualified_products up
      LEFT JOIN (
        SELECT
          unqualified_product_id,
          GROUP_CONCAT(DISTINCT issue_item ORDER BY issue_item ASC SEPARATOR '||') AS issue_items_joined
        FROM unqualified_product_issue_items
        GROUP BY unqualified_product_id
      ) upii_agg ON upii_agg.unqualified_product_id = up.id
      LEFT JOIN (
        SELECT
          unqualified_product_id,
          GROUP_CONCAT(DISTINCT product_category ORDER BY product_category ASC SEPARATOR '||') AS product_categories_joined
        FROM unqualified_product_category_items
        GROUP BY unqualified_product_id
      ) upci_agg ON upci_agg.unqualified_product_id = up.id
      WHERE ${sourceCondition}
    `,
    sourceParams
  )

  const productIds = rows.map((row) => Number(row.id)).filter(Boolean)
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => '?').join(', ')
    await connection.query(
      `DELETE FROM unqualified_product_tree_rollups WHERE unqualified_product_id IN (${placeholders})`,
      productIds
    )
  }

  const insertRows = rows.flatMap((row) => expandRollupRows(row))
  if (!insertRows.length) {
    return { synced_rollup_count: 0 }
  }

  const chunkSize = 1000
  for (let index = 0; index < insertRows.length; index += chunkSize) {
    const chunk = insertRows.slice(index, index + chunkSize)
    await connection.query(
      `
        INSERT INTO unqualified_product_tree_rollups (
          unqualified_product_id,
          source_key,
          source_label,
          source_title,
          source_publish_date,
          province_display,
          manufacturer_province,
          manufacturer_city,
          sampled_province,
          sampled_city,
          product_category,
          issue_item,
          year_value
        ) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
      `,
      chunk.flat()
    )
  }

  return { synced_rollup_count: insertRows.length }
}

async function backfillUnqualifiedProductTreeRollupsIfNeeded(connection) {
  await ensureUnqualifiedProductTreeRollupTable(connection)

  const [countRows] = await connection.query('SELECT COUNT(*) AS total FROM unqualified_product_tree_rollups')
  const total = Number(countRows[0]?.total || 0)
  if (total > 0) {
    return
  }

  const [sourceRows] = await connection.query(`
    SELECT DISTINCT announcement_id, supervision_id
    FROM unqualified_products
    WHERE announcement_id IS NOT NULL OR supervision_id IS NOT NULL
    ORDER BY announcement_id ASC, supervision_id ASC
  `)

  for (const row of sourceRows) {
    if (row.announcement_id != null) {
      await rebuildUnqualifiedProductTreeRollupsForSource(connection, { announcementId: row.announcement_id })
      continue
    }
    if (row.supervision_id != null) {
      await rebuildUnqualifiedProductTreeRollupsForSource(connection, { supervisionId: row.supervision_id })
    }
  }
}

module.exports = {
  ensureUnqualifiedProductTreeRollupTable,
  rebuildUnqualifiedProductTreeRollupsForSource,
  backfillUnqualifiedProductTreeRollupsIfNeeded
}
