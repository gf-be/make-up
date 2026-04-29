const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions,
  getProductTypeLabel,
  getAnnouncementTypeLabel,
  getProductTypeOptions,
  getAnnouncementTypeOptions,
  normalizeProductType,
  normalizeAnnouncementType
} = require('../utils/unqualifiedProducts');

function parseListParam(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseListParam(item));
  }

  if (value === undefined || value === null) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      return parseListParam(JSON.parse(text));
    } catch (error) {
      // ignore
    }
  }

  return text
    .split('|')
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function clampPageSize(limit, defaultValue = 10, maxValue = 200) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function parseYearValue(value) {
  const year = Number.parseInt(value, 10);
  return Number.isInteger(year) && year > 2000 ? year : null;
}

function normalizeYearRange(startValue, endValue, fallbackValue = '') {
  const fallbackYear = parseYearValue(fallbackValue);
  let yearStart = parseYearValue(startValue) ?? fallbackYear;
  let yearEnd = parseYearValue(endValue) ?? fallbackYear;

  if (yearStart && yearEnd && yearStart > yearEnd) {
    [yearStart, yearEnd] = [yearEnd, yearStart];
  }

  return { yearStart, yearEnd };
}

function buildProvinceDisplayExpr(alias = 'up') {
  return `COALESCE(NULLIF(TRIM(${alias}.manufacturer_province), ''), NULLIF(TRIM(${alias}.sampled_province), ''), NULLIF(TRIM(${alias}.product_region), ''))`;
}

function buildSourceDateExpr(announcementAlias = 'a', supervisionAlias = 's') {
  return `COALESCE(${announcementAlias}.publish_date, ${supervisionAlias}.publish_date, ${supervisionAlias}.supervision_date)`;
}

function buildSourceTitleExpr(announcementAlias = 'a', supervisionAlias = 's', productAlias = 'up') {
  return `COALESCE(NULLIF(TRIM(${announcementAlias}.title), ''), NULLIF(TRIM(${supervisionAlias}.title), ''), ${productAlias}.batch_title)`;
}

function buildSourceUrlExpr(announcementAlias = 'a', supervisionAlias = 's') {
  return `COALESCE(${announcementAlias}.source_detail_url, ${supervisionAlias}.source_detail_url)`;
}

function buildSourceTypeExpr(alias = 'up') {
  return `CASE
    WHEN ${alias}.announcement_id IS NOT NULL THEN 'announcement'
    WHEN ${alias}.supervision_id IS NOT NULL THEN 'supervision'
    ELSE 'unknown'
  END`;
}

function buildSourceIdExpr(alias = 'up') {
  return `COALESCE(${alias}.announcement_id, ${alias}.supervision_id)`;
}

function buildSourceUniqueExpr(alias = 'up') {
  return `CONCAT(${buildSourceTypeExpr(alias)}, ':', ${buildSourceIdExpr(alias)})`;
}

function buildSourceNumberExpr(announcementAlias = 'a', supervisionAlias = 's', productAlias = 'up') {
  return `COALESCE(
    NULLIF(TRIM(${announcementAlias}.announcement_no), ''),
    CONCAT('飞检通告#', ${productAlias}.supervision_id),
    CONCAT('来源#', ${buildSourceIdExpr(productAlias)})
  )`;
}

function buildCompanyIdExpr(alias = 'up') {
  return `COALESCE(
    (
      SELECT MIN(csr.company_id)
      FROM company_sampling_records csr
      WHERE csr.announcement_id = ${alias}.announcement_id
        AND csr.announcement_detail_id = ${alias}.announcement_detail_id
    ),
    (
      SELECT MIN(csr2.company_id)
      FROM company_supervision_records csr2
      WHERE csr2.supervision_id = ${alias}.supervision_id
        AND (${alias}.supervision_detail_id IS NULL OR csr2.supervision_detail_id = ${alias}.supervision_detail_id)
    )
  )`;
}

function buildOptionItems(rows = [], fieldName = 'value') {
  return rows
    .map((row) => String(row?.[fieldName] || '').trim())
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
}

async function ensureUnqualifiedProductsReady() {
  await ensureUnqualifiedProductsTable(pool);
}

function buildIssueFilterClause(issueItems, params) {
  if (!issueItems.length) {
    return '';
  }

  params.push(...issueItems);
  return `
    INNER JOIN (
      SELECT DISTINCT unqualified_product_id
      FROM unqualified_product_issue_items
      WHERE issue_item IN (${issueItems.map(() => '?').join(', ')})
    ) issue_filter ON issue_filter.unqualified_product_id = up.id
  `;
}

function buildCategoryFilterClause(productCategory, params) {
  if (!productCategory) {
    return '';
  }

  params.push(productCategory, productCategory);
  return `(
    up.product_category = ?
    OR EXISTS (
      SELECT 1
      FROM unqualified_product_category_items upci_filter
      WHERE upci_filter.unqualified_product_id = up.id
        AND upci_filter.product_category = ?
    )
  )`;
}

