import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Lock } from 'lucide-react';
import type { ReactFlowNodeData } from '../adapter/types';
import { nodeBadgeClassNameFromType, nodeBadgeLabelFromType } from './nodeVisualKind';

type EmNodeProps = NodeProps<Node<ReactFlowNodeData>>;

export function BaseOccurrenceNode(props: EmNodeProps) {
  const data = props.data;
  const kind = nodeBadgeLabelFromType(props.type);
  const locked = data.lockLevel === 'hard';

  return (
    <div className={`em-node ${props.selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
      <Handle className="em-node-handle" type="target" position={Position.Left} />
      <div className="em-node-topline">
        <span className={`em-node-badge ${nodeBadgeClassNameFromType(props.type)}`}>{kind}</span>
        {locked && <Lock size={13} aria-label="Locked" />}
      </div>
      <div className="em-node-title" title={data.label}>{data.label}</div>
      <div className="em-node-id" title={data.canonicalNodeId}>{data.canonicalNodeId}</div>
      <Handle className="em-node-handle" type="source" position={Position.Right} />
    </div>
  );
}
