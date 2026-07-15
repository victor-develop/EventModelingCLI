import type { Edge, Node } from '../domain/types';
import type { Graph, WalkBranch } from '../graph/graph-builder';
import { resolveNodeId } from '../graph/graph-builder';
import { toDisplayNodeKind, toDisplayLane } from '../layout/types';

export function resolveNodeLaneMap(graph: Graph): Map<string, string> {
  const laneMap = new Map<string, string>();

  for (const [, node] of graph.nodes) {
    if (laneMap.has(node.canonicalId)) continue;
    if (node.kind === 'role') continue;
    laneMap.set(node.canonicalId, defaultLaneForNode(node));
  }

  return laneMap;
}

export function roleSurfaceLaneForEdge(graph: Graph, edge: Edge): { surfaceNodeId: string; lane: string } | undefined {
  if (edge.type !== 'roleIssuesCommand' || !edge.viaNodeId) return undefined;

  const surfaceNodeId = resolveNodeId(graph, edge.viaNodeId);
  if (!surfaceNodeId) return undefined;

  return {
    surfaceNodeId,
    lane: roleLaneId(resolveRoleId(graph, edge.fromNodeId)),
  };
}

export function roleSurfaceLaneMapForBranch(graph: Graph, branch: WalkBranch): Map<number, string> {
  const result = new Map<number, string>();

  branch.path.forEach((step, index) => {
    if (!step.nodeId) return;

    for (const adjacentIndex of [index - 1, index + 1]) {
      const adjacent = branch.path[adjacentIndex];
      if (!adjacent?.edgeId) continue;

      const edge = graph.edges.get(adjacent.edgeId);
      if (!edge) continue;

      const roleLane = roleSurfaceLaneForEdge(graph, edge);
      if (roleLane?.surfaceNodeId === step.nodeId) {
        result.set(index, roleLane.lane);
        return;
      }
    }
  });

  return result;
}

function defaultLaneForNode(node: Node): string {
  return toDisplayLane(toDisplayNodeKind(node.kind));
}

function roleLaneId(roleId: string): string {
  return `role:${roleId}`;
}

function resolveRoleId(graph: Graph, roleId: string): string {
  return resolveNodeId(graph, roleId) ?? roleId;
}
