import type { NodeProps, Node } from '@xyflow/react';
import type { SwimlaneNodeData } from '../adapter/types';

type SwimlaneProps = NodeProps<Node<SwimlaneNodeData>>;

export function SwimlaneGroupNode({ data }: SwimlaneProps) {
  return (
    <div className={`swimlane-group lane-${data.lane}`}>
      <div className="swimlane-label">{data.label}</div>
    </div>
  );
}
