import {
  NormalizedPathEnvelope,
  LayoutState,
  LayoutPatch,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  Occurrence,
  RenderedEdge,
  DisplayEdge,
  SwimlaneRect,
} from './types';
import { semanticLift, resetDeCounter } from './semantic-lift';
import {
  buildOccurrences,
  mergeOccurrences,
  buildEdgeOccurrenceLinks,
  mergeSameStageSharedOccurrences,
} from './occurrence';
import type { EdgeOccurrenceLink } from './occurrence';
import { assignStages } from './stage';
import { solveLaneRows } from './row-solver';
import { routeEdges } from './edge-router';

const LANE_ORDER_FALLBACK: string[] = ['nonRole', 'commandViewModel', 'event'];

const SWIMLANE_PAD_X = 40;
const SWIMLANE_PAD_Y = 30;
const INTER_LANE_GAP = 10;

function computeLaneOrder(occurrences: Occurrence[]): string[] {
  const lanes = new Set(occurrences.map(o => o.lane));
  const roleLanes = [...lanes].filter(l => l.startsWith('role:')).sort();
  const nonRole = lanes.has('nonRole') ? ['nonRole'] : [];
  const cmdVm = lanes.has('commandViewModel') ? ['commandViewModel'] : [];
  const evt = lanes.has('event') ? ['event'] : [];
  const ordered = [...roleLanes, ...nonRole, ...cmdVm, ...evt];
  return ordered.length > 0 ? ordered : LANE_ORDER_FALLBACK;
}

function computeDynamicLaneBaseY(laneOrder: string[]): Record<string, number> {
  const LANE_HEIGHT = 200;
  const result: Record<string, number> = {};
  for (let i = 0; i < laneOrder.length; i++) {
    const lane = laneOrder[i]!;
    result[lane] = i * LANE_HEIGHT;
  }
  return result;
}

function restoreExistingOccurrencePositions(
  occurrences: Occurrence[],
  added: Occurrence[],
  previous: Record<string, Occurrence>,
): Occurrence[] {
  const addedIds = new Set(added.map(o => o.occurrenceId));
  return occurrences.map((occ) => {
    if (addedIds.has(occ.occurrenceId)) return occ;
    const prev = previous[occ.occurrenceId];
    if (!prev) return occ;
    if (prev.lockLevel !== 'hard') return occ;
    return {
      ...occ,
      lane: prev.lane,
      stageIndex: prev.stageIndex,
      rowIndex: prev.rowIndex,
      lockLevel: prev.lockLevel,
      x: prev.x,
      y: prev.y,
      width: prev.width,
      height: prev.height,
    };
  });
}

function computeRectsContainingStableOccurrences(occurrences: Occurrence[]): SwimlaneRect[] {
  const rects = computeSwimlaneRects(occurrences);
  for (const rect of rects) {
    const laneOccurrences = occurrences.filter(o => o.lane === rect.lane);
    if (laneOccurrences.length === 0) continue;

    const minY = Math.min(...laneOccurrences.map(o => o.y));
    const maxY = Math.max(...laneOccurrences.map(o => o.y + o.height));
    const bottom = Math.max(rect.y + rect.height, maxY);
    if (rect.y > minY) {
      rect.y = minY;
      rect.height = bottom - minY;
    }
  }
  return rects;
}

export function computeSwimlaneRects(occurrences: Occurrence[]): SwimlaneRect[] {
  const laneOrder = computeLaneOrder(occurrences);
  const laneGroups = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const list = laneGroups.get(occ.lane) ?? [];
    list.push(occ);
    laneGroups.set(occ.lane, list);
  }

  const rects: SwimlaneRect[] = [];

  for (const lane of laneOrder) {
    const group = laneGroups.get(lane);
    if (!group || group.length === 0) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const occ of group) {
      if (occ.x < minX) minX = occ.x;
      if (occ.y < minY) minY = occ.y;
      if (occ.x + occ.width > maxX) maxX = occ.x + occ.width;
      if (occ.y + occ.height > maxY) maxY = occ.y + occ.height;
    }

    rects.push({
      lane,
      x: minX - SWIMLANE_PAD_X,
      y: minY - SWIMLANE_PAD_Y,
      width: maxX - minX + 2 * SWIMLANE_PAD_X,
      height: maxY - minY + 2 * SWIMLANE_PAD_Y,
    });
  }

  rects.sort((a, b) => {
    const ai = laneOrder.indexOf(a.lane);
    const bi = laneOrder.indexOf(b.lane);
    return ai - bi;
  });

  for (let i = 1; i < rects.length; i++) {
    const prevBottom = rects[i - 1]!.y + rects[i - 1]!.height + INTER_LANE_GAP;
    if (rects[i]!.y < prevBottom) {
      rects[i]!.y = prevBottom;
    }
  }

  return rects;
}

