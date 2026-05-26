function normalizeText(value) {
  return String(value || '')
    .replace(/\u0007/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const ENTITY_LABEL_PATTERN = /([\u4e00-\u9fa5A-Za-z/（）()·]+?)[：:]/g;

const SKIP_COMPANY_LABELS = new Set([
  '原产国',
  '原产地',
  '产地',
  '产地国',
  '国别',
  '国家',
  '地区',
  '国家/地区'
]);

function stripEdgeSeparators(value) {
  return normalizeText(value).replace(/^[，,；;\s]+|[，,；;\s]+$/g, '');
}

function isInvalidCompanyValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }
  return /^[/／\-—－.·]+$/.test(normalized);
}

function shouldSkipCompanyLabel(label) {
  const normalized = normalizeText(label);
  if (!normalized) {
    return true;
  }
  if (SKIP_COMPANY_LABELS.has(normalized)) {
    return true;
  }
  return /原产国|原产地|产地国|国别|国家\/地区/.test(normalized);
}

function parseLabeledParts(value) {
  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  const matches = [];
  let match = ENTITY_LABEL_PATTERN.exec(text);
  while (match) {
    matches.push({
      label: normalizeText(match[1]),
      start: match.index,
      valueStart: ENTITY_LABEL_PATTERN.lastIndex
    });
    match = ENTITY_LABEL_PATTERN.exec(text);
  }
  ENTITY_LABEL_PATTERN.lastIndex = 0;

  if (matches.length === 0) {
    return [];
  }

  return matches.map((item, index) => {
    const next = matches[index + 1];
    return {
      label: item.label,
      value: stripEdgeSeparators(text.slice(item.valueStart, next ? next.start : text.length))
    };
  }).filter((item) => item.value);
}

function splitPlainSegments(value) {
  return String(value || '')
    .split(/\r?\n|；|;/)
    .map((item) => stripEdgeSeparators(item))
    .filter(Boolean);
}

function extractNameFromSegment(segment) {
  const text = stripEdgeSeparators(segment);
  if (!text) {
    return null;
  }

  const labeledParts = parseLabeledParts(text);
  if (labeledParts.length === 1) {
    const part = labeledParts[0];
    if (shouldSkipCompanyLabel(part.label) || isInvalidCompanyValue(part.value)) {
      return null;
    }
    return {
      label: part.label,
      name: part.value
    };
  }

  const labeledMatch = text.match(/^([^：:]+)[：:]\s*(.+)$/s);
  if (labeledMatch) {
    const label = normalizeText(labeledMatch[1]);
    const name = stripEdgeSeparators(labeledMatch[2]);
    if (shouldSkipCompanyLabel(label) || isInvalidCompanyValue(name)) {
      return null;
    }
    return {
      label,
      name
    };
  }

  if (isInvalidCompanyValue(text)) {
    return null;
  }

  return {
    label: null,
    name: text
  };
}

/** 名称标签「销售商」与地址标签「销售商地址」等互认 */
function normalizeCompanyLabelKey(label) {
  return normalizeText(label).replace(/地址$/u, '');
}

function buildAddressLookup(addressParts) {
  const addressByLabel = new Map();
  addressParts.forEach((part) => {
    if (!part.label) {
      return;
    }
    addressByLabel.set(part.label, part.value);
    const base = normalizeCompanyLabelKey(part.label);
    if (base) {
      addressByLabel.set(base, part.value);
    }
  });
  return addressByLabel;
}

function resolveEntryAddress(nameLabel, nameIndex, addressParts, addressByLabel) {
  if (nameLabel) {
    const direct = addressByLabel.get(nameLabel);
    if (direct) {
      return direct;
    }
    const base = normalizeCompanyLabelKey(nameLabel);
    if (base) {
      const byBase = addressByLabel.get(base);
      if (byBase) {
        return byBase;
      }
    }
  }
  const indexed = addressParts[nameIndex];
  if (indexed?.value) {
    return indexed.value;
  }
  return null;
}

function buildEntriesFromLabeledParts(nameParts, addressParts) {
  const addressByLabel = buildAddressLookup(addressParts);

  const entries = [];
  nameParts.forEach((part, index) => {
    if (shouldSkipCompanyLabel(part.label) || isInvalidCompanyValue(part.value)) {
      return;
    }
    entries.push({
      label: part.label || null,
      name: part.value,
      address: resolveEntryAddress(part.label, index, addressParts, addressByLabel)
    });
  });

  return entries;
}

function buildEntriesFromPlainSegments(namesValue, addressesValue) {
  const nameSegments = splitPlainSegments(namesValue);
  const addressSegments = splitPlainSegments(addressesValue);
  const defaultAddress = addressSegments[0] || normalizeText(addressesValue) || null;
  const entries = [];

  nameSegments.forEach((segment, index) => {
    const parsed = extractNameFromSegment(segment);
    if (!parsed) {
      return;
    }
    entries.push({
      label: parsed.label,
      name: parsed.name,
      address: addressSegments[index] || defaultAddress || null
    });
  });

  return entries;
}