function appendUnqualifiedProductFilters(conditions, params, filters = {}) {
  const normalizedKeyword = normalizeOptionalText(filters.keyword);
  const normalizedCompanyKeyword = normalizeOptionalText(filters.company_keyword);
  const normalizedSourceKeyword = normalizeOptionalText(filters.source_keyword);
  const normalizedItem = normalizeOptionalText(filters.unqualified_item);
  const normalizedProductType = normalizeOptionalText(filters.product_type);
  const normalizedAnnouncementType = normalizeOptionalText(filters.announcement_type);
  const normalizedProvince = normalizeOptionalText(filters.province);
  const normalizedProductCategory = normalizeOptionalText(filters.product_category);
  const normalizedAnnouncementId = Number.parseInt(filters.announcement_id, 10) || null;
  const normalizedSupervisionId = Number.parseInt(filters.supervision_id, 10) || null;
  const { yearStart, yearEnd } = normalizeYearRange(filters.year_start, filters.year_end, filters.year);
  const selectedIssueItems = parseListParam(filters.issue_items);

  if (normalizedKeyword) {
    conditions.push(`(
      up.product_name LIKE ? OR
      up.company_names LIKE ? OR
      up.company_addresses LIKE ? OR
      up.manufacturer_name LIKE ? OR
      up.manufacturer_address LIKE ? OR
      up.sample_unit_name LIKE ? OR
      up.sample_unit_address LIKE ? OR
      up.operator_name LIKE ? OR
      up.operator_address LIKE ? OR
      up.inspection_institution LIKE ? OR
      up.batch_title LIKE ? OR
      up.product_region LIKE ? OR
      up.source_title LIKE ?
    )`);
    params.push(
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`,
      `%${normalizedKeyword}%`
    );
  }

  if (normalizedCompanyKeyword) {
    conditions.push(`(
      up.company_names LIKE ?
      OR up.company_addresses LIKE ?
      OR up.manufacturer_name LIKE ?
      OR up.manufacturer_address LIKE ?
      OR up.sample_unit_name LIKE ?
      OR up.sample_unit_address LIKE ?
      OR up.operator_name LIKE ?
      OR up.operator_address LIKE ?
    )`);
    params.push(
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`,
      `%${normalizedCompanyKeyword}%`
    );
  }

  if (normalizedSourceKeyword) {
    conditions.push('up.source_title LIKE ?');
    params.push(`%${normalizedSourceKeyword}%`);
  }

  if (normalizedItem) {
    conditions.push('up.unqualified_items LIKE ?');
    params.push(`%${normalizedItem}%`);
  }

  if (normalizedProductType) {
    conditions.push('up.product_type = ?');
    params.push(normalizeProductType(normalizedProductType));
  }

  if (normalizedAnnouncementType) {
    conditions.push('up.announcement_type = ?');
    params.push(normalizeAnnouncementType(normalizedAnnouncementType));
  }

  if (normalizedProvince) {
    conditions.push('(up.manufacturer_province = ? OR up.sampled_province = ? OR up.province_display = ?)');
    params.push(normalizedProvince, normalizedProvince, normalizedProvince);
  }

  if (normalizeOptionalText(filters.manufacturer_province)) {
    conditions.push('up.manufacturer_province = ?');
    params.push(normalizeOptionalText(filters.manufacturer_province));
  }

  if (normalizeOptionalText(filters.sampled_province)) {
    conditions.push('up.sampled_province = ?');
    params.push(normalizeOptionalText(filters.sampled_province));
  }

  if (normalizedProductCategory) {
    conditions.push(buildCategoryFilterClause(normalizedProductCategory, params));
  }

  if (normalizedAnnouncementId) {
    conditions.push('up.announcement_id = ?');
    params.push(normalizedAnnouncementId);
  }

  if (normalizedSupervisionId) {
    conditions.push('up.supervision_id = ?');
    params.push(normalizedSupervisionId);
  }

  if (yearStart) {
    conditions.push('(up.source_year IS NOT NULL AND up.source_year >= ?)');
    params.push(yearStart);
  }

  if (yearEnd) {
    conditions.push('(up.source_year IS NOT NULL AND up.source_year <= ?)');
    params.push(yearEnd);
  }

  if (selectedIssueItems.length) {
    params.push(...selectedIssueItems);
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM unqualified_product_issue_items upii_filter
        WHERE upii_filter.unqualified_product_id = up.id
          AND upii_filter.issue_item IN (${selectedIssueItems.map(() => '?').join(', ')})
      )
    `);
  }
}

const TREE_DIMENSION_DEFS = {
  source: { key: 'source', label: '来源编号', multi: false },
  province: { key: 'province', label: '综合省份', multi: false },
  manufacturer_province: { key: 'manufacturer_province', label: '生产企业省份', multi: false },
  manufacturer_city: { key: 'manufacturer_city', label: '生产企业城市', multi: false },
  sampled_province: { key: 'sampled_province', label: '样品省份', multi: false },
  sampled_city: { key: 'sampled_city', label: '样品城市', multi: false },
  product_category: { key: 'product_category', label: '产品类别', multi: true },
  issue_item: { key: 'issue_item', label: '不符合项目', multi: true },
  year: { key: 'year', label: '年份', multi: false }
};

const DEFAULT_TREE_DIMENSIONS = ['source', 'manufacturer_province', 'manufacturer_city', 'product_category', 'issue_item'];
const MAX_TREE_DIMENSIONS = 5;
const TREE_DIMENSION_COLUMN_MAP = {
  source: 'source_key',
  province: 'province_display',
  manufacturer_province: 'manufacturer_province',
  manufacturer_city: 'manufacturer_city',
  sampled_province: 'sampled_province',
  sampled_city: 'sampled_city',
  product_category: 'product_category',
  issue_item: 'issue_item',
  year: 'year_value'
};

function parseJsonArrayParam(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return [item];
      }
      return parseJsonArrayParam(item);
    });
  }

  if (value === undefined || value === null) {
    return [];
  }

  if (value && typeof value === 'object') {
    return [value];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return parseListParam(value);
  }
}

function getConfiguredTreeDimensions(value) {
  const configured = parseJsonArrayParam(value)
    .map((item) => normalizeOptionalText(item))
    .filter(Boolean);

  const unique = [];
  configured.forEach((item) => {
    if (TREE_DIMENSION_DEFS[item] && !unique.includes(item) && unique.length < MAX_TREE_DIMENSIONS) {
      unique.push(item);
    }
  });

  return unique.length ? unique : [...DEFAULT_TREE_DIMENSIONS];
}

function parseJsonObjectParam(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return {};
  }

  const text = String(value).trim();
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function splitJoinedValues(value, fallbackValue = '') {
  const values = String(value || '')
    .split('||')
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (values.length) {
    return Array.from(new Set(values));
  }

  const fallback = normalizeOptionalText(fallbackValue);
  return fallback ? [fallback] : [];
}

function normalizeTreePath(path = {}) {
  const normalized = {};

  Object.keys(TREE_DIMENSION_DEFS).forEach((dimensionKey) => {
    const rawValue = normalizeOptionalText(path[dimensionKey]);
    if (rawValue) {
      normalized[dimensionKey] = rawValue;
    }
  });

  const legacySourceType = normalizeOptionalText(path.source_type);
  const legacySourceId = Number.parseInt(path.source_id, 10) || null;
  if (!normalized.source && legacySourceType && legacySourceId) {
    normalized.source = `${legacySourceType}:${legacySourceId}`;
  }

  return normalized;
}

function parseTreePaths(input = {}) {
  const parsed = parseJsonArrayParam(input.paths || input.checked_paths)
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => normalizeTreePath(item))
    .filter((item) => Object.keys(item).length > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  const legacyPath = normalizeTreePath({
    source_type: input.source_type,
    source_id: input.source_id,
    province: input.node_province,
    product_category: input.node_product_category,
    issue_item: input.node_issue_item,
    year: input.node_year
  });

  return Object.keys(legacyPath).length > 0 ? [legacyPath] : [];
}

function isTreePathSubset(basePath = {}, targetPath = {}) {
  return Object.entries(basePath).every(([key, value]) => targetPath[key] === value);
}

function compactTreePaths(paths = []) {
  const deduped = [];
  const seen = new Set();

  paths.forEach((path) => {
    const normalized = normalizeTreePath(path);
    const signature = JSON.stringify(Object.keys(normalized).sort().reduce((acc, key) => {
      acc[key] = normalized[key];
      return acc;
    }, {}));
    if (!seen.has(signature) && Object.keys(normalized).length > 0) {
      seen.add(signature);
      deduped.push(normalized);
    }
  });

  const sorted = [...deduped].sort((left, right) => Object.keys(left).length - Object.keys(right).length);
  const result = [];

  sorted.forEach((path) => {
    if (!result.some((existing) => isTreePathSubset(existing, path))) {
      result.push(path);
    }
  });

  return result;
}

function buildBaseFilterState(filters = {}) {
  const conditions = ['(up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)'];
  const params = [];
  appendUnqualifiedProductFilters(conditions, params, filters);
  return {
    whereClause: conditions.join(' AND '),
    params
  };
}

function getProductOrderClause(alias = 'up') {
  return `${alias}.source_publish_date DESC, COALESCE(${alias}.announcement_id, ${alias}.supervision_id) DESC, ${alias}.sequence_no ASC, ${alias}.id ASC`;
}

function getProductSelectSql(alias = 'up') {
  return `
    ${alias}.*,
    ${alias}.province_display,
    ${alias}.source_publish_date,
    ${alias}.source_title,
    ${alias}.company_id,
    CASE
      WHEN ${alias}.announcement_id IS NOT NULL THEN 'announcement'
      WHEN ${alias}.supervision_id IS NOT NULL THEN 'supervision'
      ELSE 'unknown'
    END AS source_type
  `;
}

function buildPathExistsSql(paths = [], params, productAlias = 'up') {
  const clauses = paths.map((path) => {
    const nestedConditions = [`utr.unqualified_product_id = ${productAlias}.id`];
    Object.entries(path).forEach(([dimensionKey, expectedValue]) => {
      const columnName = TREE_DIMENSION_COLUMN_MAP[dimensionKey];
      if (!columnName) {
        return;
      }
      nestedConditions.push(`utr.${columnName} = ?`);
      params.push(expectedValue);
    });

    return `
      EXISTS (
        SELECT 1
        FROM unqualified_product_tree_rollups utr
        WHERE ${nestedConditions.join(' AND ')}
      )
    `;
  }).filter(Boolean);

  return clauses.length ? `(${clauses.join(' OR ')})` : '0 = 1';
}

function getTreeDimensionValue(row, dimensionKey) {
  if (dimensionKey === 'source') {
    return normalizeOptionalText(row.value);
  }
  if (dimensionKey === 'year') {
    return normalizeOptionalText(row.value);
  }
  return normalizeOptionalText(row.value);
}

function getTreeDimensionLabel(row, dimensionKey) {
  if (dimensionKey === 'source') {
    return normalizeOptionalText(row.label) || '未命名来源';
  }
  if (dimensionKey === 'year') {
    const value = normalizeOptionalText(row.value);
    return value && value !== '未标注年份' ? `${value}年` : (value || '未标注年份');
  }
  return normalizeOptionalText(row.label || row.value);
}

function buildTreeNodeResponse(row, dimensions, parentPath = {}, parentLabels = {}, level = 1) {
  const dimensionKey = dimensions[level - 1];
  const value = getTreeDimensionValue(row, dimensionKey);
  const label = getTreeDimensionLabel(row, dimensionKey);
  const path = {
    ...parentPath,
    [dimensionKey]: value
  };
  const pathLabels = {
    ...parentLabels,
    [dimensionKey]: label
  };

  return {
    key: buildTreeNodeKey(dimensions, path, level),
    label,
    count: Number(row.count || 0),
    level,
    dimension: dimensionKey,
    value,
    path,
    path_labels: pathLabels,
    source_label: pathLabels.source || '',
    source_title: normalizeOptionalText(row.source_title),
    source_publish_date: row.source_publish_date || null,
    is_leaf: level >= dimensions.length
  };
}

async function loadTreeNodesByPath(filters = {}, dimensions = DEFAULT_TREE_DIMENSIONS, parentPath = {}, parentLabels = {}) {
  const normalizedParentPath = normalizeTreePath(parentPath);
  const parentDepth = dimensions.filter((dimensionKey) => Boolean(normalizedParentPath[dimensionKey])).length;
  const nextDimension = dimensions[parentDepth];

  if (!nextDimension) {
    return [];
  }

  const { whereClause, params } = buildBaseFilterState(filters);
  const queryParams = [...params];
  const parentConditions = [];
  Object.entries(normalizedParentPath).forEach(([dimensionKey, expectedValue]) => {
    const columnName = TREE_DIMENSION_COLUMN_MAP[dimensionKey];
    if (!columnName) {
      return;
    }
    parentConditions.push(`utr.${columnName} = ?`);
    queryParams.push(expectedValue);
  });

  const valueExpr = nextDimension === 'source'
    ? 'utr.source_key'
    : (nextDimension === 'year' ? 'utr.year_value' : `utr.${TREE_DIMENSION_COLUMN_MAP[nextDimension]}`);
  const labelExpr = nextDimension === 'source'
    ? 'MAX(utr.source_label)'
    : (nextDimension === 'year' ? 'MAX(utr.year_value)' : `MAX(utr.${TREE_DIMENSION_COLUMN_MAP[nextDimension]})`);
  const [rows] = await pool.query(
    `
      SELECT
        ${valueExpr} AS value,
        ${labelExpr} AS label,
        COUNT(DISTINCT up.id) AS count,
        MAX(utr.source_title) AS source_title,
        MAX(utr.source_publish_date) AS source_publish_date
      FROM unqualified_product_tree_rollups utr
      INNER JOIN unqualified_products up ON up.id = utr.unqualified_product_id
      WHERE ${whereClause}
        ${parentConditions.length ? `AND ${parentConditions.join(' AND ')}` : ''}
      GROUP BY value
      ORDER BY count DESC, label ASC
    `,
    queryParams
  );

  const normalizedParentLabels = dimensions
    .slice(0, parentDepth)
    .reduce((acc, dimensionKey) => {
      const rawLabel = normalizeOptionalText(parentLabels[dimensionKey]);
      const rawValue = normalizedParentPath[dimensionKey];
      if (!rawValue) {
        return acc;
      }
      acc[dimensionKey] = rawLabel || (dimensionKey === 'year' && rawValue !== '未标注年份' ? `${rawValue}年` : rawValue);
      return acc;
    }, {});

  return (rows || []).map((row) => buildTreeNodeResponse(row, dimensions, normalizedParentPath, normalizedParentLabels, parentDepth + 1));
}

async function loadTreeSummary(filters = {}) {
  const { whereClause, params } = buildBaseFilterState(filters);
  const [summaryRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS matched_count,
        COUNT(DISTINCT up.source_key) AS source_count,
        COUNT(DISTINCT up.manufacturer_province) AS province_count
      FROM unqualified_products up
      WHERE ${whereClause}
    `,
    params
  );

  return summaryRows[0] || {};
}

