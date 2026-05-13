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
import { buildOccurrences, mergeOccurrences, buildEdgeOccurrenceLinks, resetOccCounter } from './occurrence';
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

export class LayoutEngine {
  private config: LayoutConfig;

  constructor(config: LayoutConfig = DEFAULT_LAYOUT_CONFIG) {
    this.config = config;
  }

  initLayout(envelope: NormalizedPathEnvelope): LayoutState {
    resetOccCounter();
    resetDeCounter();

    let occurrences = buildOccurrences(envelope, 0, this.config);

    const laneOrder = computeLaneOrder(occurrences);
    const dynamicConfig = { ...this.config, laneBaseY: computeDynamicLaneBaseY(laneOrder) };

    const edgeOccLinks = buildEdgeOccurrenceLinks(envelope, occurrences);

    const anchorOcc = occurrences.find(o => o.canonicalNodeId === envelope.anchor.nodeId);
    const anchorOccId = anchorOcc?.occurrenceId ?? occurrences[0]?.occurrenceId ?? '';

    occurrences = assignStages(occurrences, edgeOccLinks as any, anchorOccId, dynamicConfig);

    const displayEdges: DisplayEdge[] = [];
    for (const link of edgeOccLinks) {
      displayEdges.push(semanticLift(link.originalEdgeType as any, link.originalEdgeId));
    }

    const renderedEdges: RenderedEdge[] = displayEdges.map((de, i) => ({
      displayEdgeId: de.displayEdgeId,
      fromOccurrenceId: edgeOccLinks[i]?.fromOccId ?? '',
      toOccurrenceId: edgeOccLinks[i]?.toOccId ?? '',
      kind: de.kind,
      points: [],
      meta: {},
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
    const newOccurrences = buildOccurrences(envelope, Object.keys(state.occurrences).length, this.config);
    const existingOccs = Object.values(state.occurrences);
    const { merged, added } = mergeOccurrences(newOccurrences, existingOccs);

    const laneOrder = computeLaneOrder(merged);
    const dynamicConfig = { ...this.config, laneBaseY: computeDynamicLaneBaseY(laneOrder) };

    const allEdgeLinks = buildEdgeOccurrenceLinks(envelope, merged);

    const anchorOcc = merged.find(o => o.occurrenceId === sourceOccurrenceId);
    const anchorId = anchorOcc?.occurrenceId ?? sourceOccurrenceId;

    const staged = assignStages(merged, allEdgeLinks as any, anchorId, dynamicConfig);
    const stagedAdded = staged.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const newDisplayEdges: DisplayEdge[] = [];
    const newRenderedEdges: RenderedEdge[] = [];
    for (const link of allEdgeLinks) {
      const isNew = added.some(a => a.occurrenceId === link.fromOccId || a.occurrenceId === link.toOccId);
      if (!isNew) continue;
      const de = semanticLift(link.originalEdgeType as any, link.originalEdgeId);
      newDisplayEdges.push(de);
      newRenderedEdges.push({
        displayEdgeId: de.displayEdgeId,
        fromOccurrenceId: link.fromOccId,
        toOccurrenceId: link.toOccId,
        kind: de.kind,
        points: [],
        meta: {},
      });
    }

    const stagedExisting = staged.filter(o => !added.some(a => a.occurrenceId === o.occurrenceId));
    const solved = solveLaneRows([...stagedExisting, ...stagedAdded], newRenderedEdges, dynamicConfig);

    const swimlaneRects = computeSwimlaneRects(solved);
    const realigned = realignOccurrencesToRects(solved, swimlaneRects);
    const solvedAdded = realigned.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const occMap: Record<string, Occurrence> = {};
    for (const o of realigned) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(newRenderedEdges, occMap, dynamicConfig);

    const updatedExisting: Occurrence[] = [];
    for (const o of realigned) {
      if (!added.some(a => a.occurrenceId === o.occurrenceId)) {
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

    const updatedSwimlaneRects = computeSwimlaneRects(Object.values(state.occurrences));
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
      viewportHint: { revealDirection: 'right' },
      updatedSwimlaneRects,
    };
  }

  prependExploreResult(
    state: LayoutState,
    sourceOccurrenceId: string,
    envelope: NormalizedPathEnvelope,
  ): LayoutPatch {
    const newOccurrences = buildOccurrences(envelope, Object.keys(state.occurrences).length, this.config);
    const existingOccs = Object.values(state.occurrences);
    const { merged, added } = mergeOccurrences(newOccurrences, existingOccs);

    const laneOrder = computeLaneOrder(merged);
    const dynamicConfig = { ...this.config, laneBaseY: computeDynamicLaneBaseY(laneOrder) };

    const allEdgeLinks = buildEdgeOccurrenceLinks(envelope, merged);

    const anchorOcc = merged.find(o => o.occurrenceId === sourceOccurrenceId);
    const anchorId = anchorOcc?.occurrenceId ?? sourceOccurrenceId;

    const staged = assignStages(merged, allEdgeLinks as any, anchorId, dynamicConfig);
    const stagedAdded = staged.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const newDisplayEdges: DisplayEdge[] = [];
    const newRenderedEdges: RenderedEdge[] = [];
    for (const link of allEdgeLinks) {
      const isNew = added.some(a => a.occurrenceId === link.fromOccId || a.occurrenceId === link.toOccId);
      if (!isNew) continue;
      const de = semanticLift(link.originalEdgeType as any, link.originalEdgeId);
      newDisplayEdges.push(de);
      newRenderedEdges.push({
        displayEdgeId: de.displayEdgeId,
        fromOccurrenceId: link.fromOccId,
        toOccurrenceId: link.toOccId,
        kind: de.kind,
        points: [],
        meta: {},
      });
    }

    const stagedExisting = staged.filter(o => !added.some(a => a.occurrenceId === o.occurrenceId));
    const solved = solveLaneRows([...stagedExisting, ...stagedAdded], newRenderedEdges, dynamicConfig);

    const swimlaneRects = computeSwimlaneRects(solved);
    const realigned = realignOccurrencesToRects(solved, swimlaneRects);
    const solvedAdded = realigned.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const occMap: Record<string, Occurrence> = {};
    for (const o of realigned) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(newRenderedEdges, occMap, dynamicConfig);

    const updatedExisting: Occurrence[] = [];
    for (const o of realigned) {
      if (!added.some(a => a.occurrenceId === o.occurrenceId)) {
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

    const updatedSwimlaneRects = computeSwimlaneRects(Object.values(state.occurrences));
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
      viewportHint: { revealDirection: 'left' },
      updatedSwimlaneRects,
    };
  }
}
