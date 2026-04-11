const express = require('express');
const router = express.Router();
const pool = require('../config/database');

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

function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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
      const parsed = JSON.parse(text);
      return parseListParam(parsed);
    } catch (error) {
      // ignore json parse error and fallback below
    }
  }

  return text
    .split('|')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function extractProvince(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '未标注';
  }

  const match = normalized.match(/(北京市|天津市|上海市|重庆市|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区|[^\s，,；;（）()]+省|[^\s，,；;（）()]+市)/);
  return match ? match[1] : '未标注';
}

function deriveProductCategory(productName) {
  const text = normalizeText(productName);
  if (!text) {
    return '其他';
  }

  const rules = [
    ['防晒类', /防晒|隔离/],
    ['面膜贴膜类', /面膜|泥膜|贴$|贴膜|冻龄贴|冰膜/],
    ['洗护发类', /洗发|护发|护发素|头皮|去屑|清洁膏/],
    ['沐浴清洁类', /沐浴|沐浴露|沐浴液|润肤露/],
    ['染发类', /染发/],
    ['指甲彩妆类', /指甲油|卸甲|美甲/],
    ['牙膏口腔类', /牙膏/],
    ['祛痘护理类', /祛痘|精华液|精华水|平衡液/],
    ['彩妆底妆类', /粉底|BB霜|素颜霜|修颜|提亮|晚霜/],
    ['婴童护理类', /婴儿|宝宝|紫草油|润肤油/],
    ['精华乳霜类', /乳|霜|膏|液/]
  ];

  const matchedRule = rules.find(([, pattern]) => pattern.test(text));
  return matchedRule ? matchedRule[0] : '其他';
}

function deriveIssueCategory(unqualifiedItems, inspectionResult, requirement) {
  const text = normalizeText([unqualifiedItems, inspectionResult, requirement].filter(Boolean).join(' '));

  if (!text) {
    return '其他问题';
  }

  if (/成分比对|标签/.test(text)) {
    return '成分比对';
  }

  if (/菌落总数|霉菌|酵母菌/.test(text)) {
    return '微生物指标';
  }

  if (/甲硝唑|氯霉素|氯倍他索|倍他米松|地塞米松|睾酮|特比萘芬|非那西丁|反式-2-庚烯醛|新铃兰醛|三氯生|丙烯酰胺|萘甲唑啉|二氯甲烷|1,2-二氯乙烷|苯/.test(text)) {
    return '禁用/限用物质';
  }

  if (/pH值|酸碱度/.test(text)) {
    return '理化指标';
  }

  return '其他问题';
}

function buildAnnouncementLabel(record) {
  return normalizeText([record.announcement_no, record.announcement_title].filter(Boolean).join(' '))
    || `通告#${record.announcement_id}`;
}

function buildEnrichedRecord(record) {
  const announcementLabel = buildAnnouncementLabel(record);
  const productCategory = deriveProductCategory(record.product_name);
  const manufacturerProvince = extractProvince(record.company_addresses || record.product_region);
  const sampledProvince = extractProvince(record.sample_unit_address);
  const issueCategory = deriveIssueCategory(record.unqualified_items, record.inspection_result, record.requirement);
  const productRegion = normalizeText(record.product_region) || '未标注';
  const inspectionInstitution = normalizeText(record.inspection_institution) || '未标注';
  const counterfeitFlag = Number(record.is_counterfeit) === 1;

  return {
    ...record,
    announcement_label: announcementLabel,
    product_category: productCategory,
    product_region: productRegion,
    manufacturer_province: manufacturerProvince,
    sampled_province: sampledProvince,
    inspection_institution: inspectionInstitution,
    issue_category: issueCategory,
    is_counterfeit_label: counterfeitFlag ? '假冒产品' : '非假冒',
    counterfeit_flag: counterfeitFlag,
    product_name: normalizeText(record.product_name),
    batch_no: normalizeText(record.batch_no) || '-',
    publish_date: record.publish_date || null
  };
}

