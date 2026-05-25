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
  '国别',
  '国家',
  '地区'
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

  const labeledMatch = text.match(/^(.+?)[：:]\s*(.+)$/);
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

function buildEntriesFromLabeledParts(nameParts, addressParts) {
  const addressByLabel = new Map();
  addressParts.forEach((part) => {
    if (part.label) {
      addressByLabel.set(part.label, part.value);
    }
  });

  const entries = [];
  nameParts.forEach((part, index) => {
    if (shouldSkipCompanyLabel(part.label) || isInvalidCompanyValue(part.value)) {
      return;
    }
    entries.push({
      label: part.label || null,
      name: part.value,
      address: (part.label && addressByLabel.get(part.label))
        || addressParts[index]?.value
        || null
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
    deduped.push(entry);
  });

  return deduped;
}

function splitCompanyValues(value) {
  return splitCompanyEntries(value).map((item) => item.name);
}

function splitCompanyAddressValues(value) {
  return splitPlainSegments(value);
}

module.exports = {
  normalizeText,
  splitCompanyEntries,
  splitCompanyValues,
  splitCompanyAddressValues,
  parseLabeledParts,
  isInvalidCompanyValue
};
