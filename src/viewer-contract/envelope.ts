import type { EdgeType, Node, Edge } from '../domain/types';
import { EVENT_MODELING_EDGE_TYPES } from '../domain/event-modeling-edges';
import type { Graph, WalkBranch } from '../graph/graph-builder';
import { resolveNodeId, walkGraph } from '../graph/graph-builder';
import { toDisplayNodeKind } from '../layout/types';
import type { Branch, NormalizedPathEnvelope, PathNode, PathStep } from '../layout/types';
import type { SnapshotDirection } from './types';

export interface TruncatedPathPolicyResult {
  envelope: NormalizedPathEnvelope;
  hiddenPathCount: number;
}

export function buildEnvelopeFromWalkBranches(args: {
  graph: Graph;
  focusNodeId: string;
  branches: WalkBranch[];
  laneMap?: Map<string, string> | Record<string, string>;
}): NormalizedPathEnvelope {
  return walkBranchesToEnvelope({
    graph: args.graph,
    focusNodeId: args.focusNodeId,
    branches: args.branches,
    laneMap: args.laneMap,
  });
}

export function walkBranchesToEnvelope(args: {
  focusNodeId: string;
  branches: WalkBranch[];
  laneMap?: Map<string, string> | Record<string, string>;
  graph?: Graph;
  includeSingletonBranches?: boolean;
}): NormalizedPathEnvelope {
  const laneFor = createLaneLookup(args.laneMap);
  const branches: Branch[] = [];
  const includeSingletonBranches = args.includeSingletonBranches ?? true;

  args.branches.forEach((walkBranch, index) => {
    if (!includeSingletonBranches && walkBranch.path.length <= 1) return;

    const path: PathStep[] = [];
    let branchDirection: 'forward' | 'backward' = 'forward';

    for (const step of walkBranch.path) {
      if (step.nodeId) {
        const canonicalNodeId = canonicalNodeIdFor(args.graph, step.nodeId);
        const graphNode = args.graph?.nodes.get(canonicalNodeId);
        path.push({
          type: 'node',
          nodeId: canonicalNodeId,
          nodeKind: step.nodeKind ?? graphNode?.kind ?? 'cmd',
          lane: laneFor(canonicalNodeId),
        });
      }

      if (step.edgeId && step.edgeType) {
        const displayDirection = step.direction === 'backward' ? 'backward' : 'forward';
        const graphEdge = args.graph?.edges.get(step.edgeId);
        branchDirection = displayDirection;
        path.push({
          type: 'edge',
          edgeId: step.edgeId,
          edgeType: step.edgeType as EdgeType,
          displayDirection,
          roleNodeId: graphEdge?.type === 'roleIssuesCommand'
            ? canonicalNodeIdFor(args.graph, graphEdge.fromNodeId)
            : undefined,
          surfaceNodeId: graphEdge?.type === 'roleIssuesCommand' && graphEdge.viaNodeId
            ? canonicalNodeIdFor(args.graph, graphEdge.viaNodeId)
            : undefined,
        });
      }
    }

    const normalizedPath = args.graph ? normalizeRoleIssueSurfaces(path, args.graph, laneFor) : path;

    if (normalizedPath.length > 0) {
      branches.push({
        branchId: `${branchDirection === 'forward' ? 'fwd' : 'bwd'}_${index}`,
        direction: branchDirection,
        path: normalizedPath,
      });
    }
  });

  return {
    anchor: { nodeId: args.focusNodeId },
    branches,
    frontier: {},
  };
}

export function buildWalkEnvelope(args: {
  graph: Graph;
  focusNodeId: string;
  direction: SnapshotDirection;
  hops: number;
  laneMap?: Map<string, string> | Record<string, string>;
}): NormalizedPathEnvelope {
  const walkResult = walkGraph(args.graph, args.focusNodeId, args.direction, EVENT_MODELING_EDGE_TYPES, args.hops);
  return buildEnvelopeFromWalkBranches({
    graph: args.graph,
    focusNodeId: args.focusNodeId,
    branches: walkResult.branches,
    laneMap: args.laneMap,
  });
}

export function applyTruncatedPathPolicy(args: {
  envelope: NormalizedPathEnvelope;
  graph: Graph;
  focusNodeId: string;
  includeTruncatedPaths: boolean;
}): TruncatedPathPolicyResult {
  if (args.includeTruncatedPaths || args.envelope.branches.length === 0) {
    return { envelope: args.envelope, hiddenPathCount: 0 };
  }

  const reachable = computeVisibleSourceReachability(args.envelope, args.graph, args.focusNodeId);
  const visibleBranches = args.envelope.branches.filter((branch) => {
    const leftBoundary = getLeftBoundaryNode(branch);
    if (!leftBoundary) return true;
    if (isVisibleSourceNode(args.graph, leftBoundary.nodeId)) return true;
    if (!hasCompleteUpstream(args.graph, leftBoundary.nodeId)) return true;
    return reachable.has(leftBoundary.nodeId);
  });

  return {
    envelope: {
      ...args.envelope,
      branches: visibleBranches,
    },
    hiddenPathCount: args.envelope.branches.length - visibleBranches.length,
  };
}

