const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { normalizeText } = require('../utils/dataAnalysisHelpers');
const {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions
} = require('../utils/unqualifiedProducts');


const DIMENSION_LABELS = {
  announcement_label: '通告批次',
  product_category: '产品类别',
  product_region: '产品标示地区',
  manufacturer_province: '生产/备案地区',
  sampled_province: '抽样地区',
  inspection_institution: '检验机构',
  issue_category: '问题类型',
  is_counterfeit_label: '假冒标记'
};

const METRIC_LABELS = {
  record_count: '记录数',
  unique_product_count: '产品数',
  batch_count: '通告数',
  counterfeit_count: '假冒数'
};

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
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function clampPageSize(limit, defaultValue = 50, maxValue = 200) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function createMetricCell() {
  return {
    record_count: 0,
    counterfeit_count: 0,
    product_names: new Set(),
    announcement_ids: new Set()
  };
}

function readMetricValue(cell, metric) {
  switch (metric) {
    case 'counterfeit_count':
      return cell.counterfeit_count;
    case 'unique_product_count':
      return cell.product_names.size;
    case 'batch_count':
      return cell.announcement_ids.size;
    case 'record_count':
    default:
      return cell.record_count;
  }
}

function sortLabelsByCount(counterMap) {
  return Array.from(counterMap.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return String(a[0]).localeCompare(String(b[0]), 'zh-CN');
    })
    .map(([label]) => label);
}

function buildPivot(records, rowDimension, colDimension, metric) {
  const rowCounter = new Map();
  const colCounter = new Map();
  const cellMap = new Map();

  records.forEach((record) => {
    const rowKey = record[rowDimension] || '未标注';
    const colKey = record[colDimension] || '未标注';
    const matrixKey = `${rowKey}__@@__${colKey}`;

    rowCounter.set(rowKey, (rowCounter.get(rowKey) || 0) + 1);
    colCounter.set(colKey, (colCounter.get(colKey) || 0) + 1);

    if (!cellMap.has(matrixKey)) {
      cellMap.set(matrixKey, createMetricCell());
    }

    const cell = cellMap.get(matrixKey);
    cell.record_count += 1;
    cell.counterfeit_count += record.counterfeit_flag ? 1 : 0;
    cell.product_names.add(record.product_name || `detail-${record.id}`);
    cell.announcement_ids.add(record.announcement_id);
  });

  const rowLabels = sortLabelsByCount(rowCounter);
  const colLabels = sortLabelsByCount(colCounter);

  const columns = colLabels.map((label) => {
    const totalCell = createMetricCell();
    rowLabels.forEach((rowKey) => {
      const cell = cellMap.get(`${rowKey}__@@__${label}`);
      if (cell) {
        totalCell.record_count += cell.record_count;
        totalCell.counterfeit_count += cell.counterfeit_count;
        cell.product_names.forEach((item) => totalCell.product_names.add(item));
        cell.announcement_ids.forEach((item) => totalCell.announcement_ids.add(item));
      }
    });

    return {
      key: String(label),
      label: String(label),
      total: readMetricValue(totalCell, metric)
    };
  });

  const rows = rowLabels.map((rowKey) => {
    const cellsMap = {};
    let total = 0;

    colLabels.forEach((colKey) => {
      const cell = cellMap.get(`${rowKey}__@@__${colKey}`) || createMetricCell();
      const value = readMetricValue(cell, metric);
      cellsMap[String(colKey)] = value;
      total += value;
    });

    return {
      row_key: String(rowKey),
      row_label: String(rowKey),
      total,
      cells_map: cellsMap
    };
  });

  return {
    row_dimension: rowDimension,
    row_dimension_label: DIMENSION_LABELS[rowDimension],
    col_dimension: colDimension,
    col_dimension_label: DIMENSION_LABELS[colDimension],
    metric,
    metric_label: METRIC_LABELS[metric],
    columns,
    rows
  };
}

