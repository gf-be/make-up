const DEFAULT_PRODUCT_TYPE = 'cosmetics';
const DEFAULT_ANNOUNCEMENT_TYPE = 'sampling';

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

module.exports = {
  DEFAULT_PRODUCT_TYPE,
  DEFAULT_ANNOUNCEMENT_TYPE,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_ALIASES,
  ANNOUNCEMENT_TYPE_LABELS,
  ANNOUNCEMENT_TYPE_ALIASES,
  normalizeProductType,
  normalizeAnnouncementType,
  getProductTypeLabel,
  getAnnouncementTypeLabel,
  getProductTypeOptions,
  getAnnouncementTypeOptions
};
