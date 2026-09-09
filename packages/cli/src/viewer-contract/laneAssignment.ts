import type { Node } from '../domain/types';
import type { Graph } from '../graph/graph-builder';
import { resolveNodeId } from '../graph/graph-builder';
import { toDisplayNodeKind, toDisplayLane, toRoleDisplayLane } from '../layout/types';

export function resolveNodeLaneMap(graph: Graph): Map<string, string> {
  const laneMap = new Map<string, string>();

  for (const [, node] of graph.nodes) {
    if (laneMap.has(node.canonicalId)) continue;
    if (node.kind === 'role') continue;
    laneMap.set(node.canonicalId, defaultLaneForNode(graph, node));
  }

  return laneMap;
}

function defaultLaneForNode(graph: Graph, node: Node): string {
  const ownerRole = ownerRoleForNode(node);
  if (ownerRole && (node.kind.startsWith('ui.') || node.kind === 'proc')) {
    return toRoleDisplayLane(resolveNodeId(graph, ownerRole) ?? ownerRole);
  }
  return toDisplayLane(toDisplayNodeKind(node.kind), node.canonicalId);
}

function ownerRoleForNode(node: Node): string | undefined {
  const topLevelOwnerRole = typeof node.ownerRole === 'string' ? node.ownerRole : undefined;
  const metaOwnerRole = typeof node.meta?.ownerRole === 'string' ? node.meta.ownerRole : undefined;
  return topLevelOwnerRole ?? metaOwnerRole;
}
