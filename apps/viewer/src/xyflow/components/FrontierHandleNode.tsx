import type { Node, NodeProps } from '@xyflow/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { FrontierHandleData } from '../adapter/types';

type FrontierHandleNodeProps = NodeProps<Node<FrontierHandleData>>;

export function FrontierHandleNode({ data }: FrontierHandleNodeProps) {
  const direction = data.direction;
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      className="frontier-handle"
      type="button"
      aria-label={data.label}
    >
      <Icon size={18} />
    </button>
  );
}
