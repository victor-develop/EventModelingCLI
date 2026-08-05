import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react';
import type { DiffStatus } from '@em/viewer-contract/types';
import type { MouseEvent } from 'react';
import type { OrthogonalEdgeData } from '../adapter/types';
import { useDiffSelection } from './DiffSelectionContext';

type OrthogonalProps = EdgeProps<Edge<OrthogonalEdgeData>>;

const EDGE_CLASS: Record<string, string> = {
  'role-to-shared': 'edge-role-shared',
  'shared-to-cmd': 'edge-shared-cmd',
  'cmd-to-evt': 'edge-cmd-evt',
  'evt-to-viewModel': 'edge-evt-view',
  'viewModel-to-shared': 'edge-view-shared',
  'evt-to-shared': 'edge-evt-shared',
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
  const onDiffSelect = useDiffSelection();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12,
  });
  const edgeClass = EDGE_CLASS[data?.kind ?? ''] ?? 'edge-default';
  const diffClass = data?.diff ? `diff-${data.diff.status}` : '';
  const changeIds = data?.diff?.changeIds ?? [];
  const handleDiffClick = (event: MouseEvent) => {
    if (changeIds.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onDiffSelect?.(changeIds);
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={`em-edge-path ${edgeClass} ${diffClass} ${selected ? 'is-selected' : ''}`}
        style={{
          ...style,
          strokeWidth: selected ? 3.2 : style?.strokeWidth,
        }}
        interactionWidth={interactionWidth ?? 24}
        onClick={changeIds.length > 0 ? handleDiffClick : undefined}
      />
      {data?.diff ? (
        <EdgeDiffMarker
          status={data.diff.status}
          x={labelX}
          y={labelY}
          onClick={handleDiffClick}
        />
      ) : null}
    </>
  );
}

function EdgeDiffMarker({
  status,
  x,
  y,
  onClick,
}: {
  status: DiffStatus;
  x: number;
  y: number;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        className={`em-edge-diff-marker nopan nodrag diff-${status}`}
        style={{
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        }}
        aria-label={`${status} edge`}
        title={`${status} edge`}
        onClick={onClick}
      >
        <svg aria-hidden="true" viewBox="-10 -10 20 20" className="em-edge-diff-marker-glyph">
          <circle r="8" />
          {renderDiffGlyph(status)}
        </svg>
      </button>
    </EdgeLabelRenderer>
  );
}

function renderDiffGlyph(status: DiffStatus) {
  if (status === 'added') {
    return (
      <>
        <path d="M -5 0 L 5 0" />
        <path d="M 0 -5 L 0 5" />
      </>
    );
  }
  if (status === 'removed') {
    return (
      <>
        <path d="M -4 -4 L 4 4" />
        <path d="M 4 -4 L -4 4" />
      </>
    );
  }
  return <path d="M -5 2 L -2 -3 L 2 3 L 5 -2" />;
}