export function realignOccurrencesToRects(
  occurrences: Occurrence[],
  rects: SwimlaneRect[],
): Occurrence[] {
  const laneRectMap = new Map(rects.map(r => [r.lane, r]));
  const laneMinY = new Map<string, number>();
  for (const occ of occurrences) {
    const current = laneMinY.get(occ.lane);
    if (current === undefined || occ.y < current) {
      laneMinY.set(occ.lane, occ.y);
    }
  }

  const result = occurrences.map(o => ({ ...o }));
  for (const occ of result) {
    const rect = laneRectMap.get(occ.lane);
    const minY = laneMinY.get(occ.lane);
    if (!rect || minY === undefined) continue;

    const naturalRectY = minY - SWIMLANE_PAD_Y;
    const shift = rect.y - naturalRectY;
    if (shift > 0) {
      occ.y += shift;
    }
  }

  return result;
}

function maxOrdinalFromIds(ids: string[], prefix: string): number {
  let max = 0;
  const pattern = new RegExp(`^${prefix}_(\\d+)$`);
  for (const id of ids) {
    const match = id.match(pattern);
    if (!match?.[1]) continue;
    max = Math.max(max, Number(match[1]));
  }
  return max;
}

function assignExploreStages(
  occurrences: Occurrence[],
  edgeOccLinks: EdgeOccurrenceLink[],
  previous: Record<string, Occurrence>,
  sourceOccurrenceId: string,
  revealDirection: 'left' | 'right',
  config: LayoutConfig,
): Occurrence[] {
  const result = occurrences.map(o => ({ ...o }));
  const byId = new Map(result.map(o => [o.occurrenceId, o]));
  const fixedIds = new Set(Object.keys(previous));
  const assignedIds = new Set<string>();

  for (const occ of result) {
    const prev = previous[occ.occurrenceId];
    if (!prev) continue;
    occ.stageIndex = prev.stageIndex;
    assignedIds.add(occ.occurrenceId);
  }

  const sourceStage = previous[sourceOccurrenceId]?.stageIndex ?? 0;
  const setStage = (occurrenceId: string, stageIndex: number, mode: 'min' | 'max'): boolean => {
    const occ = byId.get(occurrenceId);
    if (!occ || fixedIds.has(occurrenceId)) return false;
    if (!assignedIds.has(occurrenceId)) {
      occ.stageIndex = stageIndex;
      assignedIds.add(occurrenceId);
      return true;
    }
    const nextStage = mode === 'max'
      ? Math.max(occ.stageIndex, stageIndex)
      : Math.min(occ.stageIndex, stageIndex);
    if (nextStage === occ.stageIndex) return false;
    occ.stageIndex = nextStage;
    return true;
  };

  const iterationLimit = Math.max(1, result.length * Math.max(1, edgeOccLinks.length));
  for (let iteration = 0; iteration < iterationLimit; iteration++) {
    let changed = false;
    for (const link of edgeOccLinks) {
      const from = byId.get(link.fromOccId);
      const to = byId.get(link.toOccId);
      if (!from || !to) continue;

      if (assignedIds.has(link.fromOccId)) {
        changed = setStage(link.toOccId, from.stageIndex + 1, 'max') || changed;
      }
      if (assignedIds.has(link.toOccId)) {
        changed = setStage(link.fromOccId, to.stageIndex - 1, 'min') || changed;
      }
    }
    if (!changed) break;
  }

  const fallbackStage = sourceStage + (revealDirection === 'right' ? 1 : -1);
  for (const occ of result) {
    if (!assignedIds.has(occ.occurrenceId)) {
      occ.stageIndex = fallbackStage;
    }
    occ.x = occ.stageIndex * config.stageGap;
  }

  return result;
}

function originalEdgeIdsFromState(displayEdges: Record<string, RenderedEdge>): Set<string> {
  const result = new Set<string>();
  for (const edge of Object.values(displayEdges)) {
    const originalEdgeId = edge.meta?.originalEdgeId;
    if (typeof originalEdgeId === 'string') {
      result.add(originalEdgeId);
    }
  }
  return result;
}

