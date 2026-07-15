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
  PathNode,
  PathEdge,
  toRoleDisplayLane,
} from './types';
import {
  computeLaneBaseY,
  computeLaneOrder,
  computePackedSwimlaneRects,
  realignOccurrencesToRects,
} from './lane-geometry';
import { semanticLift, semanticLiftOverride, resetDeCounter } from './semantic-lift';
import {
  buildOccurrenceModel,
  mergeOccurrences,
  buildEdgeOccurrenceLinks,
  mergeSameStageSharedOccurrences,
} from './occurrence';
import type { EdgeOccurrenceLink } from './occurrence';
import { assignStages } from './stage';
import { solveLaneRows } from './row-solver';
import { routeEdges } from './edge-router';

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
  return computePackedSwimlaneRects({
    occurrences,
    laneOrder: computeLaneOrder(occurrences),
  });
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

function renderedEdgeKeysFromState(displayEdges: Record<string, RenderedEdge>): Set<string> {
  const result = new Set<string>();
  for (const edge of Object.values(displayEdges)) {
    result.add(renderedEdgeKey({
      fromOccId: edge.fromOccurrenceId,
      toOccId: edge.toOccurrenceId,
      originalEdgeId: typeof edge.meta?.originalEdgeId === 'string' ? edge.meta.originalEdgeId : edge.displayEdgeId,
      originalEdgeType: typeof edge.meta?.originalEdgeType === 'string' ? edge.meta.originalEdgeType : edge.kind,
    }));
  }
  return result;
}

function renderedEdgeKey(link: EdgeOccurrenceLink): string {
  return [
    link.fromOccId,
    link.toOccId,
    link.originalEdgeId,
    link.originalEdgeType,
  ].join('\u0000');
}

function semanticLiftEdgeOccurrenceLink(link: EdgeOccurrenceLink, displayEdgeId: string): DisplayEdge {
  if (link.displayEdgeKind) {
    return semanticLiftOverride({
      displayEdgeId,
      kind: link.displayEdgeKind,
      fromNodeKind: link.displayFromNodeKind ?? 'shared',
      toNodeKind: link.displayToNodeKind ?? 'shared',
      originalEdgeId: link.originalEdgeId,
      originalEdgeType: link.originalEdgeType,
    });
  }

  return semanticLift(link.originalEdgeType as any, link.originalEdgeId, displayEdgeId);
}

function nextOccurrenceId(counter: { value: number }): string {
  counter.value += 1;
  return `occ_${counter.value}`;
}

function addRoleMarkerOccurrences(args: {
  envelope: NormalizedPathEnvelope;
  occurrences: Occurrence[];
  edgeOccLinks: EdgeOccurrenceLink[];
  pathOccurrenceIds: Map<PathNode, string>;
  occurrenceCounter: { value: number };
  config: LayoutConfig;
}): { occurrences: Occurrence[]; edgeOccLinks: EdgeOccurrenceLink[] } {
  const occurrences = [...args.occurrences];
  const edgeOccLinks = [...args.edgeOccLinks];
  const seenMarkers = new Set<string>();

  for (const branch of args.envelope.branches) {
    const path = branch.path;
    for (let index = 1; index < path.length - 1; index++) {
      const edge = path[index];
      if (edge?.type !== 'edge' || edge.edgeType !== 'roleIssuesCommand') continue;

      const roleNodeId = edge.roleNodeId;
      const surfaceNodeId = edge.surfaceNodeId;
      if (!roleNodeId || !surfaceNodeId) continue;

      const surfacePathNode = findAdjacentSurfacePathNode(path, index, edge, surfaceNodeId);
      if (!surfacePathNode) continue;

      const surfaceOccId = args.pathOccurrenceIds.get(surfacePathNode);
      if (!surfaceOccId) continue;
      const markerKey = [roleNodeId, surfaceOccId, edge.edgeId].join('\u0000');
      if (seenMarkers.has(markerKey)) continue;
      seenMarkers.add(markerKey);

      const markerOccurrenceId = nextOccurrenceId(args.occurrenceCounter);
      occurrences.push({
        occurrenceId: markerOccurrenceId,
        canonicalNodeId: roleNodeId,
        nodeKind: 'role',
        lane: toRoleDisplayLane(roleNodeId),
        stageIndex: 0,
        rowIndex: -1,
        displayRole: 'role',
        branchClusterId: `${branch.branchId}:role:${edge.edgeId}:${index}`,
        lockLevel: 'free',
        x: 0,
        y: 0,
        width: args.config.nodeWidth,
        height: args.config.nodeHeight,
      });
      edgeOccLinks.push({
        fromOccId: markerOccurrenceId,
        toOccId: surfaceOccId,
        originalEdgeId: edge.edgeId,
        originalEdgeType: edge.edgeType,
        displayEdgeKind: 'role-to-shared',
        displayFromNodeKind: 'role',
        displayToNodeKind: 'shared',
      });
    }
  }

  return { occurrences, edgeOccLinks };
}

