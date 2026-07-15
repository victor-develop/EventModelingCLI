import {
  Occurrence,
  DisplayEdge,
  DisplayNodeKind,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from './types';

const ANCHOR_STAGE_MAP: Record<DisplayNodeKind, number> = {
  role: 0,
  shared: 0,
  cmd: 1,
  evt: 2,
  viewModel: 3,
};

const STAGE_OFFSET: Record<DisplayNodeKind, number> = {
  role: 0,
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

  for (const occ of result) {
    occ.stageIndex = ANCHOR_STAGE_MAP[occ.nodeKind] ?? 0;
  }

  const anchorBase = ANCHOR_STAGE_MAP[anchor.nodeKind] ?? 0;
  for (const occ of result) {
    if (occ.canonicalNodeId === anchor.canonicalNodeId) {
      occ.stageIndex = anchorBase;
    }
  }

  for (let iteration = 0; iteration < result.length; iteration++) {
    let changed = false;
    for (const link of edgeOccLinks) {
      const from = byId.get(link.fromOccId);
      const to = byId.get(link.toOccId);
      if (!from || !to) continue;
      const nextStage = from.stageIndex + 1;
      if (to.stageIndex < nextStage) {
        to.stageIndex = nextStage;
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const occ of result) {
    occ.x = occ.stageIndex * config.stageGap;
  }

  return result;
}
