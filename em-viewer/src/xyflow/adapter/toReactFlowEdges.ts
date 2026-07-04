import { MarkerType, type Edge } from '@xyflow/react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { RenderedEdge } from '@em/layout/types';
import type { OrthogonalEdgeData } from './types';

const EDGE_COLOR: Record<string, string> = {
  'shared-to-cmd': '#8c6f3d',
  'cmd-to-evt': '#2f6f73',
  'evt-to-viewModel': '#b86b4b',
  'viewModel-to-shared': '#705c8f',
  'evt-to-shared': '#64706c',
};

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
  return EDGE_COLOR[kind] ?? '#64706c';
}
