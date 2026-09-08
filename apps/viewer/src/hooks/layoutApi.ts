import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import type { LayoutRequest } from './layoutRequest';
import { layoutRequestToApiSearchParams } from './layoutRequest';

export function fetchLayout(request: LayoutRequest): Promise<VisualizationSnapshot> {
  const params = layoutRequestToApiSearchParams(request);
  return fetch(`/api/layout?${params.toString()}`).then(async r => {
    if (!r.ok) {
      const body = await r.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
    }
    return r.json() as Promise<VisualizationSnapshot>;
  });
}
