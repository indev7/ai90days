const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeSpec = (spec) => {
  if (Array.isArray(spec)) {
    return spec.length > 0 ? spec[0] : {};
  }
  return spec || {};
};

const trimValue = (value, spec) => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    const itemSpec = normalizeSpec(spec);
    return value.map((item) => trimValue(item, itemSpec));
  }

  if (isPlainObject(value)) {
    const nextSpec = normalizeSpec(spec);
    const result = {};
    Object.entries(nextSpec).forEach(([key, childSpec]) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        result[key] = childSpec === true ? value[key] : trimValue(value[key], childSpec);
      }
    });
    return result;
  }

  return value;
};

/**
 * Selectively trims a mainTree section using a field spec.
 * @param {string} sectionName - mainTree section key (e.g., "myOKRTs").
 * @param {Object|Array|boolean} fieldSpec - Shape describing which fields to keep.
 * @param {Object} mainTree - Full mainTree object.
 * @returns {Object|Array|null} Trimmed section data.
 */
export function selectMainTreeSection(sectionName, fieldSpec, mainTree) {
  if (!sectionName || !mainTree || !Object.prototype.hasOwnProperty.call(mainTree, sectionName)) {
    return null;
  }

  return trimValue(mainTree[sectionName], fieldSpec);
}

const DOT_PATH_SEGMENT_RE = /^[A-Za-z0-9_]+(\[\])?$/;

const isValidDotPath = (path) => {
  if (typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed) return false;
  const segments = trimmed.split('.');
  if (segments.length === 0) return false;
  if (segments[segments.length - 1].endsWith('[]')) return false;
  return segments.every((segment) => DOT_PATH_SEGMENT_RE.test(segment));
};

const addPathToSpec = (spec, path) => {
  const segments = path.split('.');
  let cursor = spec;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const isArray = segment.endsWith('[]');
    const key = isArray ? segment.slice(0, -2) : segment;
    if (!key) return;

    const isLast = i === segments.length - 1;
    if (isLast) {
      if (isArray) return;
      cursor[key] = true;
      return;
    }

    if (isArray) {
      if (!Array.isArray(cursor[key])) cursor[key] = [{}];
      if (!cursor[key][0] || typeof cursor[key][0] !== 'object' || Array.isArray(cursor[key][0])) {
        cursor[key][0] = {};
      }
      cursor = cursor[key][0];
      continue;
    }

    if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
};

export function buildFieldSpecFromPaths(paths = []) {
  if (!Array.isArray(paths)) return {};
  const spec = {};
  for (const rawPath of paths) {
    if (!isValidDotPath(rawPath)) continue;
    const trimmed = rawPath.trim();
    addPathToSpec(spec, trimmed);
  }
  return spec;
}

export function selectMainTreeSectionByPaths(sectionName, paths, mainTree) {
  const fieldSpec = buildFieldSpecFromPaths(paths);
  if (!fieldSpec || Object.keys(fieldSpec).length === 0) return null;
  return selectMainTreeSection(sectionName, fieldSpec, mainTree);
}
