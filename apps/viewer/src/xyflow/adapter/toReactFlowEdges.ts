import { MarkerType, type Edge } from '@xyflow/react';
import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import type { RenderedEdge } from 'event-modeling-spec-cli/layout/types';
import { DIFF_COLORS, EDGE_COLORS } from '../../types';
import type { OrthogonalEdgeData } from './types';

export function toReactFlowEdges(
  snapshot: VisualizationSnapshot,
): Edge<OrthogonalEdgeData>[] {
  return snapshot.renderedEdges.map((edge) => toReactFlowEdge(
    edge,
    typeof edge.meta?.originalEdgeId === 'string'
      ? snapshot.diffOverlay?.edgesById[edge.meta.originalEdgeId]
      : undefined,
  ));
}

export function toReactFlowEdge(
  edge: RenderedEdge,
  diff?: OrthogonalEdgeData['diff'],
): Edge<OrthogonalEdgeData> {
  const edgeColor = getEdgeColor(edge.kind, diff);
  return {
    id: edge.displayEdgeId,
    source: edge.fromOccurrenceId,
    target: edge.toOccurrenceId,
    type: 'em.orthogonal',
    data: {
      kind: edge.kind,
      diff,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: edgeColor,
      width: 18,
      height: 18,
    },
    style: {
      stroke: edgeColor,
      strokeWidth: diff ? 3 : 2.2,
      strokeDasharray: diff?.status === 'removed' ? '8 6' : undefined,
      opacity: diff?.status === 'removed' ? 0.76 : undefined,
    },
    selectable: true,
  };
}

function getEdgeColor(kind: string, diff?: OrthogonalEdgeData['diff']): string {
  if (diff) return DIFF_COLORS[diff.status];
  return EDGE_COLORS[kind] ?? '#64706c';
}