function findAdjacentSurfacePathNode(
  path: NormalizedPathEnvelope['branches'][number]['path'],
  edgeIndex: number,
  edge: PathEdge,
  surfaceNodeId: string,
): PathNode | undefined {
  const previous = path[edgeIndex - 1];
  const next = path[edgeIndex + 1];
  const candidate = edge.displayDirection === 'backward' ? next : previous;
  if (candidate?.type === 'node' && candidate.nodeId === surfaceNodeId) return candidate;
  if (previous?.type === 'node' && previous.nodeId === surfaceNodeId) return previous;
  if (next?.type === 'node' && next.nodeId === surfaceNodeId) return next;
  return undefined;
}

function finalOccurrenceMergeKey(occurrence: Occurrence): string {
  return [
    occurrence.canonicalNodeId,
    occurrence.nodeKind,
    occurrence.stageIndex,
    occurrence.lane,
    occurrence.displayRole,
    occurrence.displayRole === 'role' ? occurrence.branchClusterId : '',
  ].join('\u0000');
}

function remapEdgeOccurrenceLinks(
  edgeOccLinks: EdgeOccurrenceLink[],
  occurrenceIdRemap: Map<string, string>,
): EdgeOccurrenceLink[] {
  if (occurrenceIdRemap.size === 0) return edgeOccLinks;

  const result: EdgeOccurrenceLink[] = [];
  const seen = new Set<string>();
  for (const link of edgeOccLinks) {
    const remapped = {
      ...link,
      fromOccId: occurrenceIdRemap.get(link.fromOccId) ?? link.fromOccId,
      toOccId: occurrenceIdRemap.get(link.toOccId) ?? link.toOccId,
    };
    const key = renderedEdgeKey(remapped);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(remapped);
  }

  return result;
}

function mergeFinalDuplicateOccurrences(
  occurrences: Occurrence[],
  edgeOccLinks: EdgeOccurrenceLink[],
  previous: Record<string, Occurrence>,
): { occurrences: Occurrence[]; edgeOccLinks: EdgeOccurrenceLink[]; removedOccurrenceIds: string[] } {
  const keptOccurrenceIdByKey = new Map<string, string>();
  for (const occurrence of Object.values(previous)) {
    keptOccurrenceIdByKey.set(finalOccurrenceMergeKey(occurrence), occurrence.occurrenceId);
  }

  const occurrenceIdRemap = new Map<string, string>();
  const removedOccurrenceIds: string[] = [];
  const merged: Occurrence[] = [];

  for (const occurrence of occurrences) {
    const key = finalOccurrenceMergeKey(occurrence);
    const keptOccurrenceId = keptOccurrenceIdByKey.get(key);
    if (keptOccurrenceId && keptOccurrenceId !== occurrence.occurrenceId) {
      occurrenceIdRemap.set(occurrence.occurrenceId, keptOccurrenceId);
      removedOccurrenceIds.push(occurrence.occurrenceId);
      continue;
    }

    keptOccurrenceIdByKey.set(key, occurrence.occurrenceId);
    merged.push(occurrence);
  }

  return {
    occurrences: merged,
    edgeOccLinks: remapEdgeOccurrenceLinks(edgeOccLinks, occurrenceIdRemap),
    removedOccurrenceIds,
  };
}

