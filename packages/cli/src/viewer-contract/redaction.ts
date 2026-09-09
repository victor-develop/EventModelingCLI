const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_PATH_SEGMENT = /password|passwd|secret|token|api[_-]?key|x-api-key|private[_-]?key|credential/i;

export function redactDiffValue(value: unknown, path = ''): unknown {
  if (path && isSensitiveDiffPath(path)) return REDACTED_VALUE;
  if (Array.isArray(value)) {
    return value.map((item, index) => redactDiffValue(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
    const nextPath = appendRedactionPath(path, key);
    result[key] = isSensitiveDiffPath(nextPath) ? REDACTED_VALUE : redactDiffValue(item, nextPath);
    return result;
  }, {});
}

export function isSensitiveDiffPath(path: string): boolean {
  return path.split(/[.[\]]+/).some(isSensitivePathSegment);
}

function isSensitivePathSegment(segment: string): boolean {
  return (
    SENSITIVE_PATH_SEGMENT.test(segment)
    || /(?:^|[_-])key$/i.test(segment)
    || /[a-z0-9]Key$/.test(segment)
  );
}

function appendRedactionPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}
