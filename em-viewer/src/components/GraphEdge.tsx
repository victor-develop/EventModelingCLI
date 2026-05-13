import React from 'react';
import type { RenderedEdge } from '@em/layout/types';
import { EDGE_COLORS } from '../types';

interface GraphEdgeProps {
  edge: RenderedEdge;
}

const GraphEdge = React.memo(function GraphEdge({ edge }: GraphEdgeProps) {
  if (!edge.points || edge.points.length < 2) return null;

  const color = EDGE_COLORS[edge.kind] ?? '#555';
  const pointsStr = edge.points.map(p => `${p[0]},${p[1]}`).join(' ');

  const last = edge.points[edge.points.length - 1];
  const prev = edge.points[edge.points.length - 2];
  if (!last || !prev) return null;

  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const arrowLen = 10;

  return (
    <g>
      <polyline
        points={pointsStr}
        fill="none"
        stroke={`${color}88`}
        strokeWidth={2}
      />
      <line
        x1={last[0]}
        y1={last[1]}
        x2={last[0] - arrowLen * Math.cos(angle - Math.PI / 7)}
        y2={last[1] - arrowLen * Math.sin(angle - Math.PI / 7)}
        stroke={`${color}cc`}
        strokeWidth={2.5}
      />
      <line
        x1={last[0]}
        y1={last[1]}
        x2={last[0] - arrowLen * Math.cos(angle + Math.PI / 7)}
        y2={last[1] - arrowLen * Math.sin(angle + Math.PI / 7)}
        stroke={`${color}cc`}
        strokeWidth={2.5}
      />
    </g>
  );
});

export { GraphEdge };
