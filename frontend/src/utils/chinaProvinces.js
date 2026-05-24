/** @typedef {{ value: string, label: string }} ProvinceSelectOption */

function copyTextValue(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text || ['nan', 'none', 'null', 'undefined'].includes(text.toLowerCase())) return ''
  return text
}

/** 中国省级行政区标准全称（与 UnqualifiedProducts 树/筛选归并一致） */
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
])

const STANDARD_CN_PROVINCE_SET = new Set(STANDARD_CN_PROVINCES)
const STANDARD_CN_PROVINCES_BY_LENGTH = [...STANDARD_CN_PROVINCES].sort((a, b) => b.length - a.length)

function buildProvinceAliasToCanonical() {
  const m = new Map()
  for (const p of STANDARD_CN_PROVINCES) {
    m.set(p, p)
  }
  for (const p of STANDARD_CN_PROVINCES) {
    if (p.endsWith('特别行政区')) {
      m.set(p.replace(/特别行政区$/, ''), p)
    } else if (p.endsWith('自治区')) {
      const short = p
        .replace(/壮族自治区$/, '')
        .replace(/维吾尔自治区$/, '')
        .replace(/回族自治区$/, '')
        .replace(/自治区$/, '')
      if (short) {
        m.set(short, p)
      }
    } else if (p.endsWith('省')) {
      m.set(p.slice(0, -1), p)
    } else if (p.endsWith('市')) {
      m.set(p.slice(0, -1), p)
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
  ]
  for (const [alias, canonical] of extras) {
    if (!m.has(alias)) {
      m.set(alias, canonical)
    }
  }
  return m
}

const PROVINCE_ALIAS_TO_CANONICAL = buildProvinceAliasToCanonical()

function stripProvinceFieldNoise(raw) {
  return copyTextValue(raw)
    .replace(/^(注册人|备案人|境内责任人|标称生产企业)[：:]\s*/, '')
    .replace(/^(生产企业|生产地|产地)[：:]\s*/u, '')
    .trim()
}

/** 将库内省份字符串归并为标准全称；无法识别时返回去前缀后的原文。 */
export function normalizeProvinceToStandard(raw) {
  const text = stripProvinceFieldNoise(raw)
  if (!text) return ''
  if (STANDARD_CN_PROVINCE_SET.has(text)) return text
  const collapsed = text.replace(/\s+/g, '')
  if (STANDARD_CN_PROVINCE_SET.has(collapsed)) return collapsed
  const mapped = PROVINCE_ALIAS_TO_CANONICAL.get(text) || PROVINCE_ALIAS_TO_CANONICAL.get(collapsed)
  if (mapped) return mapped
  for (const p of STANDARD_CN_PROVINCES_BY_LENGTH) {
    if (text.includes(p) || collapsed.includes(p)) {
      return p
    }
  }
  return text
}

/** 省份筛选项：接口中的各类写法合并为标准全称，下拉 label/value 均为标准省名 */
export function mergeProvinceSelectOptions(items = []) {
  const byCanon = new Map()
  for (const item of items) {
    const raw = copyTextValue(item?.value ?? item?.label ?? '')
    if (!raw) continue
    const canon = normalizeProvinceToStandard(raw)
    if (!canon) continue
    if (!byCanon.has(canon)) {
      byCanon.set(canon, { value: canon, label: canon })
    }
  }
  return Array.from(byCanon.values()).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}
