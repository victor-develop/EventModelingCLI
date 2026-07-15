import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Lock } from 'lucide-react';
import type { ReactFlowNodeData } from '../adapter/types';
import { laneClassName } from './laneClassName';

type EmNodeProps = NodeProps<Node<ReactFlowNodeData>>;

const KIND_LABEL: Record<string, string> = {
  'em.cmd': 'cmd',
  'em.evt': 'event',
  'em.viewModel': 'view model',
  'em.ui': 'ui',
  'em.trigger': 'trigger',
  'em.proc': 'proc',
  'em.shared': 'shared',
};

export function BaseOccurrenceNode(props: EmNodeProps) {
  const data = props.data;
  const kind = KIND_LABEL[props.type ?? ''] ?? 'node';
  const locked = data.lockLevel === 'hard';

  return (
    <div className={`em-node ${props.selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
      <Handle className="em-node-handle" type="target" position={Position.Left} />
      <div className="em-node-topline">
        <span className={`em-node-badge ${laneClassName(data.visibleLane)}`}>{kind}</span>
        {locked && <Lock size={13} aria-label="Locked" />}
      </div>
      <div className="em-node-title" title={data.label}>{data.label}</div>
      <div className="em-node-id" title={data.canonicalNodeId}>{data.canonicalNodeId}</div>
      <Handle className="em-node-handle" type="source" position={Position.Right} />
    </div>
  );
}
