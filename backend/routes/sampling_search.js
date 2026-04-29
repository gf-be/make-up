const express = require('express');
const XLSX = require('xlsx');
const pool = require('../config/database');
const {
  getProductTypeLabel,
  getAnnouncementTypeLabel,
  normalizeProductType,
  normalizeAnnouncementType
} = require('../utils/unqualifiedProducts');
const {
  ensureUnqualifiedProductsTable,
  getUnqualifiedProductCategoryOptions,
  getUnqualifiedProductIssueOptions,
  buildProvinceDisplayExpr,
  buildSourceDateExpr,
  buildSourceTitleExpr,
  buildSourceUrlExpr,
  buildCompanyIdExpr,
  buildOrderClause,
  buildSamplingSearchFilters
} = require('../utils/samplingSearchQuery');

const router = express.Router();

const CHINA_PROVINCES = [
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆'
];

const FIELD_SCHEMA = [
  {
    group: 'enterprise',
    groupLabel: '企业信息',
    fields: [
      { key: 'company_names', label: '标示企业名称', defaultVisible: true },
      { key: 'company_addresses', label: '企业地址', defaultVisible: false, sensitive: true },
      { key: 'manufacturer_name', label: '生产企业名称', defaultVisible: true },
      { key: 'manufacturer_address', label: '生产企业地址', defaultVisible: false, sensitive: true },
      { key: 'operator_name', label: '经营企业名称', defaultVisible: true },
      { key: 'operator_address', label: '经营企业地址', defaultVisible: false, sensitive: true },
      { key: 'sample_unit_name', label: '被抽样单位', defaultVisible: true },
      { key: 'sample_unit_address', label: '抽样单位地址', defaultVisible: false, sensitive: true },
      { key: 'province_display', label: '省份(综合)', defaultVisible: true },
      { key: 'manufacturer_province', label: '生产/备案地区', defaultVisible: false },
      { key: 'manufacturer_city', label: '生产企业城市', defaultVisible: false },
      { key: 'sampled_province', label: '样品省份', defaultVisible: false },
      { key: 'sampled_city', label: '样品城市', defaultVisible: false }
    ]
  },
  {
    group: 'product',
    groupLabel: '产品信息',
    fields: [
      { key: 'product_name', label: '产品名称', defaultVisible: true },
      { key: 'product_category', label: '产品品类', defaultVisible: true },
      { key: 'product_categories_display', label: '品类(多标签)', defaultVisible: false },
      { key: 'package_spec', label: '包装规格', defaultVisible: false },
      { key: 'batch_no', label: '批号', defaultVisible: true },
      { key: 'production_date', label: '生产日期', defaultVisible: false },
      { key: 'expiry_date', label: '限用日期', defaultVisible: false },
      { key: 'product_region', label: '标示地区', defaultVisible: false },
      { key: 'registration_no', label: '注册/备案号', defaultVisible: false },
      { key: 'production_license_no', label: '生产许可证号', defaultVisible: false }
    ]
  },
  {
    group: 'inspection',
    groupLabel: '抽检信息',
    fields: [
      { key: 'sequence_no', label: '序号', defaultVisible: true },
      { key: 'source_title', label: '通告标题', defaultVisible: true },
      { key: 'announcement_no', label: '通告编号', defaultVisible: false },
      { key: 'source_publish_date', label: '发布日期', defaultVisible: true },
      { key: 'unqualified_items', label: '不符合项目', defaultVisible: true },
      { key: 'issue_items_display', label: '不符合项目(拆分)', defaultVisible: false },
      { key: 'inspection_result', label: '检验结果', defaultVisible: false },
      { key: 'requirement', label: '规定要求', defaultVisible: false },
      { key: 'inspection_institution', label: '检验机构', defaultVisible: false },
      { key: 'remarks', label: '备注', defaultVisible: false },
      { key: 'is_counterfeit', label: '假冒', defaultVisible: false },
      { key: 'product_type_label', label: '产品类型', defaultVisible: false },
      { key: 'announcement_type_label', label: '通告类型', defaultVisible: false },
      { key: 'source_detail_url', label: '来源链接', defaultVisible: false },
      { key: 'batch_title', label: '批次标题', defaultVisible: false },
      { key: 'id', label: '记录ID', defaultVisible: false }
    ]
  }
];

function getDefaultColumnKeys() {
  const keys = [];
  FIELD_SCHEMA.forEach((g) => {
    g.fields.forEach((f) => {
      if (f.defaultVisible) {
        keys.push(f.key);
      }
    });
  });
  return keys;
}

function clampPageSize(limit, defaultValue = 10, maxValue = 200) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