function matchesMultiFilter(recordValue, selectedValues) {
  if (!selectedValues || selectedValues.length === 0) {
    return true;
  }

  return selectedValues.includes(String(recordValue));
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

function buildDistinctOptions(records, field, labelBuilder = null) {
  return Array.from(new Set(records.map((item) => item[field]).filter(Boolean)))
    .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
    .map((value) => ({
      value: String(value),
      label: labelBuilder ? labelBuilder(value) : String(value)
    }));
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

router.get('/pivot', async (req, res) => {
  try {
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
    const keyword = normalizeText(req.query.keyword);
    const counterfeitOnly = String(req.query.counterfeit_only || '') === 'true';

    const [rows] = await pool.query(`
      SELECT
        apd.id,
        apd.announcement_id,
        apd.sequence_no,
        apd.product_name,
        apd.company_names,
        apd.company_addresses,
        apd.sample_unit_name,
        apd.sample_unit_address,
        apd.batch_no,
        apd.product_region,
        apd.inspection_institution,
        apd.unqualified_items,
        apd.inspection_result,
        apd.requirement,
        apd.remarks,
        apd.is_counterfeit,
        a.title AS announcement_title,
        a.announcement_no,
        a.publish_date
      FROM announcement_product_details apd
      LEFT JOIN announcements a ON a.id = apd.announcement_id
      ORDER BY a.publish_date DESC, apd.announcement_id DESC, apd.sequence_no ASC, apd.id ASC
    `);

    const enrichedRecords = rows.map(buildEnrichedRecord);

    const options = {
      announcements: enrichedRecords
        .reduce((map, item) => {
          if (!map.has(item.announcement_id)) {
            map.set(item.announcement_id, {
              value: String(item.announcement_id),
              label: item.announcement_label
            });
          }
          return map;
        }, new Map()),
      product_categories: buildDistinctOptions(enrichedRecords, 'product_category'),
      product_regions: buildDistinctOptions(enrichedRecords, 'product_region'),
      manufacturer_provinces: buildDistinctOptions(enrichedRecords, 'manufacturer_province'),
      sampled_provinces: buildDistinctOptions(enrichedRecords, 'sampled_province'),
      inspection_institutions: buildDistinctOptions(enrichedRecords, 'inspection_institution'),
      issue_categories: buildDistinctOptions(enrichedRecords, 'issue_category')
    };

    options.announcements = Array.from(options.announcements.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

    const filteredRecords = enrichedRecords.filter((record) => {
      if (!matchesMultiFilter(record.announcement_id, announcementIds)) return false;
      if (!matchesMultiFilter(record.product_category, productCategories)) return false;
      if (!matchesMultiFilter(record.product_region, productRegions)) return false;
      if (!matchesMultiFilter(record.manufacturer_province, manufacturerProvinces)) return false;
      if (!matchesMultiFilter(record.sampled_province, sampledProvinces)) return false;
      if (!matchesMultiFilter(record.inspection_institution, inspectionInstitutions)) return false;
      if (!matchesMultiFilter(record.issue_category, issueCategories)) return false;
      if (counterfeitOnly && !record.counterfeit_flag) return false;

      if (keyword) {
        const combinedText = normalizeText([
          record.announcement_label,
          record.product_name,
          record.product_category,
          record.product_region,
          record.manufacturer_province,
          record.sampled_province,
          record.inspection_institution,
          record.issue_category,
          record.batch_no,
          record.company_names,
          record.sample_unit_name,
          record.unqualified_items
        ].join(' ')).toLowerCase();

        if (!combinedText.includes(keyword.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    const pivot = buildPivot(filteredRecords, rowDimension, colDimension, metric);
    const summary = buildSummary(filteredRecords);
    const insights = buildInsights(filteredRecords);
    const detailRecords = filteredRecords.slice(0, 200).map((record) => ({
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
      sample_unit_name: record.sample_unit_name || '-',
      unqualified_items: record.unqualified_items || '-'
    }));

    res.json({
      success: true,
      data: {
        summary,
        options,
        pivot,
        insights,
        detail_records: detailRecords,
        detail_total: filteredRecords.length,
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
          counterfeit_only: counterfeitOnly,
          keyword,
          row_dimension: rowDimension,
          col_dimension: colDimension,
          metric
        }
      }
    });
  } catch (error) {
    console.error('获取数据透视分析失败:', error);
    res.status(500).json({ success: false, message: '获取数据透视分析失败' });
  }
});

module.exports = router;