function buildSummary(records) {
  return {
    total_records: records.length,
    total_batches: new Set(records.map((item) => item.announcement_id)).size,
    total_categories: new Set(records.map((item) => item.product_category)).size,
    total_product_regions: new Set(records.map((item) => item.product_region)).size,
    total_sampled_provinces: new Set(records.map((item) => item.sampled_province)).size,
    counterfeit_count: records.filter((item) => item.counterfeit_flag).length
  };
}

function topCounter(records, field, limit = 3) {
  const counter = new Map();
  records.forEach((record) => {
    const key = record[field] || '未标注';
    counter.set(key, (counter.get(key) || 0) + 1);
  });

  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function buildInsights(records) {
  if (!records || records.length === 0) {
    return [];
  }

  const total = records.length;
  const topCategory = topCounter(records, 'product_category', 1)[0];
  const topProductRegion = topCounter(records, 'product_region', 1)[0];
  const topSampledProvince = topCounter(records, 'sampled_province', 1)[0];
  const topIssueCategory = topCounter(records, 'issue_category', 1)[0];
  const counterfeitCount = records.filter((item) => item.counterfeit_flag).length;

  const insights = [];

  if (topCategory) {
    insights.push({
      title: '重点产品类别',
      content: `${topCategory[0]}共有 ${topCategory[1]} 条，占当前筛选结果 ${(topCategory[1] / total * 100).toFixed(1)}%`
    });
  }

  if (topProductRegion) {
    insights.push({
      title: '重点产品标示地区',
      content: `${topProductRegion[0]}共有 ${topProductRegion[1]} 条，是当前最集中的产品来源地区`
    });
  }

  if (topSampledProvince) {
    insights.push({
      title: '重点抽样地区',
      content: `${topSampledProvince[0]}共有 ${topSampledProvince[1]} 条，可作为区域风险观察重点`
    });
  }

  if (topIssueCategory) {
    insights.push({
      title: '高频问题类型',
      content: `${topIssueCategory[0]}出现 ${topIssueCategory[1]} 条，可直接用于分析报告的问题分类段落`
    });
  }

  if (counterfeitCount > 0) {
    insights.push({
      title: '假冒风险提示',
      content: `当前筛选结果中包含 ${counterfeitCount} 条假冒相关记录，占比 ${(counterfeitCount / total * 100).toFixed(1)}%`
    });
  }

  return insights;
}

function mapDistinctOptions(rows, field) {
  return rows
    .map((row) => row[field])
    .filter(Boolean)
    .map((value) => ({ value: String(value), label: String(value) }));
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

async function ensureAnalyticsReady() {
  await ensureUnqualifiedProductsTable(pool);
}

router.get('/pivot', async (req, res) => {
  try {
    await ensureAnalyticsReady();

    const rowDimension = DIMENSION_LABELS[req.query.row_dimension] ? req.query.row_dimension : 'product_category';
    const colDimension = DIMENSION_LABELS[req.query.col_dimension] ? req.query.col_dimension : 'sampled_province';
    const metric = METRIC_LABELS[req.query.metric] ? req.query.metric : 'record_count';

    const announcementIds = parseListParam(req.query.announcement_ids);
    const productCategories = parseListParam(req.query.product_categories);
    const productRegions = parseListParam(req.query.product_regions);
    const manufacturerProvinces = parseListParam(req.query.manufacturer_provinces);
    const sampledProvinces = parseListParam(req.query.sampled_provinces);
    const inspectionInstitutions = parseListParam(req.query.inspection_institutions);
    const issueCategories = parseListParam(req.query.issue_categories);
    const issueItems = parseListParam(req.query.issue_items);
    const keyword = normalizeText(req.query.keyword);
    const counterfeitOnly = String(req.query.counterfeit_only || '') === 'true';
    const detailPage = Math.max(Number.parseInt(req.query.detail_page, 10) || 1, 1);
    const detailLimit = clampPageSize(req.query.detail_limit, 50, 200);
    const detailOffset = (detailPage - 1) * detailLimit;

    const joinParams = [];
    const joinClause = buildIssueFilterClause(issueItems, joinParams);
    const conditions = ['up.announcement_id IS NOT NULL'];
    const params = [...joinParams];

    if (announcementIds.length) {
      conditions.push(`up.announcement_id IN (${announcementIds.map(() => '?').join(', ')})`);
      params.push(...announcementIds);
    }
    if (productCategories.length) {
      conditions.push(`up.product_category IN (${productCategories.map(() => '?').join(', ')})`);
      params.push(...productCategories);
    }
    if (productRegions.length) {
      conditions.push(`up.product_region IN (${productRegions.map(() => '?').join(', ')})`);
      params.push(...productRegions);
    }
    if (manufacturerProvinces.length) {
      conditions.push(`up.manufacturer_province IN (${manufacturerProvinces.map(() => '?').join(', ')})`);
      params.push(...manufacturerProvinces);
    }
    if (sampledProvinces.length) {
      conditions.push(`up.sampled_province IN (${sampledProvinces.map(() => '?').join(', ')})`);
      params.push(...sampledProvinces);
    }
    if (inspectionInstitutions.length) {
      conditions.push(`up.inspection_institution IN (${inspectionInstitutions.map(() => '?').join(', ')})`);
      params.push(...inspectionInstitutions);
    }
    if (issueCategories.length) {
      conditions.push(`up.issue_category IN (${issueCategories.map(() => '?').join(', ')})`);
      params.push(...issueCategories);
    }
    if (counterfeitOnly) {
      conditions.push('up.is_counterfeit = 1');
    }
    if (keyword) {
      conditions.push(`(
        up.batch_title LIKE ? OR
        up.product_name LIKE ? OR
        up.product_category LIKE ? OR
        up.product_region LIKE ? OR
        up.manufacturer_province LIKE ? OR
        up.sampled_province LIKE ? OR
        up.inspection_institution LIKE ? OR
        up.issue_category LIKE ? OR
        up.batch_no LIKE ? OR
        up.company_names LIKE ? OR
        up.sample_unit_name LIKE ? OR
        up.unqualified_items LIKE ?
      )`);
      const keywordLike = `%${keyword}%`;
      params.push(
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike,
        keywordLike
      );
    }

    const whereClause = conditions.join(' AND ');

    const [optionResults, rows] = await Promise.all([
      Promise.all([
        pool.query(`SELECT DISTINCT announcement_id, batch_title FROM unqualified_products WHERE announcement_id IS NOT NULL ORDER BY announcement_id DESC`),
        getUnqualifiedProductCategoryOptions(pool, 300),
        pool.query(`SELECT DISTINCT product_region FROM unqualified_products WHERE announcement_id IS NOT NULL AND product_region IS NOT NULL ORDER BY product_region ASC`),
        pool.query(`SELECT DISTINCT manufacturer_province FROM unqualified_products WHERE announcement_id IS NOT NULL AND manufacturer_province IS NOT NULL ORDER BY manufacturer_province ASC`),
        pool.query(`SELECT DISTINCT sampled_province FROM unqualified_products WHERE announcement_id IS NOT NULL AND sampled_province IS NOT NULL ORDER BY sampled_province ASC`),
        pool.query(`SELECT DISTINCT inspection_institution FROM unqualified_products WHERE announcement_id IS NOT NULL AND inspection_institution IS NOT NULL ORDER BY inspection_institution ASC`),
        pool.query(`SELECT DISTINCT issue_category FROM unqualified_products WHERE announcement_id IS NOT NULL AND issue_category IS NOT NULL ORDER BY issue_category ASC`),
        getUnqualifiedProductIssueOptions(pool, 300)
      ]),
      pool.query(

        `
          SELECT
            up.id,
            up.announcement_id,
            up.batch_title,
            up.sequence_no,
            up.product_name,
            up.product_category,
            up.batch_no,
            up.product_region,
            up.manufacturer_province,
            up.sampled_province,
            up.inspection_institution,
            up.issue_category,
            up.is_counterfeit,
            up.sample_unit_name,
            up.unqualified_items,
            a.publish_date
          FROM unqualified_products up
          ${joinClause}
          LEFT JOIN announcements a ON a.id = up.announcement_id
          WHERE ${whereClause}
          ORDER BY up.announcement_id DESC, up.sequence_no ASC, up.id ASC
        `,
        params
      )
    ]);

    const [announcementRows, productCategoryOptions, productRegionRows, manufacturerProvinceRows, sampledProvinceRows, inspectionInstitutionRows, issueCategoryRows, issueItemOptions] = optionResults;

    const enrichedRecords = rows[0].map((record) => ({
      ...record,
      announcement_label: normalizeText(record.batch_title) || `通告#${record.announcement_id}`,
      is_counterfeit_label: Number(record.is_counterfeit) === 1 ? '假冒产品' : '非假冒',
      counterfeit_flag: Number(record.is_counterfeit) === 1,
      batch_no: normalizeText(record.batch_no) || '-',
      sample_unit_name: record.sample_unit_name || '-',
      unqualified_items: record.unqualified_items || '-'
    }));

    const options = {
      announcements: announcementRows[0].map((row) => ({
        value: String(row.announcement_id),
        label: row.batch_title
      })),
      product_categories: productCategoryOptions,

      product_regions: mapDistinctOptions(productRegionRows[0], 'product_region'),
      manufacturer_provinces: mapDistinctOptions(manufacturerProvinceRows[0], 'manufacturer_province'),
      sampled_provinces: mapDistinctOptions(sampledProvinceRows[0], 'sampled_province'),
      inspection_institutions: mapDistinctOptions(inspectionInstitutionRows[0], 'inspection_institution'),
      issue_categories: mapDistinctOptions(issueCategoryRows[0], 'issue_category'),
      issue_items: issueItemOptions
    };

    const pivot = buildPivot(enrichedRecords, rowDimension, colDimension, metric);
    const summary = buildSummary(enrichedRecords);
    const insights = buildInsights(enrichedRecords);
    const detailSlice = enrichedRecords.slice(detailOffset, detailOffset + detailLimit);
    const detailRecords = detailSlice.map((record) => ({
      id: record.id,
      announcement_label: record.announcement_label,
      publish_date: record.publish_date,
      product_name: record.product_name,
      product_category: record.product_category,
      batch_no: record.batch_no,
      product_region: record.product_region,
      manufacturer_province: record.manufacturer_province,
      sampled_province: record.sampled_province,
      inspection_institution: record.inspection_institution,
      issue_category: record.issue_category,
      is_counterfeit_label: record.is_counterfeit_label,
      sample_unit_name: record.sample_unit_name,
      unqualified_items: record.unqualified_items
    }));

    res.json({
      success: true,
      data: {
        summary,
        options,
        pivot,
        insights,
        detail_records: detailRecords,
        detail_total: enrichedRecords.length,
        detail_pagination: {
          total: enrichedRecords.length,
          page: detailPage,
          limit: detailLimit,
          pages: Math.ceil(enrichedRecords.length / detailLimit)
        },
        dimensions: DIMENSION_LABELS,
        metrics: METRIC_LABELS,
        filters_applied: {
          announcement_ids: announcementIds,
          product_categories: productCategories,
          product_regions: productRegions,
          manufacturer_provinces: manufacturerProvinces,
          sampled_provinces: sampledProvinces,
          inspection_institutions: inspectionInstitutions,
          issue_categories: issueCategories,
          issue_items: issueItems,
          counterfeit_only: counterfeitOnly,
          keyword,
          row_dimension: rowDimension,
          col_dimension: colDimension,
          metric,
          detail_page: detailPage,
          detail_limit: detailLimit
        }
      }
    });
  } catch (error) {
    console.error('获取数据透视分析失败:', error);
    res.status(500).json({ success: false, message: '获取数据透视分析失败' });
  }
});

module.exports = router;
