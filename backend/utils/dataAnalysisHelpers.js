function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function extractProvince(text) {
  return extractProvinceCity(text).province;
}

const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市'];
const REGION_ALIASES = {
  北京: '北京市',
  天津: '天津市',
  上海: '上海市',
  重庆: '重庆市',
  内蒙古: '内蒙古自治区',
  广西: '广西壮族自治区',
  西藏: '西藏自治区',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  香港: '香港特别行政区',
  澳门: '澳门特别行政区',
  广东: '广东省',
  浙江: '浙江省',
  江苏: '江苏省',
  福建: '福建省',
  山东: '山东省',
  河南: '河南省',
  湖北: '湖北省',
  湖南: '湖南省',
  安徽: '安徽省',
  江西: '江西省',
  河北: '河北省',
  山西: '山西省',
  辽宁: '辽宁省',
  吉林: '吉林省',
  黑龙江: '黑龙江省',
  四川: '四川省',
  贵州: '贵州省',
  云南: '云南省',
  陕西: '陕西省',
  甘肃: '甘肃省',
  青海: '青海省',
  海南: '海南省'
};

const CITY_PROVINCE_MAP = {
  广州市: '广东省', 深圳市: '广东省', 珠海市: '广东省', 汕头市: '广东省', 佛山市: '广东省', 韶关市: '广东省', 湛江市: '广东省', 肇庆市: '广东省', 江门市: '广东省', 茂名市: '广东省', 惠州市: '广东省', 梅州市: '广东省', 汕尾市: '广东省', 河源市: '广东省', 阳江市: '广东省', 清远市: '广东省', 东莞市: '广东省', 中山市: '广东省', 潮州市: '广东省', 揭阳市: '广东省', 云浮市: '广东省', 英德市: '广东省',
  杭州市: '浙江省', 宁波市: '浙江省', 温州市: '浙江省', 嘉兴市: '浙江省', 湖州市: '浙江省', 绍兴市: '浙江省', 金华市: '浙江省', 衢州市: '浙江省', 舟山市: '浙江省', 台州市: '浙江省', 丽水市: '浙江省',
  南京市: '江苏省', 无锡市: '江苏省', 徐州市: '江苏省', 常州市: '江苏省', 苏州市: '江苏省', 南通市: '江苏省', 连云港市: '江苏省', 淮安市: '江苏省', 盐城市: '江苏省', 扬州市: '江苏省', 镇江市: '江苏省', 泰州市: '江苏省', 宿迁市: '江苏省',
  福州市: '福建省', 厦门市: '福建省', 莆田市: '福建省', 三明市: '福建省', 泉州市: '福建省', 漳州市: '福建省', 南平市: '福建省', 龙岩市: '福建省', 宁德市: '福建省',
  济南市: '山东省', 青岛市: '山东省', 淄博市: '山东省', 枣庄市: '山东省', 东营市: '山东省', 烟台市: '山东省', 潍坊市: '山东省', 济宁市: '山东省', 泰安市: '山东省', 威海市: '山东省', 日照市: '山东省', 临沂市: '山东省', 德州市: '山东省', 聊城市: '山东省', 滨州市: '山东省', 菏泽市: '山东省',
  郑州市: '河南省', 开封市: '河南省', 洛阳市: '河南省', 平顶山市: '河南省', 安阳市: '河南省', 鹤壁市: '河南省', 新乡市: '河南省', 焦作市: '河南省', 濮阳市: '河南省', 许昌市: '河南省', 漯河市: '河南省', 三门峡市: '河南省', 南阳市: '河南省', 商丘市: '河南省', 信阳市: '河南省', 周口市: '河南省', 驻马店市: '河南省',
  武汉市: '湖北省', 黄石市: '湖北省', 十堰市: '湖北省', 宜昌市: '湖北省', 襄阳市: '湖北省', 鄂州市: '湖北省', 荆门市: '湖北省', 孝感市: '湖北省', 荆州市: '湖北省', 黄冈市: '湖北省', 咸宁市: '湖北省', 随州市: '湖北省',
  长沙市: '湖南省', 株洲市: '湖南省', 湘潭市: '湖南省', 衡阳市: '湖南省', 邵阳市: '湖南省', 岳阳市: '湖南省', 常德市: '湖南省', 张家界市: '湖南省', 益阳市: '湖南省', 郴州市: '湖南省', 永州市: '湖南省', 怀化市: '湖南省', 娄底市: '湖南省',
  成都市: '四川省', 自贡市: '四川省', 攀枝花市: '四川省', 泸州市: '四川省', 德阳市: '四川省', 绵阳市: '四川省', 广元市: '四川省', 遂宁市: '四川省', 内江市: '四川省', 乐山市: '四川省', 南充市: '四川省', 眉山市: '四川省', 宜宾市: '四川省', 广安市: '四川省', 达州市: '四川省', 雅安市: '四川省', 巴中市: '四川省', 资阳市: '四川省',
  昆明市: '云南省', 曲靖市: '云南省', 玉溪市: '云南省', 保山市: '云南省', 昭通市: '云南省', 丽江市: '云南省', 普洱市: '云南省', 临沧市: '云南省',
  西安市: '陕西省', 铜川市: '陕西省', 宝鸡市: '陕西省', 咸阳市: '陕西省', 渭南市: '陕西省', 延安市: '陕西省', 汉中市: '陕西省', 榆林市: '陕西省', 安康市: '陕西省', 商洛市: '陕西省'
};

