import type { Edge, EdgeType } from './types';

export const EVENT_MODELING_EDGE_TYPES: EdgeType[] = [
  'roleUsesUIToIssueCommand',
  'processorOrTriggerIssuesCommand',
  'commandCausesEvent',
  'eventRefreshesViewModel',
  'eventUpdatesProcessor',
  'viewModelConsumedByUiOrProcessor',
];

export const EVENT_MODELING_EDGE_TYPE_SET: ReadonlySet<EdgeType> = new Set(EVENT_MODELING_EDGE_TYPES);

export function isEventModelingEdgeType(edgeType: EdgeType): boolean {
  return EVENT_MODELING_EDGE_TYPE_SET.has(edgeType);
}

export function toEventModelingEdges(edges: Edge[]): Edge[] {
  return edges.filter((edge) => isEventModelingEdgeType(edge.type));
}
