import type { NodeProps, Node } from '@xyflow/react';
import type { SwimlaneNodeData } from '../adapter/types';
import { laneClassName } from './laneClassName';

type SwimlaneProps = NodeProps<Node<SwimlaneNodeData>>;

export function SwimlaneGroupNode({ data }: SwimlaneProps) {
  return (
    <div className={`swimlane-group ${laneClassName(data.lane)}`}>
      <div className="swimlane-label">{data.label}</div>
    </div>
  );
}