function mergeDuplicateRoleMarkers(
  occurrences: Occurrence[],
  edgeOccLinks: EdgeOccurrenceLink[],
): { occurrences: Occurrence[]; edgeOccLinks: EdgeOccurrenceLink[]; removedOccurrenceIds: string[] } {
  const roleMarkerTargetById = new Map<string, EdgeOccurrenceLink>();
  for (const link of edgeOccLinks) {
    if (link.displayEdgeKind !== 'role-to-shared') continue;
    roleMarkerTargetById.set(link.fromOccId, link);
  }

  const keptOccurrenceIdByKey = new Map<string, string>();
  const occurrenceIdRemap = new Map<string, string>();
  const removedOccurrenceIds: string[] = [];
  const merged: Occurrence[] = [];

  for (const occurrence of occurrences) {
    if (occurrence.displayRole !== 'role') {
      merged.push(occurrence);
      continue;
    }

    const markerLink = roleMarkerTargetById.get(occurrence.occurrenceId);
    if (!markerLink) {
      merged.push(occurrence);
      continue;
    }

    const key = [
      occurrence.canonicalNodeId,
      occurrence.lane,
      markerLink.toOccId,
      markerLink.originalEdgeId,
    ].join('\u0000');
    const keptOccurrenceId = keptOccurrenceIdByKey.get(key);
    if (keptOccurrenceId) {
      occurrenceIdRemap.set(occurrence.occurrenceId, keptOccurrenceId);
      removedOccurrenceIds.push(occurrence.occurrenceId);
      continue;
    }

    keptOccurrenceIdByKey.set(key, occurrence.occurrenceId);
    merged.push(occurrence);
  }

  return {
    occurrences: merged,
    edgeOccLinks: remapEdgeOccurrenceLinks(edgeOccLinks, occurrenceIdRemap),
    removedOccurrenceIds,
  };
}

function bindExploreSourcePathOccurrences(
  envelope: NormalizedPathEnvelope,
  pathOccurrenceIds: Map<PathNode, string>,
  sourceOccurrence: Occurrence | undefined,
  revealDirection: 'left' | 'right',
): void {
  if (revealDirection !== 'right') return;
  if (!sourceOccurrence) return;

  for (const branch of envelope.branches) {
    const firstNode = branch.path.find((step): step is PathNode => step.type === 'node');
    if (!firstNode || firstNode.nodeId !== sourceOccurrence.canonicalNodeId) continue;
    pathOccurrenceIds.set(firstNode, sourceOccurrence.occurrenceId);
  }
}

export class LayoutEngine {
  private config: LayoutConfig;

  constructor(config: LayoutConfig = DEFAULT_LAYOUT_CONFIG) {
    this.config = config;
  }

