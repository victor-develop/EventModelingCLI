const DIFF_CHANGE_PARAM = 'diffChange';

export function readDiffSelectionFromLocation(): string[] {
  return normalizedChangeIds(new URLSearchParams(window.location.search).getAll(DIFF_CHANGE_PARAM));
}

export function writeDiffSelectionToLocation(
  changeIds: string[],
  mode: 'push' | 'replace' = 'push',
): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(DIFF_CHANGE_PARAM);
  for (const changeId of normalizedChangeIds(changeIds)) {
    url.searchParams.append(DIFF_CHANGE_PARAM, changeId);
  }

  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

function normalizedChangeIds(changeIds: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const changeId of changeIds) {
    const trimmed = changeId.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}