function createTreeNode({ level, key, label, path, pathLabels, dimension, value, extra = {} }) {
  return {
    key,
    label,
    count: 0,
    level,
    dimension,
    value,
    children: [],
    path,
    path_labels: pathLabels,
    source_label: pathLabels?.source || '',
    ...extra
  };
}

function parseSourceCompositeValue(value) {
  const [sourceType, rawSourceId] = String(value || '').split(':');
  return {
    sourceType: normalizeOptionalText(sourceType),
    sourceId: Number.parseInt(rawSourceId, 10) || null
  };
}

function buildRowDimensionValues(row) {
  const sourceValue = `${row.source_type}:${row.source_id || 0}`;
  const provinceValue = normalizeOptionalText(row.province_display) || '未标注省份';
  const manufacturerProvince = normalizeOptionalText(row.manufacturer_province) || provinceValue;
  const manufacturerCity = normalizeOptionalText(row.manufacturer_city) || '未标注城市';
  const sampledProvince = normalizeOptionalText(row.sampled_province) || '未标注省份';
  const sampledCity = normalizeOptionalText(row.sampled_city) || '未标注城市';
  const productCategories = splitJoinedValues(row.product_categories_joined, row.product_category || '其他');
  const issueItems = splitJoinedValues(row.issue_items_joined, row.unqualified_items ? '' : '未拆分项目');
  const sourceYear = Number.parseInt(row.source_year, 10);
  const yearValue = Number.isInteger(sourceYear) && sourceYear > 0 ? String(sourceYear) : '未标注年份';

  return {
    source: [{ value: sourceValue, label: normalizeOptionalText(row.source_no) || '未命名来源' }],
    province: [{ value: provinceValue, label: provinceValue }],
    manufacturer_province: [{ value: manufacturerProvince, label: manufacturerProvince }],
    manufacturer_city: [{ value: manufacturerCity, label: manufacturerCity }],
    sampled_province: [{ value: sampledProvince, label: sampledProvince }],
    sampled_city: [{ value: sampledCity, label: sampledCity }],
    product_category: (productCategories.length ? productCategories : ['其他']).map((value) => ({ value, label: value })),
    issue_item: (issueItems.length ? issueItems : ['未拆分项目']).map((value) => ({ value, label: value })),
    year: [{ value: yearValue, label: yearValue === '未标注年份' ? yearValue : `${yearValue}年` }]
  };
}

