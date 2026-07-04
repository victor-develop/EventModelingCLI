import {
  NormalizedPathEnvelope,
  Occurrence,
  DisplayRole,
  toDisplayNodeKind,
  toDisplayLane,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  PathStep,
  PathNode,
  PathEdge,
  MergeKey,
} from './types';
import { getEventModelingDisplayEndpointIds } from '../domain/event-modeling-edges';

export interface EdgeOccurrenceLink {
  fromOccId: string;
  toOccId: string;
  originalEdgeId: string;
  originalEdgeType: string;
}

function nextOccId(counter: { value: number }): string {
  counter.value += 1;
  return `occ_${counter.value}`;
}

function inferDisplayRole(nodeKind: string): DisplayRole {
  if (nodeKind === 'cmd') return 'command';
  if (nodeKind === 'evt') return 'event';
  if (nodeKind === 'viewModel') return 'projection';
  if (nodeKind === 'trigger') return 'trigger';
  if (nodeKind.startsWith('ui.')) return 'ui';
  if (nodeKind === 'proc') return 'processor';
  return 'ui';
}

export function buildOccurrences(
  envelope: NormalizedPathEnvelope,
  branchOffset: number,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const seen = new Set<string>();
  const branchMembership = new Map<string, string[]>();
  const occurrenceIdCounter = { value: branchOffset };

  for (const branch of envelope.branches) {
    for (const step of branch.path) {
      if (step.type !== 'node') continue;
      const node = step as PathNode;
      const displayKind = toDisplayNodeKind(node.nodeKind);

      const dedupKey = displayKind === 'shared'
        ? `${node.nodeId}:${branch.branchId}`
        : node.nodeId;

      if (seen.has(dedupKey)) {
        const members = branchMembership.get(dedupKey) ?? [];
        if (!members.includes(branch.branchId)) {
          members.push(branch.branchId);
          branchMembership.set(dedupKey, members);
        }
        continue;
      }
      seen.add(dedupKey);
      branchMembership.set(dedupKey, [branch.branchId]);

      const lane = node.lane ?? toDisplayLane(displayKind);

      occurrences.push({
        occurrenceId: node.occurrenceId ?? nextOccId(occurrenceIdCounter),
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

  return occurrences;
}

export function mergeOccurrences(
  incoming: Occurrence[],
  existing: Occurrence[],
): { merged: Occurrence[]; added: Occurrence[] } {
  const merged: Occurrence[] = [...existing];
  const added: Occurrence[] = [];

  for (const inc of incoming) {
    const matchIdx = merged.findIndex(e =>
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
      const displayNodes = orientDisplayEdgeNodes(pathEdge.edgeType, fromNodeId, toNodeId, nodeOccMap);

      const fromOccs = nodeOccMap.get(displayNodes.fromNodeId) ?? [];
      const toOccs = nodeOccMap.get(displayNodes.toNodeId) ?? [];

      const fromOcc = pickOccurrenceForBranch(fromOccs, branch.branchId, displayNodes.fromNodeId);
      const toOcc = pickOccurrenceForBranch(toOccs, branch.branchId, displayNodes.toNodeId);

      if (!fromOcc || !toOcc) continue;

      const pairKey = `${fromOcc.occurrenceId}:${toOcc.occurrenceId}:${(edge as PathEdge).edgeId}`;
      if (seenEdgePairs.has(pairKey)) continue;
      seenEdgePairs.add(pairKey);

      links.push({
        fromOccId: fromOcc.occurrenceId,
        toOccId: toOcc.occurrenceId,
        originalEdgeId: (edge as PathEdge).edgeId,
        originalEdgeType: (edge as PathEdge).edgeType,
      });
    }
  }

  return links;
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

function orientDisplayEdgeNodes(
  edgeType: string,
  fromNodeId: string,
  toNodeId: string,
  nodeOccMap: Map<string, Occurrence[]>,
): { fromNodeId: string; toNodeId: string } {
  if (edgeType !== 'uiOrProcessorConsumesViewModel') {
    return { fromNodeId, toNodeId };
  }

  return getEventModelingDisplayEndpointIds(
    edgeType,
    fromNodeId,
    toNodeId,
    (nodeId) => nodeOccMap.get(nodeId)?.[0]?.nodeKind,
  );
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