export class LayoutEngine {
  private config: LayoutConfig;

  constructor(config: LayoutConfig = DEFAULT_LAYOUT_CONFIG) {
    this.config = config;
  }

  initLayout(envelope: NormalizedPathEnvelope): LayoutState {
    resetDeCounter();

    let occurrences = buildOccurrences(envelope, 0, this.config);

    const laneOrder = computeLaneOrder(occurrences);
    const dynamicConfig = { ...this.config, laneBaseY: computeDynamicLaneBaseY(laneOrder) };

    let edgeOccLinks = buildEdgeOccurrenceLinks(envelope, occurrences);

    const anchorOcc = occurrences.find(o => o.canonicalNodeId === envelope.anchor.nodeId);
    const anchorOccId = anchorOcc?.occurrenceId ?? occurrences[0]?.occurrenceId ?? '';

    occurrences = assignStages(occurrences, edgeOccLinks as any, anchorOccId, dynamicConfig);
    ({ occurrences, edgeOccLinks } = mergeSameStageSharedOccurrences(occurrences, edgeOccLinks));

    const displayEdges: DisplayEdge[] = [];
    for (let i = 0; i < edgeOccLinks.length; i++) {
      const link = edgeOccLinks[i]!;
      displayEdges.push(semanticLift(link.originalEdgeType as any, link.originalEdgeId, `de_${i + 1}`));
    }

    const renderedEdges: RenderedEdge[] = displayEdges.map((de, i) => ({
      displayEdgeId: de.displayEdgeId,
      fromOccurrenceId: edgeOccLinks[i]?.fromOccId ?? '',
      toOccurrenceId: edgeOccLinks[i]?.toOccId ?? '',
      kind: de.kind,
      points: [],
      meta: {
        originalEdgeId: edgeOccLinks[i]?.originalEdgeId,
        originalEdgeType: edgeOccLinks[i]?.originalEdgeType,
      },
    }));

    occurrences = solveLaneRows(occurrences, renderedEdges, dynamicConfig);

    const swimlaneRects = computeSwimlaneRects(occurrences);
    occurrences = realignOccurrencesToRects(occurrences, swimlaneRects);

    const occMap: Record<string, Occurrence> = {};
    for (const o of occurrences) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(renderedEdges, occMap, this.config);
    const edgeMap: Record<string, RenderedEdge> = {};
    for (const e of routedEdges) edgeMap[e.displayEdgeId] = e;

    const stageBuckets: Record<number, string[]> = {};
    for (const o of occurrences) {
      const bucket = stageBuckets[o.stageIndex];
      if (bucket) bucket.push(o.occurrenceId);
      else stageBuckets[o.stageIndex] = [o.occurrenceId];
    }

    const stages = occurrences.map(o => o.stageIndex);
    const minStage = Math.min(...stages);
    const maxStage = Math.max(...stages);

    return {
      occurrences: occMap,
      displayEdges: edgeMap,
      stageBuckets,
      laneRows: {},
      locks: {},
      frontierHandles: {},
      viewport: {
        minStage,
        maxStage,
        zoom: 1,
        centerX: ((minStage + maxStage) / 2) * this.config.stageGap,
        centerY: 300,
      },
      swimlaneRects,
    };
  }

  appendExploreResult(
    state: LayoutState,
    sourceOccurrenceId: string,
    envelope: NormalizedPathEnvelope,
  ): LayoutPatch {
    return this.exploreResult(state, sourceOccurrenceId, envelope, 'right');
  }

  prependExploreResult(
    state: LayoutState,
    sourceOccurrenceId: string,
    envelope: NormalizedPathEnvelope,
  ): LayoutPatch {
    return this.exploreResult(state, sourceOccurrenceId, envelope, 'left');
  }

