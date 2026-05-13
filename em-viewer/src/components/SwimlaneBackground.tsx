import type { SwimlaneRect } from '@em/layout/types';
import { getLaneBg, getLaneLabel } from '../types';

interface SwimlaneBackgroundProps {
  swimlaneRects: SwimlaneRect[];
}

export function SwimlaneBackground({ swimlaneRects }: SwimlaneBackgroundProps) {
  return (
    <g>
      {swimlaneRects.map((rect, i) => (
        <g key={rect.lane}>
          <rect
            x={rect.x}
            y={rect.y}
            width={15000}
            height={rect.height}
            fill={getLaneBg(rect.lane)}
          />
          <text
            x={rect.x + 60}
            y={rect.y + 18}
            fill="rgba(255,255,255,0.1)"
            fontSize={11}
            fontFamily="monospace"
            fontWeight="bold"
          >
            {getLaneLabel(rect.lane).toUpperCase()}
          </text>
          {i < swimlaneRects.length - 1 && (
            <line
              x1={rect.x}
              y1={rect.y + rect.height}
              x2={rect.x + 15000}
              y2={rect.y + rect.height}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
              strokeDasharray="8,6"
            />
          )}
        </g>
      ))}
    </g>
  );
}