function normalizeProvinceName(value) {
  const text = normalizeText(value);
  if (!text || text === '未标注') {
    return '未标注';
  }
  if (REGION_ALIASES[text]) {
    return REGION_ALIASES[text];
  }
  if (MUNICIPALITIES.includes(text)) {
    return text;
  }
  if (/自治区|特别行政区|省$/.test(text)) {
    return text;
  }
  return text.endsWith('市') ? (CITY_PROVINCE_MAP[text] || text) : `${text}省`;
}

function extractCity(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '未标注';
  }
  for (const city of MUNICIPALITIES) {
    if (normalized.includes(city)) {
      return city;
    }
  }
  const match = normalized.match(/([^\s，,；;（）()省自治区]+?(?:市|自治州|地区|盟))/);
  return match ? match[1] : '未标注';
}

function extractProvinceCity(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { province: '未标注', city: '未标注' };
  }

  for (const city of MUNICIPALITIES) {
    if (normalized.includes(city)) {
      return { province: city, city };
    }
  }

  const provinceMatch = normalized.match(/(内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区|[^\s，,；;（）()]+省)/);
  const city = extractCity(normalized);
  if (provinceMatch) {
    return {
      province: normalizeProvinceName(provinceMatch[1]),
      city
    };
  }

  if (CITY_PROVINCE_MAP[city]) {
    return { province: CITY_PROVINCE_MAP[city], city };
  }

  const provinceAlias = Object.keys(REGION_ALIASES).find((alias) => normalized === alias || normalized.startsWith(alias));
  return {
    province: provinceAlias ? REGION_ALIASES[provinceAlias] : '未标注',
    city
  };
}

const COSMETICS_PRODUCT_CATEGORIES = [
  '染发',
  '烫发',
  '祛斑美白',
  '防晒',
  '防脱发',
  '祛痘',
  '滋养',
  '修护',
  '清洁',
  '卸妆',
  '保湿',
  '美容修饰',
  '芳香',
  '除臭',
  '抗皱',
  '紧致',
  '舒缓',
  '控油',
  '去角质',
  '爽身',
  '护发',
  '防断发',
  '去屑',
  '发色护理',
  '脱毛',
  '辅助剃须剃毛'
];

function deriveProductCategory(productName) {
  const text = normalizeText(productName);
  if (!text) {
    return '其他';
  }

  const rules = [
    ['染发', /染发|染膏|染发剂|染发膏|染发霜|染发乳|染发啫喱|着色剂/],
    ['烫发', /烫发|烫发剂|烫发水|烫发液|冷烫|卷发/],
    ['祛斑美白', /祛斑|淡斑|美白|亮白|净白|雪肌/],
    ['防晒', /防晒|隔离|晒后/],
    ['防脱发', /防脱|育发|生发|固发/],
    ['祛痘', /祛痘|去痘|痘肌|粉刺|暗疮/],
    ['滋养', /滋养|营养|润养|养肤|养发/],
    ['修护', /修护|修复|修护霜|修护乳|修护液/],
    ['清洁', /清洁|洁面|洗面|洗颜|洁肤|洗发|洗手|沐浴|香皂|皂|清洗/],
    ['卸妆', /卸妆|卸装|卸甲/],
    ['保湿', /保湿|补水|水润|润肤|润唇|润手|润体|润肤露/],
    ['美容修饰', /美容|修饰|彩妆|粉底|BB霜|CC霜|素颜霜|遮瑕|口红|唇膏|唇釉|眉笔|眼影|睫毛|腮红|粉饼|散粉|定妆|指甲油|美甲|修颜|提亮/],
    ['芳香', /芳香|香水|香氛|香膏|古龙水/],
    ['除臭', /除臭|祛臭|止汗|香体/],
    ['抗皱', /抗皱|去皱|淡纹|细纹/],
    ['紧致', /紧致|紧实|提拉|提升|塑颜/],
    ['舒缓', /舒缓|舒敏|修红|敏感肌|镇静/],
    ['控油', /控油|净油|平衡油脂|油脂平衡/],
    ['去角质', /去角质|祛角质|磨砂|焕肤|剥脱/],
    ['爽身', /爽身|痱子粉|爽肤粉/],
    ['护发', /护发|护发素|发膜|焗油|发乳|护发精油|头皮护理/],
    ['防断发', /防断发|强韧|韧发|防断裂/],
    ['去屑', /去屑|祛屑|头屑|屑/],
    ['发色护理', /发色护理|护色|锁色|固色|补色|发色/],
    ['脱毛', /脱毛|除毛|脱毛膏|脱毛蜡|脱毛慕斯/],
    ['辅助剃须剃毛', /剃须|剃毛|刮胡|须后|剃须泡|剃须膏|剃须啫喱/]
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
  const manufacturerRegion = extractProvinceCity(row.manufacturer_address || row.company_addresses || row.product_region);
  const sampledRegion = extractProvinceCity(row.operator_address || row.sample_unit_address);
  return {
    product_category: deriveProductCategory(row.product_name),
    manufacturer_province: manufacturerRegion.province,
    manufacturer_city: manufacturerRegion.city,
    sampled_province: sampledRegion.province,
    sampled_city: sampledRegion.city,
    issue_category: deriveIssueCategory(row.unqualified_items, row.inspection_result, row.requirement)
  };
}

module.exports = {
  normalizeText,
  extractProvince,
  extractCity,
  extractProvinceCity,
  COSMETICS_PRODUCT_CATEGORIES,
  deriveProductCategory,
  deriveIssueCategory,
  normalizeIssueItem,
  extractIssueItems,
  buildDerivedAnalyticsFields
};
