import type { EdgeType, Node, Edge } from '../domain/types';
import { EVENT_MODELING_EDGE_TYPES } from '../domain/event-modeling-edges';
import type { Graph, WalkBranch } from '../graph/graph-builder';
import { walkGraph } from '../graph/graph-builder';
import { toDisplayNodeKind } from '../layout/types';
import type { Branch, NormalizedPathEnvelope, PathStep } from '../layout/types';
import type { SnapshotDirection } from './types';
import { roleSurfaceLaneMapForBranch } from './laneAssignment';

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
    const roleSurfaceLanes = args.graph ? roleSurfaceLaneMapForBranch(args.graph, walkBranch) : new Map<number, string>();

    for (const [stepIndex, step] of walkBranch.path.entries()) {
      if (step.nodeId) {
        const graphNode = args.graph?.nodes.get(step.nodeId);
        path.push({
          type: 'node',
          nodeId: step.nodeId,
          nodeKind: toDisplayNodeKind(step.nodeKind ?? graphNode?.kind ?? 'cmd'),
          lane: roleSurfaceLanes.get(stepIndex) ?? laneFor(step.nodeId),
        });
      }

      if (step.edgeId && step.edgeType) {
        const displayDirection = step.direction === 'backward' ? 'backward' : 'forward';
        branchDirection = displayDirection;
        path.push({
          type: 'edge',
          edgeId: step.edgeId,
          edgeType: step.edgeType as EdgeType,
          displayDirection,
        });
      }
    }

    if (path.length > 0) {
      branches.push({
        branchId: `${branchDirection === 'forward' ? 'fwd' : 'bwd'}_${index}`,
        direction: branchDirection,
        path,
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
}): NormalizedPathEnvelope {
  const walkResult = walkGraph(args.graph, args.focusNodeId, args.direction, EVENT_MODELING_EDGE_TYPES, args.hops);
  return buildEnvelopeFromWalkBranches({
    graph: args.graph,
    focusNodeId: args.focusNodeId,
    branches: walkResult.branches,
  });
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