function buildSelectExpressions() {
  const issueSub = `(SELECT GROUP_CONCAT(DISTINCT issue_item ORDER BY issue_item SEPARATOR '、') FROM unqualified_product_issue_items WHERE unqualified_product_id = up.id)`;
  const catSub = `(SELECT GROUP_CONCAT(DISTINCT product_category ORDER BY product_category SEPARATOR '、') FROM unqualified_product_category_items WHERE unqualified_product_id = up.id)`;
  return `
        up.*,
        ${issueSub} AS issue_items_display,
        ${catSub} AS product_categories_display,
        ${buildProvinceDisplayExpr('up')} AS province_display,
        ${buildSourceDateExpr('a', 's')} AS source_publish_date,
        ${buildSourceTitleExpr('a', 's', 'up')} AS source_title,
        ${buildSourceUrlExpr('a', 's')} AS source_detail_url,
        ${buildCompanyIdExpr('up')} AS company_id,
        a.announcement_no,
        CASE
          WHEN up.announcement_id IS NOT NULL THEN 'announcement'
          WHEN up.supervision_id IS NOT NULL THEN 'supervision'
          ELSE 'unknown'
        END AS source_type
      `;
}

function maskRow(row, maskSensitive) {
  if (!maskSensitive) {
    return row;
  }
  const next = { ...row };
  if (next.company_addresses) {
    next.company_addresses = '[已脱敏]';
  }
  if (next.manufacturer_address) {
    next.manufacturer_address = '[已脱敏]';
  }
  if (next.operator_address) {
    next.operator_address = '[已脱敏]';
  }
  if (next.sample_unit_address) {
    next.sample_unit_address = '[已脱敏]';
  }
  return next;
}

function getFieldLabel(key) {
  const f = FIELD_SCHEMA.flatMap((g) => g.fields).find((field) => field.key === key);
  return f ? f.label : key;
}

function rowToExportObject(row, columnKeys, columnLabels = {}, maskSensitive) {
  const masked = maskRow(row, maskSensitive);
  const obj = {};
  columnKeys.forEach((key) => {
    const label = columnLabels[key] || getFieldLabel(key);
    let val = masked[key];
    if (val === null || val === undefined) {
      val = '';
    } else if (typeof val === 'object') {
      val = JSON.stringify(val);
    }
    obj[label] = val;
  });
  return obj;
}

async function logOperation(action, details) {
  try {
    await pool.query(
      'INSERT INTO operation_logs (user_id, action, module, details) VALUES (NULL, ?, ?, ?)',
      [action, 'sampling_search', typeof details === 'string' ? details : JSON.stringify(details)]
    );
  } catch (error) {
    console.error('写入操作日志失败:', error);
  }
}

function buildFilterDescription(filters = {}) {
  const parts = [];
  const ys = filters.year_start ?? filters.yearStart;
  const ye = filters.year_end ?? filters.yearEnd;
  if (ys != null || ye != null) {
    parts.push(`年份 ${ys ?? '—'} ~ ${ye ?? '—'}`);
  }
  const provinces = filters.provinces || [];
  if (provinces.length) {
    parts.push(`省份 ${provinces.join('、')}`);
  }
  const ck = filters.company_keyword || filters.companyKeyword;
  if (ck) {
    parts.push(`企业关键词 ${ck}`);
  }
  const cats = filters.product_categories || filters.productCategories;
  if (cats?.length) {
    parts.push(`品类 ${cats.join('、')}`);
  }
  const issues = filters.issue_items || filters.issueItems;
  if (issues?.length) {
    parts.push(`不合格项 ${issues.join('、')}`);
  }
  const ann = filters.announcement_ids || filters.announcementIds;
  if (ann?.length) {
    parts.push(`通告ID ${ann.join(',')}`);
  }
  return parts.join('；') || '全量条件';
}