  private exploreResult(
    state: LayoutState,
    sourceOccurrenceId: string,
    envelope: NormalizedPathEnvelope,
    revealDirection: 'left' | 'right',
  ): LayoutPatch {
    const occurrenceOffset = maxOrdinalFromIds(Object.keys(state.occurrences), 'occ');
    const sourceOccurrence = state.occurrences[sourceOccurrenceId];
    const incomingOccurrences = buildOccurrences(envelope, occurrenceOffset, this.config);
    const existingOccs = Object.values(state.occurrences);
    const newOccurrences = sourceOccurrence
      ? incomingOccurrences.filter((occurrence) => !(
        occurrence.canonicalNodeId === sourceOccurrence.canonicalNodeId &&
        occurrence.displayRole === sourceOccurrence.displayRole
      ))
      : incomingOccurrences;
    const { merged, added } = mergeOccurrences(newOccurrences, existingOccs);

    const laneOrder = computeLaneOrder(merged);
    const dynamicConfig = { ...this.config, laneBaseY: computeDynamicLaneBaseY(laneOrder) };

    let allEdgeLinks = buildEdgeOccurrenceLinks(envelope, merged);

    const anchorOcc = merged.find(o => o.occurrenceId === sourceOccurrenceId);
    const anchorId = anchorOcc?.occurrenceId ?? sourceOccurrenceId;

    const staged = assignExploreStages(
      merged,
      allEdgeLinks,
      state.occurrences,
      anchorId,
      revealDirection,
      dynamicConfig,
    );
    const compacted = mergeSameStageSharedOccurrences(staged, allEdgeLinks);
    allEdgeLinks = compacted.edgeOccLinks;
    const compactedOccurrences = compacted.occurrences;
    const addedAfterCompaction = added.filter(a => !compacted.removedOccurrenceIds.includes(a.occurrenceId));
    const stagedAdded = compactedOccurrences.filter(o => addedAfterCompaction.some(a => a.occurrenceId === o.occurrenceId));
    const existingOriginalEdgeIds = originalEdgeIdsFromState(state.displayEdges);

    const newRenderedEdges: RenderedEdge[] = [];
    let edgeOrdinal = maxOrdinalFromIds(Object.keys(state.displayEdges), 'de');
    for (const link of allEdgeLinks) {
      const isNew = !existingOriginalEdgeIds.has(link.originalEdgeId);
      if (!isNew) continue;
      edgeOrdinal += 1;
      const de = semanticLift(link.originalEdgeType as any, link.originalEdgeId, `de_${edgeOrdinal}`);
      newRenderedEdges.push({
        displayEdgeId: de.displayEdgeId,
        fromOccurrenceId: link.fromOccId,
        toOccurrenceId: link.toOccId,
        kind: de.kind,
        points: [],
        meta: {
          originalEdgeId: link.originalEdgeId,
          originalEdgeType: link.originalEdgeType,
        },
      });
    }

    const stagedExisting = compactedOccurrences.filter(o => !addedAfterCompaction.some(a => a.occurrenceId === o.occurrenceId));
    const solved = solveLaneRows([...stagedExisting, ...stagedAdded], newRenderedEdges, dynamicConfig);

    const swimlaneRects = computeSwimlaneRects(solved);
    const realigned = realignOccurrencesToRects(solved, swimlaneRects);
    const stableRealigned = restoreExistingOccurrencePositions(realigned, addedAfterCompaction, state.occurrences);
    const solvedAdded = stableRealigned.filter(o => addedAfterCompaction.some(a => a.occurrenceId === o.occurrenceId));

    const occMap: Record<string, Occurrence> = {};
    for (const o of stableRealigned) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(newRenderedEdges, occMap, dynamicConfig);

    const updatedExisting: Occurrence[] = [];
    for (const o of stableRealigned) {
      if (!addedAfterCompaction.some(a => a.occurrenceId === o.occurrenceId)) {
        const prev = state.occurrences[o.occurrenceId];
        if (prev && (prev.x !== o.x || prev.y !== o.y || prev.stageIndex !== o.stageIndex || prev.rowIndex !== o.rowIndex)) {
          updatedExisting.push(o);
        }
      }
      state.occurrences[o.occurrenceId] = o;
    }
    for (const e of routedEdges) {
      state.displayEdges[e.displayEdgeId] = e;
    }

    const updatedSwimlaneRects = computeRectsContainingStableOccurrences(Object.values(state.occurrences));
    state.swimlaneRects = updatedSwimlaneRects;

    const allStages = Object.values(state.occurrences).map(o => o.stageIndex);
    const minStage = Math.min(...allStages);
    const maxStage = Math.max(...allStages);

    return {
      addedOccurrences: solvedAdded,
      updatedOccurrences: updatedExisting,
      addedEdges: routedEdges,
      updatedEdges: [],
      updatedStageRange: { min: minStage, max: maxStage },
      viewportHint: { revealDirection },
      updatedSwimlaneRects,
    };
  }
}
