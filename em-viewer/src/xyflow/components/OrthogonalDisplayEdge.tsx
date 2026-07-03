import type { EdgeProps, Edge } from '@xyflow/react';
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

export function OrthogonalDisplayEdge({ id, data, selected }: OrthogonalProps) {
  const points = data?.points ?? [];
  if (points.length < 2) return null;

  const markerId = `arrow-${id}`;
  const path = pointsToPath(points);
  const edgeClass = EDGE_CLASS[data?.kind ?? ''] ?? 'edge-default';

  return (
    <g className={`em-edge ${edgeClass} ${selected ? 'is-selected' : ''}`}>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>
      <path className="em-edge-path" d={path} markerEnd={`url(#${markerId})`} />
    </g>
  );
}

function pointsToPath(points: [number, number][]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  return [`M ${first[0]} ${first[1]}`, ...rest.map((point) => `L ${point[0]} ${point[1]}`)].join(' ');
}
