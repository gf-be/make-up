function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
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

function normalizeIssueItem(value) {
  return normalizeText(value)
    .replace(/^[（(]?\d+[）).、]?\s*/, '')
    .replace(/^[-•·]\s*/, '')
    .slice(0, 255);
}

function extractIssueItems(unqualifiedItems) {
  const source = String(unqualifiedItems || '').replace(/\r/g, '\n');
  const parts = source
    .split(/[\n；;]+/)
    .map((item) => normalizeIssueItem(item))
    .filter(Boolean);

  const unique = Array.from(new Set(parts));
  if (unique.length > 0) {
    return unique;
  }

  const fallback = normalizeIssueItem(unqualifiedItems);
  return fallback ? [fallback] : [];
}

function buildDerivedAnalyticsFields(row = {}) {
  return {
    product_category: deriveProductCategory(row.product_name),
    manufacturer_province: extractProvince(row.company_addresses || row.product_region),
    sampled_province: extractProvince(row.sample_unit_address),
    issue_category: deriveIssueCategory(row.unqualified_items, row.inspection_result, row.requirement)
  };
}

module.exports = {
  normalizeText,
  extractProvince,
  deriveProductCategory,
  deriveIssueCategory,
  normalizeIssueItem,
  extractIssueItems,
  buildDerivedAnalyticsFields
};