export function collectDomainNodes(args: {
  envelope: NormalizedPathEnvelope;
  graph: Graph;
  focusNodeId: string;
}): Record<string, Node> {
  const ids = new Set<string>([args.focusNodeId]);
  for (const branch of args.envelope.branches) {
    for (const step of branch.path) {
      if (step.type === 'node') ids.add(step.nodeId);
      if (step.type === 'edge' && step.roleNodeId) ids.add(step.roleNodeId);
    }
  }

  const result: Record<string, Node> = {};
  for (const id of ids) {
    const node = args.graph.nodes.get(id);
    if (node) result[node.canonicalId] = node;
  }
  return result;
}

export function collectDomainEdges(args: {
  envelope: NormalizedPathEnvelope;
  graph: Graph;
}): Record<string, Edge> {
  const ids = new Set<string>();
  for (const branch of args.envelope.branches) {
    for (const step of branch.path) {
      if (step.type === 'edge') ids.add(step.edgeId);
    }
  }

  const result: Record<string, Edge> = {};
  for (const id of ids) {
    const edge = args.graph.edges.get(id);
    if (edge) result[edge.id] = edge;
  }
  return result;
}

function createLaneLookup(
  laneMap: Map<string, string> | Record<string, string> | undefined,
): (nodeId: string) => string | undefined {
  if (!laneMap) return () => undefined;
  if (laneMap instanceof Map) return (nodeId) => laneMap.get(nodeId);
  return (nodeId) => laneMap[nodeId];
}

function canonicalNodeIdFor(graph: Graph | undefined, nodeId: string): string {
  return graph ? resolveNodeId(graph, nodeId) ?? nodeId : nodeId;
}

function normalizeRoleIssueSurfaces(
  path: PathStep[],
  graph: Graph,
  laneFor: (nodeId: string) => string | undefined,
): PathStep[] {
  const normalized = [...path];

  for (let index = 0; index < normalized.length; index++) {
    const edge = normalized[index];
    if (edge?.type !== 'edge' || edge.edgeType !== 'roleIssuesCommand' || !edge.surfaceNodeId) continue;

    const surfacePathNode = pathNodeForGraphNode(graph, edge.surfaceNodeId, laneFor);
    if (!surfacePathNode) continue;

    const surfaceIndex = edge.displayDirection === 'backward' ? index + 1 : index - 1;
    const existingSurface = normalized[surfaceIndex];
    if (existingSurface?.type === 'node' && existingSurface.nodeId === surfacePathNode.nodeId) continue;
    if (existingSurface?.type !== 'node') continue;

    normalized[surfaceIndex] = surfacePathNode;
  }

  return normalized;
}

function pathNodeForGraphNode(
  graph: Graph,
  nodeId: string,
  laneFor: (nodeId: string) => string | undefined,
): PathNode | undefined {
  const canonicalNodeId = canonicalNodeIdFor(graph, nodeId);
  const node = graph.nodes.get(canonicalNodeId);
  if (!node) return undefined;

  return {
    type: 'node',
    nodeId: canonicalNodeId,
    nodeKind: node.kind,
    lane: laneFor(canonicalNodeId),
  };
}

function computeVisibleSourceReachability(
  envelope: NormalizedPathEnvelope,
  graph: Graph,
  focusNodeId: string,
): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  const seeds = new Set<string>([focusNodeId]);

  const addAdjacency = (from: string, to: string) => {
    const targets = adjacency.get(from) ?? new Set<string>();
    targets.add(to);
    adjacency.set(from, targets);
  };

  for (const branch of envelope.branches) {
    const path = branch.path;
    for (const step of path) {
      if (step.type === 'node' && isVisibleSourceNode(graph, step.nodeId)) {
        seeds.add(step.nodeId);
      }
    }

    for (let index = 0; index < path.length - 2; index++) {
      const node1 = path[index];
      const edge = path[index + 1];
      const node2 = path[index + 2];
      if (node1?.type !== 'node' || edge?.type !== 'edge' || node2?.type !== 'node') continue;

      const fromNodeId = edge.displayDirection === 'backward' ? node2.nodeId : node1.nodeId;
      const toNodeId = edge.displayDirection === 'backward' ? node1.nodeId : node2.nodeId;
      addAdjacency(fromNodeId, toNodeId);

      if (edge.edgeType === 'roleIssuesCommand' && edge.roleNodeId && edge.surfaceNodeId) {
        seeds.add(edge.surfaceNodeId);
      }
    }
  }

  const reachable = new Set<string>();
  const stack = [...seeds];
  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      stack.push(next);
    }
  }

  return reachable;
}

function getLeftBoundaryNode(branch: Branch): PathNode | undefined {
  const nodes = branch.path.filter((step): step is PathNode => step.type === 'node');
  if (nodes.length === 0) return undefined;
  return branch.direction === 'backward' ? nodes[nodes.length - 1] : nodes[0];
}

function isVisibleSourceNode(graph: Graph, nodeId: string): boolean {
  const kind = graph.nodes.get(nodeId)?.kind;
  return kind === 'role' || kind === 'trigger' || kind === 'proc';
}

function hasCompleteUpstream(graph: Graph, nodeId: string): boolean {
  const incoming = graph.incoming.get(nodeId) ?? [];
  return incoming.some((edge) => EVENT_MODELING_EDGE_TYPES.includes(edge.type));
}
