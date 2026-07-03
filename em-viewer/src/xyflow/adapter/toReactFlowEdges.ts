import type { Edge } from '@xyflow/react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { RenderedEdge } from '@em/layout/types';
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
      points: edge.points.map((point) => [...point] as [number, number]),
    },
    selectable: true,
  };
}
