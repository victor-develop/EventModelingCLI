import {
  NormalizedPathEnvelope,
  LayoutState,
  LayoutPatch,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  Occurrence,
  RenderedEdge,
  DisplayEdge,
  toDisplayNodeKind,
} from './types';
import { semanticLift, resetDeCounter } from './semantic-lift';
import { buildOccurrences, mergeOccurrences, buildEdgeOccurrenceLinks, resetOccCounter } from './occurrence';
import { assignStages } from './stage';
import { solveLaneRows } from './row-solver';
import { routeEdges } from './edge-router';

export class LayoutEngine {
  private config: LayoutConfig;

  constructor(config: LayoutConfig = DEFAULT_LAYOUT_CONFIG) {
    this.config = config;
  }

  initLayout(envelope: NormalizedPathEnvelope): LayoutState {
    resetOccCounter();
    resetDeCounter();

    let occurrences = buildOccurrences(envelope, 0, this.config);

    const edgeOccLinks = buildEdgeOccurrenceLinks(envelope, occurrences);

    const anchorOcc = occurrences.find(o => o.canonicalNodeId === envelope.anchor.nodeId);
    const anchorOccId = anchorOcc?.occurrenceId ?? occurrences[0]?.occurrenceId ?? '';

    occurrences = assignStages(occurrences, edgeOccLinks as any, anchorOccId, this.config);

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

    occurrences = solveLaneRows(occurrences, renderedEdges, this.config);

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

    const allEdgeLinks = buildEdgeOccurrenceLinks(envelope, merged);

    const anchorOcc = merged.find(o => o.occurrenceId === sourceOccurrenceId);
    const anchorId = anchorOcc?.occurrenceId ?? sourceOccurrenceId;

    const staged = assignStages(merged, allEdgeLinks as any, anchorId, this.config);
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

    const allOccs = Object.values(state.occurrences).concat(stagedAdded);
    const solved = solveLaneRows(allOccs, newRenderedEdges, this.config);
    const solvedAdded = solved.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const occMap: Record<string, Occurrence> = {};
    for (const o of solved) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(newRenderedEdges, occMap, this.config);

    for (const o of stagedAdded) {
      state.occurrences[o.occurrenceId] = o;
    }
    for (const e of routedEdges) {
      state.displayEdges[e.displayEdgeId] = e;
    }

    const allStages = Object.values(state.occurrences).map(o => o.stageIndex);
    const minStage = Math.min(...allStages);
    const maxStage = Math.max(...allStages);

    return {
      addedOccurrences: solvedAdded,
      updatedOccurrences: [],
      addedEdges: routedEdges,
      updatedEdges: [],
      updatedStageRange: { min: minStage, max: maxStage },
      viewportHint: { revealDirection: 'right' },
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

    const allEdgeLinks = buildEdgeOccurrenceLinks(envelope, merged);

    const anchorOcc = merged.find(o => o.occurrenceId === sourceOccurrenceId);
    const anchorId = anchorOcc?.occurrenceId ?? sourceOccurrenceId;

    const staged = assignStages(merged, allEdgeLinks as any, anchorId, this.config);
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

    const allOccs = Object.values(state.occurrences).concat(stagedAdded);
    const solved = solveLaneRows(allOccs, newRenderedEdges, this.config);
    const solvedAdded = solved.filter(o => added.some(a => a.occurrenceId === o.occurrenceId));

    const occMap: Record<string, Occurrence> = {};
    for (const o of solved) occMap[o.occurrenceId] = o;

    const routedEdges = routeEdges(newRenderedEdges, occMap, this.config);

    for (const o of stagedAdded) {
      state.occurrences[o.occurrenceId] = o;
    }
    for (const e of routedEdges) {
      state.displayEdges[e.displayEdgeId] = e;
    }

    const allStages = Object.values(state.occurrences).map(o => o.stageIndex);
    const minStage = Math.min(...allStages);
    const maxStage = Math.max(...allStages);

    return {
      addedOccurrences: solvedAdded,
      updatedOccurrences: [],
      addedEdges: routedEdges,
      updatedEdges: [],
      updatedStageRange: { min: minStage, max: maxStage },
      viewportHint: { revealDirection: 'left' },
    };
  }
}