function buildTreeNodeKey(dimensions, path, level) {
  return dimensions
    .slice(0, level)
    .map((dimensionKey) => `${dimensionKey}:${path[dimensionKey]}`)
    .join('|');
}

function insertRowIntoTree(children, childMap, row, dimensions, level = 0, parentPath = {}, parentLabels = {}) {
  if (level >= dimensions.length) {
    return;
  }

  const dimensionKey = dimensions[level];
  const dimensionValues = row.__dimension_values?.[dimensionKey] || [];

  dimensionValues.forEach((dimensionValue) => {
    const nextPath = {
      ...parentPath,
      [dimensionKey]: dimensionValue.value
    };
    const nextLabels = {
      ...parentLabels,
      [dimensionKey]: dimensionValue.label
    };
    const nodeKey = buildTreeNodeKey(dimensions, nextPath, level + 1);
    let node = childMap.get(nodeKey);

    if (!node) {
      node = createTreeNode({
        level: level + 1,
        key: nodeKey,
        label: dimensionValue.label,
        dimension: dimensionKey,
        value: dimensionValue.value,
        path: nextPath,
        pathLabels: nextLabels,
        extra: {
          source_title: row.source_title || '',
          source_publish_date: row.source_publish_date || null
        }
      });
      node.__idSet = new Set();
      node.__childMap = new Map();
      childMap.set(nodeKey, node);
      children.push(node);
    }

    node.__idSet.add(row.id);
    if (!node.source_title && row.source_title) {
      node.source_title = row.source_title;
    }
    if (!node.source_publish_date && row.source_publish_date) {
      node.source_publish_date = row.source_publish_date;
    }

    insertRowIntoTree(node.children, node.__childMap, row, dimensions, level + 1, nextPath, nextLabels);
  });
}

