import type { SnapshotDirection } from '@em/viewer-contract/types';

export interface LayoutRequest {
  focus?: string;
  direction: SnapshotDirection;
  hops: number;
  includeTruncatedPaths: boolean;
}

export const DEFAULT_LAYOUT_DIRECTION: SnapshotDirection = 'both';
export const DEFAULT_LAYOUT_HOPS = 2;
export const WALK_LAYOUT_HOPS = 3;
export const MIN_LAYOUT_HOPS = 1;
export const DEFAULT_MAX_LAYOUT_HOPS = 6;

const DIRECTIONS = new Set<SnapshotDirection>(['forward', 'backward', 'both']);

export function defaultLayoutRequest(focus?: string): LayoutRequest {
  return {
    focus: normalizeFocus(focus),
    direction: DEFAULT_LAYOUT_DIRECTION,
    hops: DEFAULT_LAYOUT_HOPS,
    includeTruncatedPaths: false,
  };
}

export function walkLayoutRequest(
  focus: string,
  direction: Extract<SnapshotDirection, 'forward' | 'backward'>,
  hops: number = WALK_LAYOUT_HOPS,
  includeTruncatedPaths = false,
  maxHops: number = DEFAULT_MAX_LAYOUT_HOPS,
): LayoutRequest {
  return {
    focus: normalizeFocus(focus),
    direction,
    hops: clampLayoutHops(hops, maxHops),
    includeTruncatedPaths,
  };
}

export function readLayoutRequestFromLocation(
  fallbackFocus?: string,
  maxHops: number = DEFAULT_MAX_LAYOUT_HOPS,
): LayoutRequest {
  const params = new URLSearchParams(window.location.search);
  const focus = normalizeFocus(params.get('focus') ?? undefined) ?? normalizeFocus(fallbackFocus);
  const direction = parseDirection(params.get('direction'));
  const hops = parseHops(params.get('hops'), direction, maxHops);
  const includeTruncatedPaths = parseBoolean(params.get('includeTruncatedPaths'));

  return { focus, direction, hops, includeTruncatedPaths };
}

export function layoutRequestToApiSearchParams(request: LayoutRequest): URLSearchParams {
  const params = new URLSearchParams({
    direction: request.direction,
    hops: String(request.hops),
    includeTruncatedPaths: String(request.includeTruncatedPaths),
  });
  if (request.focus) params.set('focus', request.focus);
  return params;
}

export function writeLayoutRequestToLocation(
  request: LayoutRequest,
  mode: 'push' | 'replace' = 'replace',
): void {
  const url = new URL(window.location.href);

  if (request.focus) url.searchParams.set('focus', request.focus);
  else url.searchParams.delete('focus');

  if (isDefaultLayoutRequest(request)) {
    url.searchParams.delete('direction');
    url.searchParams.delete('hops');
  } else {
    url.searchParams.set('direction', request.direction);
    url.searchParams.set('hops', String(request.hops));
  }

  if (request.includeTruncatedPaths) url.searchParams.set('includeTruncatedPaths', 'true');
  else url.searchParams.delete('includeTruncatedPaths');

  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

function isDefaultLayoutRequest(request: LayoutRequest): boolean {
  return request.direction === DEFAULT_LAYOUT_DIRECTION &&
    request.hops === DEFAULT_LAYOUT_HOPS &&
    !request.includeTruncatedPaths;
}

function normalizeFocus(focus: string | undefined): string | undefined {
  const trimmed = focus?.trim();
  return trimmed || undefined;
}

function parseDirection(value: string | null): SnapshotDirection {
  if (value && DIRECTIONS.has(value as SnapshotDirection)) return value as SnapshotDirection;
  return DEFAULT_LAYOUT_DIRECTION;
}

function parseHops(value: string | null, direction: SnapshotDirection, maxHops: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return clampLayoutHops(parsed, maxHops);
  return direction === DEFAULT_LAYOUT_DIRECTION ? DEFAULT_LAYOUT_HOPS : WALK_LAYOUT_HOPS;
}

function parseBoolean(value: string | null): boolean {
  return value === 'true' || value === '1';
}

export function clampLayoutHops(value: number, maxHops: number = DEFAULT_MAX_LAYOUT_HOPS): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYOUT_HOPS;
  const normalizedMax = Math.max(MIN_LAYOUT_HOPS, Math.round(maxHops));
  return Math.min(normalizedMax, Math.max(MIN_LAYOUT_HOPS, Math.round(value)));
}
