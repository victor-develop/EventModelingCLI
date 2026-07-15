import {
  NormalizedPathEnvelope,
  Occurrence,
  DisplayRole,
  DisplayEdgeKind,
  DisplayNodeKind,
  toDisplayNodeKind,
  toDisplayLane,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  PathStep,
  PathNode,
  PathEdge,
  MergeKey,
} from './types';

export interface EdgeOccurrenceLink {
  fromOccId: string;
  toOccId: string;
  originalEdgeId: string;
  originalEdgeType: string;
  displayEdgeKind?: DisplayEdgeKind;
  displayFromNodeKind?: DisplayNodeKind;
  displayToNodeKind?: DisplayNodeKind;
}

export interface OccurrenceBuildResult {
  occurrences: Occurrence[];
  pathOccurrenceIds: Map<PathNode, string>;
}

function nextOccId(counter: { value: number }): string {
  counter.value += 1;
  return `occ_${counter.value}`;
}

function inferDisplayRole(nodeKind: string): DisplayRole {
  if (nodeKind === 'role') return 'role';
  if (nodeKind === 'cmd') return 'command';
  if (nodeKind === 'evt') return 'event';
  if (nodeKind === 'viewModel') return 'projection';
  if (nodeKind === 'trigger') return 'trigger';
  if (nodeKind.startsWith('ui.')) return 'ui';
  if (nodeKind === 'proc') return 'processor';
  return 'ui';
}

export function buildOccurrenceModel(
  envelope: NormalizedPathEnvelope,
  branchOffset: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): OccurrenceBuildResult {
  const occurrences: Occurrence[] = [];
  const seen = new Set<string>();
  const branchMembership = new Map<string, string[]>();
  const occurrenceIdByDedupKey = new Map<string, string>();
  const pathOccurrenceIds = new Map<PathNode, string>();
  const occurrenceIdCounter = { value: branchOffset };

  for (const branch of envelope.branches) {
    const branchVisitCounts = new Map<string, number>();

    for (const step of branch.path) {
      if (step.type !== 'node') continue;
      const node = step as PathNode;
      const displayKind = toDisplayNodeKind(node.nodeKind);
      const visitIndex = branchVisitCounts.get(node.nodeId) ?? 0;
      branchVisitCounts.set(node.nodeId, visitIndex + 1);

      const dedupKey = occurrenceDedupKey(node.nodeId, displayKind, branch.branchId, visitIndex);

      if (seen.has(dedupKey)) {
        const members = branchMembership.get(dedupKey) ?? [];
        if (!members.includes(branch.branchId)) {
          members.push(branch.branchId);
          branchMembership.set(dedupKey, members);
        }
        const occurrenceId = occurrenceIdByDedupKey.get(dedupKey);
        if (occurrenceId) pathOccurrenceIds.set(node, occurrenceId);
        continue;
      }
      seen.add(dedupKey);
      branchMembership.set(dedupKey, [branch.branchId]);
      const occurrenceId = node.occurrenceId ?? nextOccId(occurrenceIdCounter);
      occurrenceIdByDedupKey.set(dedupKey, occurrenceId);
      pathOccurrenceIds.set(node, occurrenceId);

      const lane = node.lane ?? toDisplayLane(displayKind, node.nodeId);

      occurrences.push({
        occurrenceId,
        canonicalNodeId: node.nodeId,
        nodeKind: displayKind,
        lane,
        stageIndex: 0,
        rowIndex: -1,
        displayRole: inferDisplayRole(node.nodeKind),
        branchClusterId: branch.branchId,
        lockLevel: 'free',
        x: 0,
        y: 0,
        width: config.nodeWidth,
        height: config.nodeHeight,
      });
    }
  }

  return { occurrences, pathOccurrenceIds };
}