function finalizeTreeNodes(nodes = []) {
  return nodes.map((node) => {
    const children = finalizeTreeNodes(node.children || []);
    return {
      key: node.key,
      label: node.label,
      count: Number(node.__idSet?.size || 0),
      level: node.level,
      dimension: node.dimension,
      value: node.value,
      path: node.path,
      path_labels: node.path_labels,
      source_label: node.source_label,
      source_title: node.source_title || '',
      source_publish_date: node.source_publish_date || null,
      children
    };
  });
}

function buildConfiguredTree(rows = [], dimensions = DEFAULT_TREE_DIMENSIONS) {
  const rootNodes = [];
  const rootMap = new Map();

  rows.forEach((row) => {
    row.__dimension_values = buildRowDimensionValues(row);
    insertRowIntoTree(rootNodes, rootMap, row, dimensions, 0, {}, {});
  });

  return finalizeTreeNodes(rootNodes);
}

function rowMatchesTreePath(row, path = {}) {
  const dimensionValues = row.__dimension_values || buildRowDimensionValues(row);

  return Object.entries(path).every(([dimensionKey, expectedValue]) => {
    return (dimensionValues[dimensionKey] || []).some((item) => item.value === expectedValue);
  });
}

async function getUnqualifiedProductBaseRows(filters = {}) {
  const selectedIssueItems = parseListParam(filters.issue_items);
  const joinParams = [];
  const joinClause = buildIssueFilterClause(selectedIssueItems, joinParams);
  const conditions = ['(up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)'];
  const params = [...joinParams];

  appendUnqualifiedProductFilters(conditions, params, filters);

  const whereClause = conditions.join(' AND ');
  const [rows] = await pool.query(
    `
      SELECT
        up.*,
        ${buildProvinceDisplayExpr('up')} AS province_display,
        ${buildSourceDateExpr('a', 's')} AS source_publish_date,
        YEAR(${buildSourceDateExpr('a', 's')}) AS source_year,
        ${buildSourceTitleExpr('a', 's', 'up')} AS source_title,
        ${buildSourceUrlExpr('a', 's')} AS source_detail_url,
        ${buildCompanyIdExpr('up')} AS company_id,
        ${buildSourceTypeExpr('up')} AS source_type,
        ${buildSourceIdExpr('up')} AS source_id,
        ${buildSourceNumberExpr('a', 's', 'up')} AS source_no,
        a.announcement_no,
        upii_agg.issue_items_joined,
        upci_agg.product_categories_joined
      FROM unqualified_products up
      LEFT JOIN announcements a ON up.announcement_id = a.id
      LEFT JOIN supervisions s ON up.supervision_id = s.id
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
      ${joinClause}
      WHERE ${whereClause}
      ORDER BY ${buildSourceDateExpr('a', 's')} DESC, COALESCE(up.announcement_id, up.supervision_id) DESC, up.sequence_no ASC, up.id ASC
    `,
    params
  );

  return rows;
}

async function loadConfiguredTreeBySelectedPaths(filters = {}, dimensions = DEFAULT_TREE_DIMENSIONS, selectedPaths = []) {
  const normalizedPaths = compactTreePaths(selectedPaths);
  if (!normalizedPaths.length) {
    return [];
  }

  const { whereClause, params } = buildBaseFilterState(filters);
  const queryParams = [...params];
  const pathSql = buildPathExistsSql(normalizedPaths, queryParams, 'up');
  const [rows] = await pool.query(
    `
      SELECT
        up.id,
        up.source_title,
        up.source_publish_date,
        up.source_year,
        up.source_no,
        up.province_display,
        up.manufacturer_province,
        up.manufacturer_city,
        up.sampled_province,
        up.sampled_city,
        up.product_category,
        up.unqualified_items,
        ${buildSourceTypeExpr('up')} AS source_type,
        ${buildSourceIdExpr('up')} AS source_id,
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
      WHERE ${whereClause}
        AND ${pathSql}
      ORDER BY ${getProductOrderClause('up')}
    `,
    queryParams
  );

  return buildConfiguredTree(rows, dimensions);
}

