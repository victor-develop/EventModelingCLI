import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ReactFlowProvider } from '@xyflow/react';
import { SwimlaneGroupNode } from './SwimlaneGroupNode';
import { CommandNode } from './CommandNode';
import { OrthogonalDisplayEdge } from './OrthogonalDisplayEdge';
import { FrontierHandleNode } from './FrontierHandleNode';

describe('xyflow components', () => {
  test('renders a swimlane group label', () => {
    render(<SwimlaneGroupNode {...({ id: 'lane:shared', data: { lane: 'shared', label: 'shared' } } as any)} />);
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
          } as any)}
        />
      </ReactFlowProvider> as any,
    );

    expect(screen.getByText('cmd')).toBeInTheDocument();
    expect(screen.getByText('Submit Order')).toBeInTheDocument();
    expect(screen.getByText('cmd.submit-order')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
  });

  test('renders an orthogonal edge from layout points', () => {
    const { container } = render(
      <svg>
        <OrthogonalDisplayEdge
          {...({
            id: 'edge-cmd-to-evt',
            source: 'occ-cmd',
            target: 'occ-evt',
            selected: false,
            data: { kind: 'cmd-to-evt', points: [[10, 20], [30, 20], [30, 60]] },
          } as any)}
        />
      </svg> as any,
    );

    expect(container.querySelector('path.em-edge-path')).toHaveAttribute('d', 'M 10 20 L 30 20 L 30 60');
  });

  test('renders a frontier handle node', () => {
    render(<FrontierHandleNode {...({ id: 'frontier:right', data: { direction: 'right', label: 'Explore right' } } as any)} />);
    expect(screen.getByLabelText('Explore right')).toBeInTheDocument();
  });
});
