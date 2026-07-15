import type { SnapshotDirection } from '@em/viewer-contract/types';

export interface LayoutRequest {
  focus?: string;
  direction: SnapshotDirection;
  hops: number;
}

export const DEFAULT_LAYOUT_DIRECTION: SnapshotDirection = 'both';
export const DEFAULT_LAYOUT_HOPS = 2;
export const WALK_LAYOUT_HOPS = 3;

const DIRECTIONS = new Set<SnapshotDirection>(['forward', 'backward', 'both']);

export function defaultLayoutRequest(focus?: string): LayoutRequest {
  return {
    focus: normalizeFocus(focus),
    direction: DEFAULT_LAYOUT_DIRECTION,
    hops: DEFAULT_LAYOUT_HOPS,
  };
}

export function walkLayoutRequest(
  focus: string,
  direction: Extract<SnapshotDirection, 'forward' | 'backward'>,
): LayoutRequest {
  return {
    focus: normalizeFocus(focus),
    direction,
    hops: WALK_LAYOUT_HOPS,
  };
}

export function readLayoutRequestFromLocation(fallbackFocus?: string): LayoutRequest {
  const params = new URLSearchParams(window.location.search);
  const focus = normalizeFocus(params.get('focus') ?? undefined) ?? normalizeFocus(fallbackFocus);
  const direction = parseDirection(params.get('direction'));
  const hops = parseHops(params.get('hops'), direction);

  return { focus, direction, hops };
}

export function layoutRequestToApiSearchParams(request: LayoutRequest): URLSearchParams {
  const params = new URLSearchParams({
    direction: request.direction,
    hops: String(request.hops),
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

  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

function isDefaultLayoutRequest(request: LayoutRequest): boolean {
  return request.direction === DEFAULT_LAYOUT_DIRECTION && request.hops === DEFAULT_LAYOUT_HOPS;
}

function normalizeFocus(focus: string | undefined): string | undefined {
  const trimmed = focus?.trim();
  return trimmed || undefined;
}

function parseDirection(value: string | null): SnapshotDirection {
  if (value && DIRECTIONS.has(value as SnapshotDirection)) return value as SnapshotDirection;
  return DEFAULT_LAYOUT_DIRECTION;
}

function parseHops(value: string | null, direction: SnapshotDirection): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return direction === DEFAULT_LAYOUT_DIRECTION ? DEFAULT_LAYOUT_HOPS : WALK_LAYOUT_HOPS;
}