function findConfiguredTreeNode(nodes = [], dimensions = DEFAULT_TREE_DIMENSIONS, targetPath = {}) {
  const normalizedPath = normalizeTreePath(targetPath);
  let currentNodes = nodes;
  let matched = null;

  for (const dimensionKey of dimensions) {
    const expectedValue = normalizedPath[dimensionKey];
    if (!expectedValue) {
      break;
    }
    matched = (currentNodes || []).find((node) => node?.path?.[dimensionKey] === expectedValue) || null;
    if (!matched) {
      return null;
    }
    currentNodes = matched.children || [];
  }

  return matched;
}

function collectConfiguredTreeSubtree(node, result = []) {
  if (!node) {
    return result;
  }

  result.push({
    ...node,
    is_leaf: !(node.children && node.children.length)
  });

  (node.children || []).forEach((child) => {
    collectConfiguredTreeSubtree(child, result);
  });

  return result;
}

function sortTreeNodesByPath(nodes = [], dimensions = DEFAULT_TREE_DIMENSIONS) {
  return [...nodes].sort((left, right) => {
    for (const dimensionKey of dimensions) {
      const leftValue = String(left.path?.[dimensionKey] ?? left.path_labels?.[dimensionKey] ?? '');
      const rightValue = String(right.path?.[dimensionKey] ?? right.path_labels?.[dimensionKey] ?? '');
      if (leftValue !== rightValue) {
        return leftValue.localeCompare(rightValue, 'zh-CN', { numeric: true });
      }
    }
    return (Number(left.level) || 0) - (Number(right.level) || 0);
  });
}

async function loadCheckedTreeNodes(filters = {}, dimensions = DEFAULT_TREE_DIMENSIONS, selectedPaths = []) {
  const normalizedPaths = compactTreePaths(selectedPaths);
  if (!normalizedPaths.length) {
    return [];
  }

  const configuredTree = await loadConfiguredTreeBySelectedPaths(filters, dimensions, normalizedPaths);
  const nodeMap = new Map();

  normalizedPaths.forEach((path) => {
    const matched = findConfiguredTreeNode(configuredTree, dimensions, path);
    if (!matched) {
      return;
    }
    collectConfiguredTreeSubtree(matched).forEach((node) => {
      nodeMap.set(node.key, node);
    });
  });

  return sortTreeNodesByPath([...nodeMap.values()], dimensions);
}

ensureUnqualifiedProductsReady().catch((error) => {
  console.error('初始化不合格产品数据失败:', error);
});

router.get('/stats/overview', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const [rows] = await pool.query(`
      SELECT
        COUNT(*) AS loaded_count,
        COUNT(*) AS total_batches,
        COUNT(DISTINCT ${buildSourceUniqueExpr('unqualified_products')}) AS source_count,
        COUNT(DISTINCT CASE WHEN announcement_type = 'sampling' THEN announcement_id END) AS announcement_count,
        COUNT(DISTINCT CASE WHEN announcement_type = 'flight_inspection' THEN supervision_id END) AS supervision_count,
        COUNT(DISTINCT sample_unit_name) AS sample_unit_count,
        COUNT(DISTINCT inspection_institution) AS institution_count,
        COUNT(DISTINCT company_id) AS company_count
      FROM unqualified_products
      WHERE announcement_id IS NOT NULL OR supervision_id IS NOT NULL
    `);

    const [issueRows] = await pool.query(`
      SELECT COUNT(DISTINCT issue_item) AS issue_item_count
      FROM unqualified_product_issue_items
    `);

    res.json({
      success: true,
      data: {
        loaded_count: Number(rows[0]?.loaded_count || 0),
        total_batches: Number(rows[0]?.total_batches || 0),
        source_count: Number(rows[0]?.source_count || 0),
        announcement_count: Number(rows[0]?.announcement_count || 0),
        supervision_count: Number(rows[0]?.supervision_count || 0),
        company_count: Number(rows[0]?.company_count || 0),
        sample_unit_count: Number(rows[0]?.sample_unit_count || 0),
        institution_count: Number(rows[0]?.institution_count || 0),
        issue_item_count: Number(issueRows[0]?.issue_item_count || 0)
      }
    });
  } catch (error) {
    console.error('获取不合格产品统计失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品统计失败' });
  }
});