  initLayout(envelope: NormalizedPathEnvelope): LayoutState {
    resetDeCounter();

    const occurrenceModel = buildOccurrenceModel(envelope, 0, this.config);
    const occurrenceCounter = { value: maxOrdinalFromIds(occurrenceModel.occurrences.map(o => o.occurrenceId), 'occ') };
    let occurrences = occurrenceModel.occurrences;

    const laneOrder = computeLaneOrder(occurrences);
    const dynamicConfig = { ...this.config, laneBaseY: computeLaneBaseY(laneOrder) };

    let edgeOccLinks = buildEdgeOccurrenceLinks(envelope, occurrences, occurrenceModel.pathOccurrenceIds);
    ({ occurrences, edgeOccLinks } = addRoleMarkerOccurrences({
      envelope,
      occurrences,
      edgeOccLinks,
      pathOccurrenceIds: occurrenceModel.pathOccurrenceIds,
      occurrenceCounter,
      config: this.config,
    }));

    const anchorOcc = occurrences.find(o => o.canonicalNodeId === envelope.anchor.nodeId);
    const anchorOccId = anchorOcc?.occurrenceId ?? occurrences[0]?.occurrenceId ?? '';

    occurrences = assignStages(occurrences, edgeOccLinks as any, anchorOccId, dynamicConfig);
    ({ occurrences, edgeOccLinks } = mergeSameStageSharedOccurrences(occurrences, edgeOccLinks));
    ({ occurrences, edgeOccLinks } = mergeDuplicateRoleMarkers(occurrences, edgeOccLinks));

    const displayEdges: DisplayEdge[] = [];
    for (let i = 0; i < edgeOccLinks.length; i++) {
      const link = edgeOccLinks[i]!;
      displayEdges.push(semanticLiftEdgeOccurrenceLink(link, `de_${i + 1}`));
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
    const incomingOccurrenceModel = buildOccurrenceModel(envelope, occurrenceOffset, this.config);
    const occurrenceCounter = {
      value: Math.max(
        maxOrdinalFromIds(Object.keys(state.occurrences), 'occ'),
        maxOrdinalFromIds(incomingOccurrenceModel.occurrences.map(o => o.occurrenceId), 'occ'),
      ),
    };
    bindExploreSourcePathOccurrences(envelope, incomingOccurrenceModel.pathOccurrenceIds, sourceOccurrence, revealDirection);
    let incomingOccurrences = incomingOccurrenceModel.occurrences;
    let incomingRoleMarkerLinks: EdgeOccurrenceLink[] = [];
    ({ occurrences: incomingOccurrences, edgeOccLinks: incomingRoleMarkerLinks } = addRoleMarkerOccurrences({
      envelope,
      occurrences: incomingOccurrences,
      edgeOccLinks: [],
      pathOccurrenceIds: incomingOccurrenceModel.pathOccurrenceIds,
      occurrenceCounter,
      config: this.config,
    }));
    const existingOccs = Object.values(state.occurrences);
    const newOccurrences = sourceOccurrence
      ? incomingOccurrences.filter((occurrence) => !(
        occurrence.canonicalNodeId === sourceOccurrence.canonicalNodeId &&
        occurrence.displayRole === sourceOccurrence.displayRole
      ))
      : incomingOccurrences;
    const { merged, added } = mergeOccurrences(newOccurrences, existingOccs);

    const laneOrder = computeLaneOrder(merged);
    const dynamicConfig = { ...this.config, laneBaseY: computeLaneBaseY(laneOrder) };

    let allEdgeLinks = [
      ...buildEdgeOccurrenceLinks(envelope, merged, incomingOccurrenceModel.pathOccurrenceIds),
      ...incomingRoleMarkerLinks,
    ];

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
    const roleCompacted = mergeDuplicateRoleMarkers(compacted.occurrences, compacted.edgeOccLinks);
    allEdgeLinks = roleCompacted.edgeOccLinks;
    const finalMerged = mergeFinalDuplicateOccurrences(roleCompacted.occurrences, allEdgeLinks, state.occurrences);
    allEdgeLinks = finalMerged.edgeOccLinks;
    const compactedOccurrences = finalMerged.occurrences;
    const removedOccurrenceIds = new Set([
      ...compacted.removedOccurrenceIds,
      ...roleCompacted.removedOccurrenceIds,
      ...finalMerged.removedOccurrenceIds,
    ]);
    const addedAfterCompaction = added.filter(a => !removedOccurrenceIds.has(a.occurrenceId));
    const stagedAdded = compactedOccurrences.filter(o => addedAfterCompaction.some(a => a.occurrenceId === o.occurrenceId));
    const existingRenderedEdgeKeys = renderedEdgeKeysFromState(state.displayEdges);

    const newRenderedEdges: RenderedEdge[] = [];
    let edgeOrdinal = maxOrdinalFromIds(Object.keys(state.displayEdges), 'de');
    for (const link of allEdgeLinks) {
      const isNew = !existingRenderedEdgeKeys.has(renderedEdgeKey(link));
      if (!isNew) continue;
      edgeOrdinal += 1;
      const de = semanticLiftEdgeOccurrenceLink(link, `de_${edgeOrdinal}`);
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