export function buildOccurrences(
  envelope: NormalizedPathEnvelope,
  branchOffset: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Occurrence[] {
  return buildOccurrenceModel(envelope, branchOffset, config).occurrences;
}

export function mergeOccurrences(
  incoming: Occurrence[],
  existing: Occurrence[],
): { merged: Occurrence[]; added: Occurrence[] } {
  const merged: Occurrence[] = [...existing];
  const added: Occurrence[] = [];

  for (const inc of incoming) {
    const matchIdx = merged.findIndex(e =>
      inc.displayRole !== 'role' &&
      e.displayRole !== 'role' &&
      e.canonicalNodeId === inc.canonicalNodeId &&
      e.stageIndex === inc.stageIndex &&
      e.displayRole === inc.displayRole &&
      e.branchClusterId !== inc.branchClusterId
    );

    if (matchIdx >= 0) {
      continue;
    } else {
      merged.push(inc);
      added.push(inc);
    }
  }

  return { merged, added };
}

export function mergeSameStageSharedOccurrences(
  occurrences: Occurrence[],
  edgeOccLinks: EdgeOccurrenceLink[],
): { occurrences: Occurrence[]; edgeOccLinks: EdgeOccurrenceLink[]; removedOccurrenceIds: string[] } {
  const merged: Occurrence[] = [];
  const keptByKey = new Map<string, Occurrence>();
  const occurrenceIdRemap = new Map<string, string>();
  const removedOccurrenceIds: string[] = [];

  for (const occ of occurrences) {
    if (occ.nodeKind !== 'shared') {
      merged.push(occ);
      continue;
    }

    const key = sameStageSharedMergeKey(occ);
    const kept = keptByKey.get(key);
    if (!kept) {
      keptByKey.set(key, occ);
      merged.push(occ);
      continue;
    }

    occurrenceIdRemap.set(occ.occurrenceId, kept.occurrenceId);
    removedOccurrenceIds.push(occ.occurrenceId);
  }

  if (occurrenceIdRemap.size === 0) {
    return { occurrences, edgeOccLinks, removedOccurrenceIds };
  }

  return {
    occurrences: merged,
    edgeOccLinks: remapEdgeOccurrenceLinks(edgeOccLinks, occurrenceIdRemap),
    removedOccurrenceIds,
  };
}

export function buildMergeKey(occ: Occurrence): MergeKey {
  return {
    canonicalNodeId: occ.canonicalNodeId,
    stageIndex: occ.stageIndex,
    displayRole: occ.displayRole,
    branchClusterId: occ.branchClusterId,
  };
}

export function buildEdgeOccurrenceLinks(
  envelope: NormalizedPathEnvelope,
  occurrences: Occurrence[],
  pathOccurrenceIds?: Map<PathNode, string>,
): EdgeOccurrenceLink[] {
  const links: EdgeOccurrenceLink[] = [];
  const nodeOccMap = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const list = nodeOccMap.get(occ.canonicalNodeId) ?? [];
    list.push(occ);
    nodeOccMap.set(occ.canonicalNodeId, list);
  }

  const seenEdgePairs = new Set<string>();

  for (const branch of envelope.branches) {
    const pathSteps = branch.path;
    for (let i = 0; i < pathSteps.length - 2; i++) {
      const node1 = pathSteps[i]!;
      const edge = pathSteps[i + 1]!;
      const node2 = pathSteps[i + 2]!;
      if (node1.type !== 'node' || edge.type !== 'edge' || node2.type !== 'node') continue;

      const pathEdge = edge as PathEdge;
      const n1 = (node1 as PathNode).nodeId;
      const n2 = (node2 as PathNode).nodeId;
      const fromNodeId = pathEdge.displayDirection === 'backward' ? n2 : n1;
      const toNodeId = pathEdge.displayDirection === 'backward' ? n1 : n2;

      const fromOccs = nodeOccMap.get(fromNodeId) ?? [];
      const toOccs = nodeOccMap.get(toNodeId) ?? [];

      const fromPathNode = pathEdge.displayDirection === 'backward' ? node2 as PathNode : node1 as PathNode;
      const toPathNode = pathEdge.displayDirection === 'backward' ? node1 as PathNode : node2 as PathNode;
      const fromOcc = pickOccurrenceForPathNode(fromOccs, branch.branchId, fromNodeId, fromPathNode, pathOccurrenceIds);
      const toOcc = pickOccurrenceForPathNode(toOccs, branch.branchId, toNodeId, toPathNode, pathOccurrenceIds);

      if (!fromOcc || !toOcc) continue;

      const pairKey = `${fromOcc.occurrenceId}:${toOcc.occurrenceId}:${(edge as PathEdge).edgeId}`;
      if (seenEdgePairs.has(pairKey)) continue;
      seenEdgePairs.add(pairKey);

      links.push({
        fromOccId: fromOcc.occurrenceId,
        toOccId: toOcc.occurrenceId,
        originalEdgeId: (edge as PathEdge).edgeId,
        originalEdgeType: (edge as PathEdge).edgeType,
        displayFromNodeKind: fromOcc.nodeKind,
        displayToNodeKind: toOcc.nodeKind,
      });
    }
  }

  return links;
}

function occurrenceDedupKey(
  nodeId: string,
  displayKind: string,
  branchId: string,
  visitIndex: number,
): string {
  if (displayKind === 'shared' || displayKind === 'role') return `${nodeId}:${branchId}:${visitIndex}`;
  if (visitIndex > 0) return `${nodeId}:${branchId}:${visitIndex}`;
  return nodeId;
}

function pickOccurrenceForPathNode(
  occs: Occurrence[],
  branchId: string,
  nodeId: string,
  pathNode: PathNode,
  pathOccurrenceIds: Map<PathNode, string> | undefined,
): Occurrence | undefined {
  const pathOccurrenceId = pathOccurrenceIds?.get(pathNode);
  if (pathOccurrenceId) {
    const exactPathOccurrence = occs.find((occ) => occ.occurrenceId === pathOccurrenceId);
    if (exactPathOccurrence) return exactPathOccurrence;
  }

  return pickOccurrenceForBranch(occs, branchId, nodeId);
}

function pickOccurrenceForBranch(
  occs: Occurrence[],
  branchId: string,
  _nodeId: string,
): Occurrence | undefined {
  if (occs.length === 0) return undefined;
  if (occs.length === 1) return occs[0];

  const exact = occs.find((o) => o.branchClusterId === branchId);
  if (exact) return exact;

  return occs[0];
}

function sameStageSharedMergeKey(occ: Occurrence): string {
  return [
    occ.canonicalNodeId,
    occ.stageIndex,
    occ.lane,
    occ.displayRole,
  ].join('\u0000');
}

function remapEdgeOccurrenceLinks(
  edgeOccLinks: EdgeOccurrenceLink[],
  occurrenceIdRemap: Map<string, string>,
): EdgeOccurrenceLink[] {
  const deduped: EdgeOccurrenceLink[] = [];
  const seen = new Set<string>();

  for (const link of edgeOccLinks) {
    const remapped = {
      ...link,
      fromOccId: occurrenceIdRemap.get(link.fromOccId) ?? link.fromOccId,
      toOccId: occurrenceIdRemap.get(link.toOccId) ?? link.toOccId,
    };
    const key = [
      remapped.fromOccId,
      remapped.toOccId,
      remapped.originalEdgeId,
      remapped.originalEdgeType,
    ].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(remapped);
  }

  return deduped;
}
