import {
  Occurrence,
  DisplayEdge,
  DisplayNodeKind,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from './types';

const ANCHOR_STAGE_MAP: Record<DisplayNodeKind, number> = {
  shared: 0,
  cmd: 1,
  evt: 2,
  viewModel: 3,
};

const STAGE_OFFSET: Record<DisplayNodeKind, number> = {
  shared: 0,
  cmd: 1,
  evt: 2,
  viewModel: 3,
};

interface EdgeOccLink {
  fromOccId: string;
  toOccId: string;
  displayEdge?: DisplayEdge;
  kind?: string;
}

export function assignStages(
  occurrences: Occurrence[],
  edgeOccLinks: EdgeOccLink[],
  anchorOccId: string,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Occurrence[] {
  const result = occurrences.map(o => ({ ...o }));
  const byId = new Map(result.map(o => [o.occurrenceId, o]));

  const anchor = byId.get(anchorOccId);
  if (!anchor) return result;

  const anchorBase = Math.floor(ANCHOR_STAGE_MAP[anchor.nodeKind]);
  anchor.stageIndex = anchorBase;

  const adjacency = new Map<string, Array<{ neighborId: string; direction: 'forward' | 'backward' }>>();
  for (const link of edgeOccLinks) {
    if (!adjacency.has(link.fromOccId)) adjacency.set(link.fromOccId, []);
    if (!adjacency.has(link.toOccId)) adjacency.set(link.toOccId, []);
    adjacency.get(link.fromOccId)!.push({ neighborId: link.toOccId, direction: 'forward' });
    adjacency.get(link.toOccId)!.push({ neighborId: link.fromOccId, direction: 'backward' });
  }

  const visited = new Set<string>();
  visited.add(anchorOccId);

  const queue: string[] = [anchorOccId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const current = byId.get(currentId);
    if (!current) continue;

    const neighbors = adjacency.get(currentId) ?? [];
    for (const { neighborId, direction } of neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);

      const neighbor = byId.get(neighborId);
      if (!neighbor) continue;

      if (direction === 'forward') {
        neighbor.stageIndex = current.stageIndex + 1;
      } else {
        neighbor.stageIndex = current.stageIndex - 1;
      }

      queue.push(neighborId);
    }
  }

  for (const occ of result) {
    if (!visited.has(occ.occurrenceId)) {
      occ.stageIndex = ANCHOR_STAGE_MAP[occ.nodeKind] ?? 0;
    }
    occ.x = occ.stageIndex * config.stageGap;
  }

  return result;
}
