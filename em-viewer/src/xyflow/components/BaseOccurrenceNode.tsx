import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Lock, UserRound } from 'lucide-react';
import type { ReactFlowNodeData } from '../adapter/types';
import { nodeBadgeClassNameFromType, nodeBadgeLabelFromType } from './nodeVisualKind';

type EmNodeProps = NodeProps<Node<ReactFlowNodeData>>;

export function BaseOccurrenceNode(props: EmNodeProps) {
  const data = props.data;
  const kind = nodeBadgeLabelFromType(props.type);
  const locked = data.lockLevel === 'hard';
  const isRoleMarker = props.type === 'em.role';

  if (isRoleMarker) {
    return (
      <div className={`em-node em-role-marker ${props.selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
        <Handle className="em-node-handle" type="target" position={Position.Left} />
        <span className={`em-node-badge ${nodeBadgeClassNameFromType(props.type)}`}>{kind}</span>
        <div className="em-role-marker-body">
          <UserRound size={18} aria-hidden="true" />
          <span className="em-role-marker-label" title={data.label}>{data.label}</span>
        </div>
        <Handle className="em-node-handle" type="source" position={Position.Right} />
      </div>
    );
  }

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