function sanitizeFilenamePart(text) {
  return String(text || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .slice(0, 120);
}

function buildExportFilename(filters, ext) {
  const desc = sanitizeFilenamePart(buildFilterDescription(filters).replace(/[；、]/g, '-'));
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
  return `${desc || 'export'}-${timeStr}.${ext}`;
}

router.get('/field-schema', (req, res) => {
  res.json({
    success: true,
    data: {
      groups: FIELD_SCHEMA,
      default_columns: getDefaultColumnKeys(),
      sortable_fields: [
        { value: 'source_publish_date', label: '发布日期' },
        { value: 'product_name', label: '产品名称' },
        { value: 'company_names', label: '企业名称' },
        { value: 'province_display', label: '省份' },
        { value: 'unqualified_items', label: '不符合项目' },
        { value: 'sequence_no', label: '序号' }
      ]
    }
  });
});

router.get('/options', async (req, res) => {
  try {
    await ensureUnqualifiedProductsTable(pool);
    const yearStart = req.query.year_start ? Number.parseInt(req.query.year_start, 10) : null;
    const yearEnd = req.query.year_end ? Number.parseInt(req.query.year_end, 10) : null;
    const sourceDateExpr = buildSourceDateExpr('a', 's');

    const [productCategories, issueItems, provinceRows, announcementRows] = await Promise.all([
      getUnqualifiedProductCategoryOptions(pool, 400),
      getUnqualifiedProductIssueOptions(pool, 400),
      pool.query(`
        SELECT DISTINCT ${buildProvinceDisplayExpr('up')} AS province
        FROM unqualified_products up
        WHERE ${buildProvinceDisplayExpr('up')} IS NOT NULL
          AND TRIM(${buildProvinceDisplayExpr('up')}) != ''
        ORDER BY province ASC
      `),
      (() => {
        const cond = ['status = ?'];
        const p = ['published'];
        if (yearStart != null && !Number.isNaN(yearStart)) {
          cond.push(`(publish_date IS NOT NULL AND YEAR(publish_date) >= ?)`);
          p.push(yearStart);
        }
        if (yearEnd != null && !Number.isNaN(yearEnd)) {
          cond.push(`(publish_date IS NOT NULL AND YEAR(publish_date) <= ?)`);
          p.push(yearEnd);
        }
        return pool.query(
          `
            SELECT id, title, announcement_no, publish_date
            FROM announcements
            WHERE ${cond.join(' AND ')}
            ORDER BY publish_date DESC
            LIMIT 500
          `,
          p
        );
      })()
    ]);

    const fromDb = (provinceRows[0] || []).map((r) => String(r.province || '').trim()).filter(Boolean);
    const provinceSet = new Set([...CHINA_PROVINCES, ...fromDb]);
    const provinces = Array.from(provinceSet).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    res.json({
      success: true,
      data: {
        provinces: provinces.map((p) => ({ label: p, value: p })),
        product_categories: productCategories,
        issue_items: issueItems,
        announcements: (announcementRows[0] || []).map((row) => ({
          value: row.id,
          label: `${row.publish_date ? String(row.publish_date).slice(0, 10) : '—'} ${row.title || ''}`.trim(),
          announcement_no: row.announcement_no
        }))
      }
    });
  } catch (error) {
    console.error('sampling_search options failed:', error);
    res.status(500).json({ success: false, message: '加载筛选项失败' });
  }
});

router.post('/query', async (req, res) => {
  try {
    await ensureUnqualifiedProductsTable(pool);

    const body = req.body || {};
    const filters = {
      year_start: body.year_start,
      year_end: body.year_end,
      provinces: body.provinces,
      company_keyword: body.company_keyword,
      product_categories: body.product_categories,
      issue_items: body.issue_items,
      announcement_ids: body.announcement_ids
    };

    const { joinClause, conditions, params, sourceDateExpr } = buildSamplingSearchFilters(filters);
    const whereClause = conditions.join(' AND ');
    const currentPage = Math.max(Number.parseInt(body.page, 10) || 1, 1);
    const pageSize = clampPageSize(body.limit, 10, 200);
    const offset = (currentPage - 1) * pageSize;
    const sortField = body.sort_field || 'source_publish_date';
    const sortOrder = body.sort_order || 'desc';
    const orderSql = buildOrderClause(sortField, sortOrder, sourceDateExpr);

    const selectSql = buildSelectExpressions();

    const [rows] = await pool.query(
      `
        SELECT ${selectSql}
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
        ${orderSql}
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);

    const [topProvinces] = await pool.query(
      `
        SELECT ${buildProvinceDisplayExpr('up')} AS name, COUNT(*) AS value
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
          AND ${buildProvinceDisplayExpr('up')} IS NOT NULL
          AND TRIM(${buildProvinceDisplayExpr('up')}) != ''
        GROUP BY ${buildProvinceDisplayExpr('up')}
        ORDER BY value DESC
        LIMIT 10
      `,
      [...params]
    );

    const [topIssues] = await pool.query(
      `
        SELECT upii.issue_item AS name, COUNT(DISTINCT upii.unqualified_product_id) AS value
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        INNER JOIN unqualified_product_issue_items upii ON upii.unqualified_product_id = up.id
        WHERE ${whereClause}
        GROUP BY upii.issue_item
        ORDER BY value DESC
        LIMIT 10
      `,
      [...params]
    );

    await logOperation('search', {
      filters,
      total,
      page: currentPage
    });

    const data = rows.map((row) => ({
      ...row,
      product_type_label: getProductTypeLabel(normalizeProductType(row.product_type)),
      announcement_type_label: getAnnouncementTypeLabel(normalizeAnnouncementType(row.announcement_type)),
      is_counterfeit: Number(row.is_counterfeit) === 1 ? '是' : '否'
    }));

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: currentPage,
        limit: pageSize,
        pages: Math.ceil(total / pageSize) || 0
      },
      filters_applied: filters,
      chart: {
        province_top10: (topProvinces || []).map((r) => ({ name: r.name, value: Number(r.value) || 0 })),
        issue_top10: (topIssues || []).map((r) => ({ name: r.name, value: Number(r.value) || 0 }))
      }
    });
  } catch (error) {
    console.error('sampling_search query failed:', error);
    res.status(500).json({ success: false, message: '检索失败' });
  }
});

router.post('/export', async (req, res) => {
  try {
    await ensureUnqualifiedProductsTable(pool);

    const body = req.body || {};
    const filters = {
      year_start: body.year_start,
      year_end: body.year_end,
      provinces: body.provinces,
      company_keyword: body.company_keyword,
      product_categories: body.product_categories,
      issue_items: body.issue_items,
      announcement_ids: body.announcement_ids
    };

    const { joinClause, conditions, params, sourceDateExpr } = buildSamplingSearchFilters(filters);
    const whereClause = conditions.join(' AND ');
    const sortField = body.sort_field || 'source_publish_date';
    const sortOrder = body.sort_order || 'desc';
    const orderSql = buildOrderClause(sortField, sortOrder, sourceDateExpr);
    const selectSql = buildSelectExpressions();

    const scope = body.scope === 'page' ? 'page' : 'all';
    const page = Math.max(Number.parseInt(body.page, 10) || 1, 1);
    const limit = clampPageSize(body.limit, 10, 200);
    const offset = (page - 1) * limit;

    const maxExport = 50000;
    let exportLimit = maxExport;
    let exportOffset = 0;

    if (scope === 'page') {
      exportLimit = limit;
      exportOffset = offset;
    }

    const [rows] = await pool.query(
      `
        SELECT ${selectSql}
        FROM unqualified_products up
        LEFT JOIN announcements a ON up.announcement_id = a.id
        LEFT JOIN supervisions s ON up.supervision_id = s.id
        ${joinClause}
        WHERE ${whereClause}
        ${orderSql}
        LIMIT ? OFFSET ?
      `,
      [...params, exportLimit, exportOffset]
    );

    const columnKeys = Array.isArray(body.columns) && body.columns.length ? body.columns : getDefaultColumnKeys();
    const columnLabels = body.column_labels && typeof body.column_labels === 'object' ? body.column_labels : {};
    const maskSensitive = body.mask_sensitive !== false;
    const includeFilterSheet = Boolean(body.include_filter_sheet);
    const format = body.format === 'csv' ? 'csv' : 'xlsx';

    let mapped = rows.map((row) => {
      const r = {
        ...row,
        product_type_label: getProductTypeLabel(normalizeProductType(row.product_type)),
        announcement_type_label: getAnnouncementTypeLabel(normalizeAnnouncementType(row.announcement_type)),
        is_counterfeit: Number(row.is_counterfeit) === 1 ? '是' : '否'
      };
      return rowToExportObject(r, columnKeys, columnLabels, maskSensitive);
    });

    if (!mapped.length) {
      const emptyObj = {};
      columnKeys.forEach((key) => {
        const label = columnLabels[key] || getFieldLabel(key);
        emptyObj[label] = '';
      });
      mapped = [emptyObj];
    }

    const filename = buildExportFilename(filters, format === 'csv' ? 'csv' : 'xlsx');

    await logOperation('export', {
      filters,
      scope,
      format,
      filename,
      row_count: mapped.length
    });

    if (format === 'csv') {
      const headers = Object.keys(mapped[0]);
      const escape = (v) => {
        const s = String(v ?? '');
        if (/[",\n]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const lines = [headers.join(',')];
      mapped.forEach((obj) => {
        lines.push(headers.map((h) => escape(obj[h])).join(','));
      });
      const csv = `\uFEFF${lines.join('\n')}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      return res.send(csv);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(mapped);
    XLSX.utils.book_append_sheet(wb, ws, '数据');

    if (includeFilterSheet) {
      const desc = buildFilterDescription(filters);
      const meta = [
        ['筛选条件说明'],
        [desc],
        ['导出范围', scope === 'page' ? '当前页' : '全部检索结果(最多5万条)'],
        ['脱敏', maskSensitive ? '是(已隐藏详细地址)' : '否'],
        ['列字段', columnKeys.join(', ')],
        ['记录数', String(mapped.length)]
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(meta);
      XLSX.utils.book_append_sheet(wb, ws2, '筛选说明');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    return res.send(Buffer.from(buf));
  } catch (error) {
    console.error('sampling_search export failed:', error);
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

module.exports = router;
