import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Position, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react';
import type { ReactFlowNodeData, SwimlaneNodeData, FrontierHandleData } from '../adapter/types';
import { SwimlaneGroupNode } from './SwimlaneGroupNode';
import { CommandNode } from './CommandNode';
import { ViewModelNode } from './ViewModelNode';
import { OrthogonalDisplayEdge } from './OrthogonalDisplayEdge';
import { FrontierHandleNode } from './FrontierHandleNode';

describe('xyflow components', () => {
  test('renders a swimlane group label', () => {
    const props = { id: 'lane:shared', data: { lane: 'shared', label: 'shared' } } as unknown as NodeProps<Node<SwimlaneNodeData>>;
    render(<SwimlaneGroupNode {...props} />);
    expect(screen.getByText('shared')).toBeInTheDocument();
  });

  test('renders an occurrence node with badge, label, id, and lock state', () => {
    render(
      <ReactFlowProvider>
        <CommandNode
          {...({
            id: 'occ-cmd-submit-order',
            type: 'em.cmd',
            selected: true,
            data: {
              canonicalNodeId: 'cmd.submit-order',
              label: 'Submit Order',
              visibleLane: 'commandViewModel',
              lockLevel: 'hard',
            },
          } as unknown as NodeProps<Node<ReactFlowNodeData>>)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('cmd')).toBeInTheDocument();
    expect(screen.getByText('Submit Order')).toBeInTheDocument();
    expect(screen.getByText('cmd.submit-order')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
  });

  test('renders view model badge with full label', () => {
    render(
      <ReactFlowProvider>
        <ViewModelNode
          {...({
            id: 'occ-vm-order-detail',
            type: 'em.viewModel',
            selected: false,
            data: {
              canonicalNodeId: 'vm.order-detail',
              label: 'Order Detail',
              visibleLane: 'commandViewModel',
              lockLevel: 'none',
            },
          } as unknown as NodeProps<Node<ReactFlowNodeData>>)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('view model')).toBeInTheDocument();
  });

  test('renders an orthogonal edge with BaseEdge smooth-step path', () => {
    const { container } = render(
      <svg>
        <OrthogonalDisplayEdge
          {...({
            id: 'edge-cmd-to-evt',
            source: 'occ-cmd',
            target: 'occ-evt',
            selected: false,
            sourceX: 10,
            sourceY: 20,
            targetX: 80,
            targetY: 60,
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            markerEnd: 'url(#edge-arrow)',
            data: { kind: 'cmd-to-evt' },
          } as unknown as Parameters<typeof OrthogonalDisplayEdge>[0])}
        />
      </svg>,
    );

    const path = container.querySelector('path.em-edge-path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')).toContain('M10 20');
    expect(path).toHaveAttribute('marker-end', 'url(#edge-arrow)');
    expect(container.querySelector('path.react-flow__edge-interaction')).toBeInTheDocument();
  });

  test('renders a frontier handle node', () => {
    const props = {
      id: 'frontier:right',
      data: { direction: 'right', label: 'Explore right' },
    } as unknown as NodeProps<Node<FrontierHandleData>>;
    render(<FrontierHandleNode {...props} />);
    expect(screen.getByLabelText('Explore right')).toBeInTheDocument();
  });
});
