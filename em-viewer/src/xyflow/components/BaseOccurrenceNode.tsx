import type { NodeProps, Node } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Lock, UserRound } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { ReactFlowNodeData } from '../adapter/types';
import { useDiffSelection } from './DiffSelectionContext';
import { nodeBadgeClassNameFromType, nodeVisualMetaFromType } from './nodeVisualKind';

type EmNodeProps = NodeProps<Node<ReactFlowNodeData>>;

export function BaseOccurrenceNode(props: EmNodeProps) {
  const data = props.data;
  const visual = nodeVisualMetaFromType(props.type);
  const Icon = visual.Icon;
  const onDiffSelect = useDiffSelection();
  const locked = data.lockLevel === 'hard';
  const isRoleMarker = props.type === 'em.role';
  const diffClass = data.diff ? `diff-${data.diff.status}` : '';
  const handleDiffClick = (event: MouseEvent<HTMLButtonElement>) => {
    const changeIds = data.diff?.changeIds;
    if (!changeIds || changeIds.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    onDiffSelect?.(changeIds);
  };
  const diffChip = data.diff ? (
    <button
      type="button"
      className={`em-diff-chip nodrag nopan ${diffClass}`}
      title={`${data.diff.status} in draft`}
      aria-label={`${data.diff.status} change for ${data.canonicalNodeId}`}
      onClick={handleDiffClick}
    >
      {data.diff.status}
    </button>
  ) : null;

  if (isRoleMarker) {
    return (
      <div className={`em-node em-role-marker ${diffClass} ${props.selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
        <Handle className="em-node-handle" type="target" position={Position.Left} />
        <span className={`em-node-badge ${nodeBadgeClassNameFromType(props.type)}`}>
          <Icon className="em-node-badge-icon" size={11} strokeWidth={2.5} aria-hidden="true" />
          {visual.label}
        </span>
        {diffChip}
        <div className="em-role-marker-body">
          <UserRound size={18} aria-hidden="true" />
          <span className="em-role-marker-label" title={data.label}>{data.label}</span>
        </div>
        <Handle className="em-node-handle" type="source" position={Position.Right} />
      </div>
    );
  }

  return (
    <div className={`em-node ${diffClass} ${props.selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
      <Handle className="em-node-handle" type="target" position={Position.Left} />
      <div className="em-node-topline">
        <span className={`em-node-badge ${nodeBadgeClassNameFromType(props.type)}`}>
          <Icon className="em-node-badge-icon" size={11} strokeWidth={2.5} aria-hidden="true" />
          {visual.label}
        </span>
        {diffChip}
        {locked && <Lock size={13} aria-label="Locked" />}
      </div>
      <div className="em-node-title" title={data.label}>{data.label}</div>
      <div className="em-node-id" title={data.canonicalNodeId}>{data.canonicalNodeId}</div>
      <Handle className="em-node-handle" type="source" position={Position.Right} />
    </div>
  );
}
