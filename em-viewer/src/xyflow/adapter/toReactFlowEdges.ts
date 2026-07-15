import { MarkerType, type Edge } from '@xyflow/react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { RenderedEdge } from '@em/layout/types';
import { EDGE_COLORS } from '../../types';
import type { OrthogonalEdgeData } from './types';

export function toReactFlowEdges(snapshot: VisualizationSnapshot): Edge<OrthogonalEdgeData>[] {
  return snapshot.renderedEdges.map(toReactFlowEdge);
}

export function toReactFlowEdge(edge: RenderedEdge): Edge<OrthogonalEdgeData> {
  return {
    id: edge.displayEdgeId,
    source: edge.fromOccurrenceId,
    target: edge.toOccurrenceId,
    type: 'em.orthogonal',
    data: {
      kind: edge.kind,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: getEdgeColor(edge.kind),
      width: 18,
      height: 18,
    },
    style: {
      stroke: getEdgeColor(edge.kind),
      strokeWidth: 2.2,
    },
    selectable: true,
  };
}

function getEdgeColor(kind: string): string {
  return EDGE_COLORS[kind] ?? '#64706c';
}
