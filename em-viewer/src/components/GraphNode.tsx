import React from 'react';
import type { Occurrence } from '@em/layout/types';
import { NODE_COLORS } from '../types';

interface GraphNodeProps {
  occurrence: Occurrence;
  getDisplayName: (canonicalNodeId: string) => string;
}

const GraphNode = React.memo(function GraphNode({ occurrence, getDisplayName }: GraphNodeProps) {
  const color = NODE_COLORS[occurrence.nodeKind] ?? NODE_COLORS.shared;
  const name = getDisplayName(occurrence.canonicalNodeId);
  const { x, y, width, height } = occurrence;

  return (
    <g>
      <defs>
        <filter id={`glow-${occurrence.occurrenceId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={color} floodOpacity="0.5" />
        </filter>
      </defs>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        fill={`${color}33`}
        stroke={`${color}bb`}
        strokeWidth={1.5}
        filter={`url(#glow-${occurrence.occurrenceId})`}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 - 4}
        fill="#eee"
        fontSize={12}
        fontFamily="Inter, sans-serif"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {name}
      </text>
      <text
        x={x + width / 2}
        y={y + height - 7}
        fill={`${color}88`}
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
        {occurrence.nodeKind}
      </text>
    </g>
  );
});

export { GraphNode };
