import {
  Occurrence,
  RenderedEdge,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  LockLevel,
} from './types';

export function solveLaneRows(
  occurrences: Occurrence[],
  edges: RenderedEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Occurrence[] {
  const result = occurrences.map(o => ({ ...o }));

  const groups = new Map<string, Occurrence[]>();
  for (const occ of result) {
    const key = `${occ.lane}:${occ.stageIndex}`;
    const list = groups.get(key) ?? [];
    list.push(occ);
    groups.set(key, list);
  }

  const edgeMap = new Map<string, RenderedEdge[]>();
  for (const e of edges) {
    const list = edgeMap.get(e.fromOccurrenceId) ?? [];
    list.push(e);
    edgeMap.set(e.fromOccurrenceId, list);
  }

  for (const [, group] of groups) {
    const locked = group.filter(o => o.lockLevel === 'hard');
    const free = group.filter(o => o.lockLevel !== 'hard');

    locked.sort((a, b) => a.rowIndex - b.rowIndex);

    const usedRows = new Set(locked.map(o => o.rowIndex));
    let nextRow = 0;

    for (const lockedOcc of locked) {
      if (lockedOcc.rowIndex >= nextRow) {
        nextRow = lockedOcc.rowIndex + 1;
      }
    }

    const byBary = free.map(occ => {
      const outEdges = edgeMap.get(occ.occurrenceId) ?? [];
      const inEdges = edges.filter(e => e.toOccurrenceId === occ.occurrenceId);

      let barycenter = 0;
      let count = 0;

      for (const e of outEdges) {
        const target = result.find(o => o.occurrenceId === e.toOccurrenceId);
        if (target && target.rowIndex >= 0) {
          barycenter += target.rowIndex;
          count++;
        }
      }

      for (const e of inEdges) {
        const source = result.find(o => o.occurrenceId === e.fromOccurrenceId);
        if (source && source.rowIndex >= 0) {
          barycenter += source.rowIndex;
          count++;
        }
      }

      return { occ, barycenter: count > 0 ? barycenter / count : 0 };
    });

    byBary.sort((a, b) => {
      if (a.barycenter !== b.barycenter) return a.barycenter - b.barycenter;
      return a.occ.canonicalNodeId.localeCompare(b.occ.canonicalNodeId);
    });

    for (const { occ } of byBary) {
      while (usedRows.has(nextRow)) nextRow++;
      occ.rowIndex = nextRow;
      usedRows.add(nextRow);
      nextRow++;
    }
  }

  for (const occ of result) {
    if (occ.rowIndex < 0) occ.rowIndex = 0;
    occ.y = (config.laneBaseY[occ.lane] ?? 0) + occ.rowIndex * config.rowGap;
  }

  return result;
}
