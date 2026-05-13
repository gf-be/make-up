/**
 * 与前端的 UnqualifiedProducts.vue 保持一致的省级行政区归一化逻辑，
 * 用于筛选项、WHERE 条件与库存字符串对齐。
 */

const STANDARD_CN_PROVINCES = Object.freeze([
  '北京市',
  '天津市',
  '上海市',
  '重庆市',
  '河北省',
  '山西省',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '海南省',
  '四川省',
  '贵州省',
  '云南省',
  '陕西省',
  '甘肃省',
  '青海省',
  '台湾省',
  '内蒙古自治区',
  '广西壮族自治区',
  '西藏自治区',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '香港特别行政区',
  '澳门特别行政区'
]);

const STANDARD_CN_PROVINCE_SET = new Set(STANDARD_CN_PROVINCES);
const STANDARD_CN_PROVINCES_BY_LENGTH = [...STANDARD_CN_PROVINCES].sort((a, b) => b.length - a.length);

function buildProvinceAliasToCanonical() {
  const m = new Map();
  for (const p of STANDARD_CN_PROVINCES) {
    m.set(p, p);
  }
  for (const p of STANDARD_CN_PROVINCES) {
    if (p.endsWith('特别行政区')) {
      m.set(p.replace(/特别行政区$/, ''), p);
    } else if (p.endsWith('自治区')) {
      const short = p
        .replace(/壮族自治区$/, '')
        .replace(/维吾尔自治区$/, '')
        .replace(/回族自治区$/, '')
        .replace(/自治区$/, '');
      if (short) {
        m.set(short, p);
      }
    } else if (p.endsWith('省')) {
      m.set(p.slice(0, -1), p);
    } else if (p.endsWith('市')) {
      m.set(p.slice(0, -1), p);
    }
  }
  const extras = [
    ['内蒙', '内蒙古自治区'],
    ['广西省', '广西壮族自治区'],
    ['新疆自治区', '新疆维吾尔自治区'],
    ['中国香港', '香港特别行政区'],
    ['中国澳门', '澳门特别行政区'],
    ['中国台湾', '台湾省'],
    ['台湾地区', '台湾省']
  ];
  for (const [alias, canonical] of extras) {
    if (!m.has(alias)) {
      m.set(alias, canonical);
    }
  }
  return m;
}

const PROVINCE_ALIAS_TO_CANONICAL = buildProvinceAliasToCanonical();

function copyTextValue(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || ['nan', 'none', 'null', 'undefined'].includes(text.toLowerCase())) return '';
  return text;
}

function stripProvinceFieldNoise(raw) {
  return copyTextValue(raw)
    .replace(/^(注册人|备案人|境内责任人|标称生产企业)[：:]\s*/, '')
    .replace(/^(生产企业|生产地|产地)[：:]\s*/u, '')
    .trim();
}

function normalizeProvinceToStandard(raw) {
  const text = stripProvinceFieldNoise(raw);
  if (!text) return '';
  if (STANDARD_CN_PROVINCE_SET.has(text)) return text;
  const collapsed = text.replace(/\s+/g, '');
  if (STANDARD_CN_PROVINCE_SET.has(collapsed)) return collapsed;
  const mapped = PROVINCE_ALIAS_TO_CANONICAL.get(text) || PROVINCE_ALIAS_TO_CANONICAL.get(collapsed);
  if (mapped) return mapped;
  for (const p of STANDARD_CN_PROVINCES_BY_LENGTH) {
    if (text.includes(p) || collapsed.includes(p)) {
      return p;
    }
  }
  return text;
}

/**
 * 已知别名表里能归一到该标准省名的所有写法 + 标准名本身，用于 SQL IN。
 */
function expandCanonicalToKnownRawVariants(canonical) {
  const out = new Set();
  if (canonical) {
    out.add(canonical);
  }
  for (const [alias, c] of PROVINCE_ALIAS_TO_CANONICAL.entries()) {
    if (c === canonical) {
      out.add(alias);
    }
  }
  return [...out];
}

/**
 * 构造 (col IN (variants) OR TRIM(col) LIKE ?)，并把参数依次追加到 params。
 * canonical 应为 normalizeProvinceToStandard 的结果。
 */
function appendProvinceColumnPredicate(columnExpr, canonical, params) {
  const variants = expandCanonicalToKnownRawVariants(canonical);
  const inPh = variants.map(() => '?').join(', ');
  params.push(...variants, `${canonical}%`);
  return `(TRIM(${columnExpr}) IN (${inPh}) OR TRIM(${columnExpr}) LIKE ?)`;
}

module.exports = {
  normalizeProvinceToStandard,
  expandCanonicalToKnownRawVariants,
  appendProvinceColumnPredicate,
  STANDARD_CN_PROVINCES
};