router.get('/filter-options', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();
    const [productCategories, issueItems, productTypeRows, announcementTypeRows, provinceRows, manufacturerProvinceRows, sampledProvinceRows, yearRows] = await Promise.all([
      getUnqualifiedProductCategoryOptions(pool, 300),
      getUnqualifiedProductIssueOptions(pool, 300),
      pool.query(`
        SELECT DISTINCT product_type
        FROM unqualified_products
        WHERE product_type IS NOT NULL AND TRIM(product_type) != ''
        ORDER BY product_type ASC
      `),
      pool.query(`
        SELECT DISTINCT announcement_type
        FROM unqualified_products
        WHERE announcement_type IS NOT NULL AND TRIM(announcement_type) != ''
        ORDER BY announcement_type ASC
      `),
      pool.query(`
        SELECT DISTINCT COALESCE(NULLIF(TRIM(manufacturer_province), ''), NULLIF(TRIM(sampled_province), ''), NULLIF(TRIM(province_display), '')) AS province
        FROM unqualified_products
        WHERE COALESCE(NULLIF(TRIM(manufacturer_province), ''), NULLIF(TRIM(sampled_province), ''), NULLIF(TRIM(province_display), '')) IS NOT NULL
        ORDER BY province ASC
      `),
      pool.query(`
        SELECT DISTINCT manufacturer_province AS province
        FROM unqualified_products
        WHERE manufacturer_province IS NOT NULL
          AND TRIM(manufacturer_province) != ''
        ORDER BY province ASC
      `),
      pool.query(`
        SELECT DISTINCT sampled_province AS province
        FROM unqualified_products
        WHERE sampled_province IS NOT NULL
          AND TRIM(sampled_province) != ''
        ORDER BY province ASC
      `),
      pool.query(`
        SELECT DISTINCT source_year AS year
        FROM unqualified_products
        WHERE source_year IS NOT NULL
        ORDER BY year DESC
      `)
    ]);
    const productTypes = getProductTypeOptions((productTypeRows[0] || []).map((row) => row.product_type));
    const announcementTypes = getAnnouncementTypeOptions((announcementTypeRows[0] || []).map((row) => row.announcement_type));
    const provinces = buildOptionItems(provinceRows[0] || [], 'province');
    const manufacturerProvinces = buildOptionItems(manufacturerProvinceRows[0] || [], 'province');
    const sampledProvinces = buildOptionItems(sampledProvinceRows[0] || [], 'province');
    const years = (yearRows[0] || [])
      .map((row) => Number(row.year))
      .filter((value) => Number.isInteger(value) && value > 0)
      .map((value) => ({ value: String(value), label: `${value}年` }));

    res.json({
      success: true,
      data: {
        product_categories: productCategories,
        issue_items: issueItems,
        product_types: productTypes,
        announcement_types: announcementTypes,
        provinces,
        manufacturer_provinces: manufacturerProvinces,
        sampled_provinces: sampledProvinces,
        years
      }
    });
  } catch (error) {
    console.error('获取不合格项目筛选项失败:', error);
    res.status(500).json({ success: false, message: '获取不合格项目筛选项失败' });
  }
});

router.get('/tree', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const dimensionOrder = getConfiguredTreeDimensions(req.query.dimension_order);
    const tree = await loadTreeNodesByPath(req.query, dimensionOrder, {});
    const summaryRow = await loadTreeSummary(req.query);

    res.json({
      success: true,
      data: tree,
      dimension_order: dimensionOrder,
      available_dimensions: Object.values(TREE_DIMENSION_DEFS).map((item) => ({
        key: item.key,
        label: item.label
      })),
      summary: {
        matched_count: Number(summaryRow.matched_count || 0),
        loaded_count: Number(summaryRow.matched_count || 0),
        source_count: Number(summaryRow.source_count || 0),
        province_count: Number(summaryRow.province_count || 0),
        root_count: tree.length
      }
    });
  } catch (error) {
    console.error('获取不合格产品树失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品树失败' });
  }
});

router.get('/tree-children', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const dimensionOrder = getConfiguredTreeDimensions(req.query.dimension_order);
    const parentPath = parseJsonObjectParam(req.query.parent_path);
    const parentLabels = parseJsonObjectParam(req.query.parent_labels);
    const nodes = await loadTreeNodesByPath(req.query, dimensionOrder, parentPath, parentLabels);

    res.json({
      success: true,
      data: nodes,
      dimension_order: dimensionOrder,
      parent_path: normalizeTreePath(parentPath),
      parent_labels: parentLabels
    });
  } catch (error) {
    console.error('获取不合格产品树子节点失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品树子节点失败' });
  }
});

router.post('/checked-tree-nodes', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const input = { ...req.query, ...req.body };
    const dimensionOrder = getConfiguredTreeDimensions(input.dimension_order);
    const selectedPaths = compactTreePaths(parseTreePaths(input));
    if (!selectedPaths.length) {
      return res.json({
        success: true,
        data: [],
        dimension_order: dimensionOrder,
        selected_paths: []
      });
    }

    const nodes = await loadCheckedTreeNodes(input, dimensionOrder, selectedPaths);
    res.json({
      success: true,
      data: nodes,
      dimension_order: dimensionOrder,
      selected_paths: selectedPaths
    });
  } catch (error) {
    console.error('获取全量勾选树节点失败:', error);
    res.status(500).json({ success: false, message: '获取全量勾选树节点失败' });
  }
});