/**
 * 将 company_names / company_addresses 拆成多条企业记录。
 * 优先按「标签：值」解析（冒号分隔），否则按换行/分号分段并在段内去标签。
 */
function splitCompanyEntries(namesValue, addressesValue = '') {
  const nameParts = parseLabeledParts(namesValue);
  const addressParts = parseLabeledParts(addressesValue);

  let entries = [];
  if (nameParts.length > 0) {
    entries = buildEntriesFromLabeledParts(nameParts, addressParts);
  } else {
    entries = buildEntriesFromPlainSegments(namesValue, addressesValue);
  }

  if (entries.length === 0) {
    const fallbackName = extractNameFromSegment(namesValue);
    if (fallbackName) {
      entries.push({
        label: fallbackName.label,
        name: fallbackName.name,
        address: normalizeText(addressesValue) || null
      });
    }
  }

  const deduped = [];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = `${entry.name}__${entry.address || ''}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(enrichCompanyEntryType(entry));
  });

  return deduped;
}

function splitCompanyValues(value) {
  return splitCompanyEntries(value).map((item) => item.name);
}

function splitCompanyAddressValues(value) {
  return splitPlainSegments(value);
}

const REGISTRANT_LABELS = ['注册人', '备案人'];
//匹配词
const MANUFACTURER_LABELS_COSMETICS = [
  '受托生产企业',
  '委托生产企业',
  '标称生产企业',
  '标称生产企业名称',
  '生产企业',
  '生产企业名称',
  '生产商',
  '生产商名称',
  '生产者',
  '制造商',
  '制作商',
  '制作企业',
  '生产厂商'
];

const MANUFACTURER_LABELS_FOOD = [
  '生产商',
  '生产商名称',
  '生产者',
  '制造商',
  '制作商',
  '制作企业',
  '制作厂商',
  '生产厂商',
  '生产企业',
  '生产企业名称',
  '标称生产企业',
  '标称生产企业名称',
  '受委托方',
  '受委托方单位',
  '供应商',
  '生产商（分装）'
];

const OPERATOR_LABELS_COSMETICS = [
  '总经销',
  '总经销商',
  '经销商',
  '销售商',
  '销售企业',
  '销售单位',
  '进口商',
  '代理商',
  '委托商',
  '委托企业',
  '委托方',
  '境内责任人',
  '经营企业'
];
const COMPANY_LABELS_FOOD = [
  '委托商',
  '委托企业',
  '委托方'
];
const OPERATOR_LABELS_FOOD = [
  '销售商',
  '销售者',
  '销售企业',
  '销售单位',
  '总经销',
  '总经销商',
  '经销商',
  '进口商',
  '中国代理商',
  '中国总经销商',
  '进口商/经销商',
  '受托商'
 
];

const SAMPLE_UNIT_LABELS = [
  '被抽样单位',
  '被抽样单位名称',
  '抽样单位',
  '经营者',
  '经营者名称',
  '销售门店',
  '网店',
  '门店'
];
const COMPANY_TYPE_LABELS = {
  manufacturer: '生产企业',
  distributor: '经销商',
  seller: '销售商'
};

function normalizeEntityLabel(label) {
  return normalizeText(label)
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '');
}

function labelMatchesGroup(label, group = []) {
  const normalized = normalizeEntityLabel(label);
  if (!normalized) {
    return false;
  }

  return group.some((item) => normalizeEntityLabel(item) === normalized);
}

function resolveCompanyEntryType(label, fallbackType = 'manufacturer') {
  const normalized = normalizeEntityLabel(label);
  if (!normalized) {
    return fallbackType;
  }
  if (labelMatchesGroup(normalized, SAMPLE_UNIT_LABELS) || /被抽样|抽样单位|经营者|销售门店|网店|门店/.test(normalized)) {
    return 'seller';
  }
  if (labelMatchesGroup(normalized, MANUFACTURER_LABELS_FOOD)
    || labelMatchesGroup(normalized, MANUFACTURER_LABELS_COSMETICS)
    || /生产|制造|制作|供应/.test(normalized)) {
    return 'manufacturer';
  }
  if (labelMatchesGroup(normalized, OPERATOR_LABELS_FOOD)
    || labelMatchesGroup(normalized, OPERATOR_LABELS_COSMETICS)
    || /销售商|销售者|销售企业|销售单位|经销|代理|进口|委托|受托|总经销/.test(normalized)) {
    return 'distributor';
  }
  return fallbackType;
}

function enrichCompanyEntryType(entry, fallbackType = 'manufacturer') {
  const type = resolveCompanyEntryType(entry?.label, fallbackType);
  return {
    ...entry,
    type,
    type_label: COMPANY_TYPE_LABELS[type] || COMPANY_TYPE_LABELS.manufacturer
  };
}

function pickLabeledEntry(entries = [], labelGroup = []) {
  for (const entry of entries) {
    if (!entry?.label || isInvalidCompanyValue(entry.name)) {
      continue;
    }
    if (labelMatchesGroup(entry.label, labelGroup)) {
      return entry;
    }
  }
  return null;
}

function pickLabeledPart(parts = [], labelGroup = [], allowInvalid = false) {
  for (const part of parts) {
    if (!part?.label || !part.value) {
      continue;
    }
    if (!allowInvalid && isInvalidCompanyValue(part.value)) {
      continue;
    }
    if (labelMatchesGroup(part.label, labelGroup)) {
      return part;
    }
  }
  return null;
}

function normalizeExplicitEmptyCompanyValue(value) {
  const normalized = normalizeText(value);
  if (/^[/／]+$/.test(normalized)) {
    return '/';
  }
  return null;
}

function formatLabeledCompanyText(entries = []) {
  return entries
    .filter((entry) => entry?.name && !isInvalidCompanyValue(entry.name))
    .map((entry) => (entry.label ? `${entry.label}：${entry.name}` : entry.name))
    .join('；');
}

function formatLabeledAddressText(entries = [], nameEntries = []) {
  return nameEntries
    .map((entry, index) => {
      const address = entry.address
        || (entry.label
          ? nameEntries.find((item) => item.label === entry.label)?.address
          : null)
        || null;
      if (!address) {
        return '';
      }
      return entry.label ? `${entry.label}：${address}` : address;
    })
    .filter(Boolean)
    .join('；');
}

/**
 * 按「标签：企业名」拆分到结构化字段。
 * 化妆品：备案人/注册人 → company_names；生产企业 → manufacturer_*；总经销等 → operator_*
 * 食品：生产商 → manufacturer_*；销售商/经销 → operator_*
 */
function normalizeCompanyEntry(entry, fallbackType = 'manufacturer') {
  if (!entry?.name || isInvalidCompanyValue(entry.name)) {
    return null;
  }
  if (entry.label && shouldSkipCompanyLabel(entry.label)) {
    return null;
  }
  return enrichCompanyEntryType(
    {
      label: entry.label || null,
      name: normalizeText(entry.name),
      address: normalizeText(entry.address) || null
    },
    fallbackType
  );
}

function appendCompanyEntry(entries, entry, fallbackType = 'manufacturer') {
  const normalized = normalizeCompanyEntry(entry, fallbackType);
  if (!normalized) {
    return entries;
  }
  const list = Array.isArray(entries) ? entries : [];
  const key = `${normalized.name}__${normalized.address || ''}__${normalized.type}`;
  const exists = list.some((item) => `${item.name}__${item.address || ''}__${item.type}` === key);
  if (!exists) {
    list.push(normalized);
  }
  return list;
}

function buildStructuredCompanyFields(productType, namesValue, addressesValue = '', extras = {}) {
  const normalizedProductType = String(productType || 'cosmetics').trim() === 'food' ? 'food' : 'cosmetics';
  const rawNameParts = parseLabeledParts(namesValue);
  const rawAddressParts = parseLabeledParts(addressesValue);
  const entries = splitCompanyEntries(namesValue, addressesValue);
  const manufacturerLabels = normalizedProductType === 'food'
    ? MANUFACTURER_LABELS_FOOD
    : MANUFACTURER_LABELS_COSMETICS;
  const operatorLabels = normalizedProductType === 'food'
    ? OPERATOR_LABELS_FOOD
    : OPERATOR_LABELS_COSMETICS;

  const registrant = pickLabeledEntry(entries, REGISTRANT_LABELS);
  const manufacturer = pickLabeledEntry(entries, manufacturerLabels);
  const operator = pickLabeledEntry(entries, operatorLabels);
  const sampleUnit = pickLabeledEntry(entries, SAMPLE_UNIT_LABELS);
  const manufacturerRawPart = pickLabeledPart(rawNameParts, manufacturerLabels, true);
  const manufacturerRawAddressPart = manufacturerRawPart?.label
    ? pickLabeledPart(rawAddressParts, [manufacturerRawPart.label], true)
    : null;
  const explicitEmptyManufacturer = normalizeExplicitEmptyCompanyValue(manufacturerRawPart?.value);

  const result = {
    company_names: registrant?.name || null,
    company_addresses: registrant?.address || null,
    manufacturer_name: manufacturer?.name || explicitEmptyManufacturer || normalizeText(extras.manufacturer_name) || null,
    manufacturer_address: manufacturer?.address
      || manufacturerRawAddressPart?.value
      || normalizeText(extras.manufacturer_address)
      || null,
    operator_name: operator?.name || normalizeText(extras.operator_name) || null,
    operator_address: operator?.address || normalizeText(extras.operator_address) || null,
    sample_unit_name: normalizeText(extras.sample_unit_name) || sampleUnit?.name || null,
    sample_unit_address: normalizeText(extras.sample_unit_address) || sampleUnit?.address || null,
    company_entries: [...entries]
  };

  if (!result.company_names && normalizedProductType === 'cosmetics' && entries.length === 1 && !entries[0].label) {
    result.company_names = entries[0].name;
    result.company_addresses = entries[0].address || null;
  }

  if (!result.manufacturer_name && entries.length === 1 && !entries[0].label) {
    result.manufacturer_name = entries[0].name;
    result.manufacturer_address = entries[0].address || null;
  }

  if (!result.manufacturer_name && normalizedProductType === 'food') {
    const fallbackManufacturer = pickLabeledEntry(entries, [
      '制作商', '制作企业', '制作厂商', '生产商', '生产厂商', '生产企业', '受委托方', '供应商'
    ]);
    if (fallbackManufacturer) {
      result.manufacturer_name = fallbackManufacturer.name;
      result.manufacturer_address = fallbackManufacturer.address || null;
    }
  }

  if (!result.operator_name && normalizedProductType === 'food') {
    const fallbackOperator = pickLabeledEntry(entries, [
      '经销商', '销售商', '总经销', '总经销商', '进口商', '中国代理商', '委托方'
    ]);
    if (fallbackOperator) {
      result.operator_name = fallbackOperator.name;
      result.operator_address = fallbackOperator.address || null;
    }
  }

  if (normalizedProductType === 'food' && normalizeText(namesValue)) {
    result.company_names = normalizeText(namesValue);
    if (normalizeText(addressesValue)) {
      result.company_addresses = normalizeText(addressesValue);
    }
  } else if (!result.company_names) {
    result.company_names = formatLabeledCompanyText(entries) || normalizeText(namesValue) || null;
  }

  if (normalizedProductType !== 'food' && !result.company_addresses) {
    result.company_addresses = formatLabeledAddressText(entries, entries) || normalizeText(addressesValue) || null;
  } else if (normalizedProductType === 'food' && !result.company_addresses && normalizeText(addressesValue)) {
    result.company_addresses = normalizeText(addressesValue);
  }

  if (!result.manufacturer_name) {
    result.manufacturer_name = normalizeText(extras.manufacturer_name) || null;
    result.manufacturer_address = normalizeText(extras.manufacturer_address) || result.manufacturer_address || null;
  }
  if (!result.operator_name) {
    result.operator_name = normalizeText(extras.operator_name) || null;
    result.operator_address = normalizeText(extras.operator_address) || result.operator_address || null;
  }

  result.company_entries = appendCompanyEntry(result.company_entries, {
    label: '生产企业',
    name: result.manufacturer_name,
    address: result.manufacturer_address
  }, 'manufacturer');
  result.company_entries = appendCompanyEntry(result.company_entries, {
    label: '经销商',
    name: result.operator_name,
    address: result.operator_address
  }, 'distributor');
  result.company_entries = appendSampleUnitCompanyEntry(
    result.company_entries,
    result.sample_unit_name,
    result.sample_unit_address
  );

  return result;
}

function appendSampleUnitCompanyEntry(entries, sampleUnitName, sampleUnitAddress) {
  const list = Array.isArray(entries) ? [...entries] : [];
  const name = normalizeText(sampleUnitName);
  if (!name || isInvalidCompanyValue(name)) {
    return list;
  }
  const address = normalizeText(sampleUnitAddress) || null;
  const key = `${name}__${address || ''}__seller`;
  const exists = list.some((entry) => `${entry.name}__${entry.address || ''}__${entry.type}` === key);
  if (exists) {
    return list;
  }
  list.push({
    label: '被抽样单位',
    name,
    address,
    type: 'seller',
    type_label: COMPANY_TYPE_LABELS.seller
  });
  return list;
}

module.exports = {
  normalizeText,
  splitCompanyEntries,
  splitCompanyValues,
  splitCompanyAddressValues,
  parseLabeledParts,
  isInvalidCompanyValue,
  buildStructuredCompanyFields,
  appendSampleUnitCompanyEntry,
  resolveCompanyEntryType,
  enrichCompanyEntryType,
  REGISTRANT_LABELS,
  MANUFACTURER_LABELS_COSMETICS,
  MANUFACTURER_LABELS_FOOD,
  OPERATOR_LABELS_COSMETICS,
  OPERATOR_LABELS_FOOD
};
