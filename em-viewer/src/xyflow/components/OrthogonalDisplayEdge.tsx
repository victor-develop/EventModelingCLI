import { BaseEdge, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react';
import type { OrthogonalEdgeData } from '../adapter/types';

type OrthogonalProps = EdgeProps<Edge<OrthogonalEdgeData>>;

const EDGE_CLASS: Record<string, string> = {
  'shared-to-cmd': 'edge-shared-cmd',
  'cmd-to-evt': 'edge-cmd-evt',
  'evt-to-viewModel': 'edge-evt-view',
  'viewModel-to-shared': 'edge-view-shared',
  'evt-to-shared': 'edge-evt-shared',
  'shared-to-shared': 'edge-shared-shared',
};

export function OrthogonalDisplayEdge({
  id,
  data,
  selected,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  interactionWidth,
}: OrthogonalProps) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });
  const edgeClass = EDGE_CLASS[data?.kind ?? ''] ?? 'edge-default';

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      className={`em-edge-path ${edgeClass} ${selected ? 'is-selected' : ''}`}
      style={{
        ...style,
        strokeWidth: selected ? 3.2 : style?.strokeWidth,
      }}
      interactionWidth={interactionWidth ?? 24}
    />
  );
}