async function handleUnqualifiedNodeDetails(req, res) {
  try {
    await ensureUnqualifiedProductsReady();

    const input = { ...req.query, ...req.body };
    const page = input.page || 1;
    const limit = input.limit || 10;
    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = clampPageSize(limit);
    const offset = (currentPage - 1) * pageSize;

    const dimensionOrder = getConfiguredTreeDimensions(input.dimension_order);
    const selectedPaths = compactTreePaths(parseTreePaths(input));
    if (!selectedPaths.length) {
      return res.json({
        success: true,
        data: [],
        dimension_order: dimensionOrder,
        pagination: {
          total: 0,
          page: currentPage,
          limit: pageSize,
          pages: 0
        },
        selected_paths: []
      });
    }

    const { whereClause, params } = buildBaseFilterState(input);
    const countParams = [...params];
    const pathSql = buildPathExistsSql(selectedPaths, countParams, 'up');
    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM unqualified_products up
        WHERE ${whereClause}
          AND ${pathSql}
      `,
      countParams
    );
    const total = Number(countRows[0]?.total || 0);
    const dataParams = [...params];
    const dataPathSql = buildPathExistsSql(selectedPaths, dataParams, 'up');
    const [pageRows] = await pool.query(
      `
        SELECT
          ${getProductSelectSql('up')}
        FROM unqualified_products up
        WHERE ${whereClause}
          AND ${dataPathSql}
        ORDER BY ${getProductOrderClause('up')}
        LIMIT ? OFFSET ?
      `,
      [...dataParams, pageSize, offset]
    );

    res.json({
      success: true,
      data: pageRows.map((row) => ({
        ...row,
        product_type_label: getProductTypeLabel(row.product_type),
        announcement_type_label: getAnnouncementTypeLabel(row.announcement_type)
      })),
      dimension_order: dimensionOrder,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(total / pageSize)
      },
      selected_paths: selectedPaths
    });
  } catch (error) {
    console.error('获取树节点详情失败:', error);
    res.status(500).json({ success: false, message: '获取树节点详情失败' });
  }
}

router.get('/node-details', handleUnqualifiedNodeDetails);
router.post('/node-details', handleUnqualifiedNodeDetails);

router.get('/:id', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const { id } = req.params;
    const [rows] = await pool.query(
      `
        SELECT
          ${getProductSelectSql('up')},
          a.announcement_no,
          s.supervision_unit,
          s.level AS supervision_level
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        WHERE up.id = ?
        LIMIT 1
      `,
      [id]
    );

    const detail = rows[0] || null;
    if (!detail) {
      return res.status(404).json({ success: false, message: '问题产品不存在' });
    }

    const [[issueRows], [categoryRows]] = await Promise.all([
      pool.query(
        `
          SELECT issue_item
          FROM unqualified_product_issue_items
          WHERE unqualified_product_id = ?
          ORDER BY issue_item ASC
        `,
        [id]
      ),
      pool.query(
        `
          SELECT product_category
          FROM unqualified_product_category_items
          WHERE unqualified_product_id = ?
          ORDER BY product_category ASC
        `,
        [id]
      )
    ]);

    res.json({
      success: true,
      data: {
        ...detail,
        product_type_label: getProductTypeLabel(detail.product_type),
        announcement_type_label: getAnnouncementTypeLabel(detail.announcement_type),
        issue_items: (issueRows || []).map((row) => row.issue_item).filter(Boolean),
        product_categories: (categoryRows || []).map((row) => row.product_category).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('获取不合格产品详情失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品详情失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    await ensureUnqualifiedProductsReady();

    const {
      keyword = '',
      company_keyword = '',
      source_keyword = '',
      unqualified_item = '',
      issue_items = '',
      product_type = '',
      announcement_type = '',
      province = '',
      manufacturer_province = '',
      sampled_province = '',
      product_category = '',
      year = '',
      year_start = '',
      year_end = '',
      announcement_id = '',
      supervision_id = '',
      page = 1,
      limit = 10
    } = req.query;

    const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const pageSize = clampPageSize(limit);
    const offset = (currentPage - 1) * pageSize;

    const conditions = ['(up.announcement_id IS NOT NULL OR up.supervision_id IS NOT NULL)'];
    const params = [];

    appendUnqualifiedProductFilters(conditions, params, {
      keyword,
      company_keyword,
      source_keyword,
      unqualified_item,
      product_type,
      announcement_type,
      province,
      manufacturer_province,
      sampled_province,
      product_category,
      year,
      year_start,
      year_end,
      announcement_id,
      supervision_id
    });

    const whereClause = conditions.join(' AND ');

    const [rows] = await pool.query(
      `
        SELECT
          ${getProductSelectSql('up')}
        FROM unqualified_products up
        WHERE ${whereClause}
        ORDER BY ${getProductOrderClause('up')}
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM unqualified_products up
        WHERE ${whereClause}
      `,
      params
    );

    const [summaryRows] = await pool.query(
      `
        SELECT
          COUNT(*) AS loaded_count,
          COUNT(*) AS total_batches,
          COUNT(DISTINCT up.source_key) AS source_count,
          COUNT(DISTINCT up.manufacturer_province) AS province_count,
          CASE
            WHEN COUNT(DISTINCT up.source_key) = 1 THEN MAX(up.source_title)
            ELSE '全部问题通告'
          END AS batch_title
        FROM unqualified_products up
        WHERE ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        product_type_label: getProductTypeLabel(row.product_type),
        announcement_type_label: getAnnouncementTypeLabel(row.announcement_type)
      })),
      summary: {
        batch_title: summaryRows[0]?.batch_title || '',
        loaded_count: Number(summaryRows[0]?.loaded_count || 0),
        total_batches: Number(summaryRows[0]?.total_batches || 0),
        source_count: Number(summaryRows[0]?.source_count || 0),
        matched_count: total,
        current_page_count: rows.length,
        province_count: Number(summaryRows[0]?.province_count || 0)
      },
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(total / pageSize)
      },
      filters_applied: {
        keyword: normalizeOptionalText(keyword),
        company_keyword: normalizeOptionalText(company_keyword),
        source_keyword: normalizeOptionalText(source_keyword),
        unqualified_item: normalizeOptionalText(unqualified_item),
        issue_items: parseListParam(issue_items),
        product_type: normalizeOptionalText(product_type),
        announcement_type: normalizeOptionalText(announcement_type),
        province: normalizeOptionalText(province),
        manufacturer_province: normalizeOptionalText(manufacturer_province),
        sampled_province: normalizeOptionalText(sampled_province),
        product_category: normalizeOptionalText(product_category),
        year: normalizeOptionalText(year),
        year_start: normalizeOptionalText(year_start),
        year_end: normalizeOptionalText(year_end),
        announcement_id: normalizeOptionalText(announcement_id),
        supervision_id: normalizeOptionalText(supervision_id)
      }
    });
  } catch (error) {
    console.error('获取不合格产品列表失败:', error);
    res.status(500).json({ success: false, message: '获取不合格产品列表失败' });
  }
});

module.exports = router;
