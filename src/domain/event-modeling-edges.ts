import type { Edge, EdgeType, Node } from './types';

export const EVENT_MODELING_EDGE_TYPES: EdgeType[] = [
  'roleUsesUIToIssueCommand',
  'processorOrTriggerIssuesCommand',
  'commandCausesEvent',
  'eventRefreshesViewModel',
  'eventUpdatesProcessor',
  'uiOrProcessorConsumesViewModel',
];

export const EVENT_MODELING_EDGE_TYPE_SET: ReadonlySet<EdgeType> = new Set(EVENT_MODELING_EDGE_TYPES);

export function isEventModelingEdgeType(edgeType: EdgeType): boolean {
  return EVENT_MODELING_EDGE_TYPE_SET.has(edgeType);
}

export function toEventModelingDisplayEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeLookup = createNodeLookup(nodes);
  return edges.flatMap((edge) => {
    const projected = toEventModelingDisplayEdge(edge, nodeLookup);
    return projected ? [projected] : [];
  });
}

export function toEventModelingDisplayEdge(
  edge: Edge,
  nodeLookup: ReadonlyMap<string, Node>,
): Edge | null {
  if (!isEventModelingEdgeType(edge.type)) return null;

  const endpoints = getEventModelingDisplayEndpointIds(
    edge.type,
    edge.fromNodeId,
    edge.toNodeId,
    (nodeId) => nodeLookup.get(nodeId)?.kind,
  );
  if (endpoints.fromNodeId !== edge.fromNodeId || endpoints.toNodeId !== edge.toNodeId) {
    return {
      ...edge,
      fromNodeId: endpoints.fromNodeId,
      toNodeId: endpoints.toNodeId,
    };
  }

  return edge;
}

export function getEventModelingDisplayEndpointIds(
  edgeType: EdgeType | string,
  fromNodeId: string,
  toNodeId: string,
  kindForNodeId: (nodeId: string) => string | undefined,
): { fromNodeId: string; toNodeId: string } {
  if (edgeType !== 'uiOrProcessorConsumesViewModel') {
    return { fromNodeId, toNodeId };
  }

  const fromKind = kindForNodeId(fromNodeId);
  const toKind = kindForNodeId(toNodeId);
  if (fromKind !== 'viewModel' && toKind === 'viewModel') {
    return { fromNodeId: toNodeId, toNodeId: fromNodeId };
  }

  return { fromNodeId, toNodeId };
}

function createNodeLookup(nodes: Node[]): Map<string, Node> {
  const lookup = new Map<string, Node>();
  for (const node of nodes) {
    lookup.set(node.id, node);
    lookup.set(node.canonicalId, node);
  }
  return lookup;
}
