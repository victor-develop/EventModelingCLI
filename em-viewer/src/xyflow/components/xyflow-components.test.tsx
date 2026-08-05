import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { Position, ReactFlowProvider, type Node, type NodeProps } from '@xyflow/react';
import type { ReactFlowNodeData, SwimlaneNodeData, FrontierHandleData } from '../adapter/types';
import { SwimlaneGroupNode } from './SwimlaneGroupNode';
import { CommandNode } from './CommandNode';
import { ViewModelNode } from './ViewModelNode';
import { SharedNode } from './SharedNode';
import { OrthogonalDisplayEdge } from './OrthogonalDisplayEdge';
import { FrontierHandleNode } from './FrontierHandleNode';
import { DiffSelectionProvider } from './DiffSelectionContext';

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  const { createPortal } = await import('react-dom');

  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => {
      const host = document.querySelector('.react-flow__edgelabel-renderer');
      return host ? createPortal(children, host) : null;
    },
  };
});

const originalResizeObserver = globalThis.ResizeObserver;

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
});

afterEach(() => {
  cleanup();
});

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

    const badge = screen.getByText('cmd');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('kind-cmd');
    expect(badge).not.toHaveClass('lane-commandViewModel');
    expect(badge.querySelector('.em-node-badge-icon')).toBeInTheDocument();
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
    expect(screen.getByText('view model')).toHaveClass('kind-viewModel');
    expect(screen.getByText('view model')).not.toHaveClass('lane-commandViewModel');
  });

  test('renders processor badge from node type instead of role lane', () => {
    render(
      <ReactFlowProvider>
        <SharedNode
          {...({
            id: 'occ-proc-public-api',
            type: 'em.proc',
            selected: false,
            data: {
              canonicalNodeId: 'returns.proc.public-api',
              label: 'Public API',
              visibleLane: 'role:role.buyer',
              lockLevel: 'none',
            },
          } as unknown as NodeProps<Node<ReactFlowNodeData>>)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('proc')).toHaveClass('kind-proc');
    expect(screen.getByText('proc')).not.toHaveClass('lane-role');
  });

  test('renders role marker with a role badge and label', () => {
    render(
      <ReactFlowProvider>
        <SharedNode
          {...({
            id: 'occ-role-buyer',
            type: 'em.role',
            selected: false,
            data: {
              canonicalNodeId: 'role.buyer',
              label: 'Buyer',
              visibleLane: 'role:role.buyer',
              lockLevel: 'none',
            },
          } as unknown as NodeProps<Node<ReactFlowNodeData>>)}
        />
      </ReactFlowProvider>,
    );

    expect(screen.getByText('role')).toHaveClass('kind-role');
    expect(screen.getByText('Buyer')).toHaveClass('em-role-marker-label');
  });

  test('opens all node diff changes from the node diff chip', () => {
    const onDiffSelect = vi.fn();
    render(
      <ReactFlowProvider>
        <DiffSelectionProvider onSelect={onDiffSelect}>
          <CommandNode
            {...({
              id: 'occ-cmd-submit-order',
              type: 'em.cmd',
              selected: false,
              data: {
                canonicalNodeId: 'cmd.submit-order',
                label: 'Submit Order',
                visibleLane: 'commandViewModel',
                lockLevel: 'none',
                diff: {
                  status: 'changed',
                  changeIds: ['node:cmd.submit-order', 'schema:command:cmd.submit-order'],
                },
              },
            } as unknown as NodeProps<Node<ReactFlowNodeData>>)}
          />
        </DiffSelectionProvider>
      </ReactFlowProvider>,
    );

    fireEvent.click(screen.getByLabelText('changed change for cmd.submit-order'));

    expect(onDiffSelect).toHaveBeenCalledWith(['node:cmd.submit-order', 'schema:command:cmd.submit-order']);
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

  test.each([
    ['added', 'M -5 0 L 5 0'],
    ['changed', 'M -5 2 L -2 -3 L 2 3 L 5 -2'],
    ['removed', 'M -4 -4 L 4 4'],
  ] as const)('renders a visible %s diff marker through the React Flow edge label renderer', (status, expectedGlyph) => {
    const labelHost = document.createElement('div');
    labelHost.className = 'react-flow__edgelabel-renderer';
    document.body.appendChild(labelHost);

    const { container, unmount } = render(
      <svg>
        <OrthogonalDisplayEdge
          {...({
            id: `edge-${status}`,
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
            data: {
              kind: 'cmd-to-evt',
              diff: { status, changeIds: [`edge:${status}`] },
            },
          } as unknown as Parameters<typeof OrthogonalDisplayEdge>[0])}
        />
      </svg>,
    );

    try {
      const marker = screen.getByLabelText(`${status} edge`);
      expect(marker).toBeInTheDocument();
      expect(marker).toHaveClass('em-edge-diff-marker', `diff-${status}`, 'nopan', 'nodrag');
      expect(marker.getAttribute('style')).toContain('translate(-50%, -50%) translate(');
      expect(marker.closest('.react-flow__edgelabel-renderer')).toBe(labelHost);
      expect(marker.querySelector('circle')).toBeInTheDocument();
      expect([...marker.querySelectorAll('path')].some((path) => path.getAttribute('d') === expectedGlyph)).toBe(true);
      expect(container.querySelector(`path.em-edge-path.diff-${status}`)).toBeInTheDocument();
    } finally {
      unmount();
      labelHost.remove();
    }
  });

  test('opens all edge diff changes from the marker and edge path', () => {
    const labelHost = document.createElement('div');
    labelHost.className = 'react-flow__edgelabel-renderer';
    document.body.appendChild(labelHost);
    const onDiffSelect = vi.fn();

    const { container, unmount } = render(
      <DiffSelectionProvider onSelect={onDiffSelect}>
        <svg>
          <OrthogonalDisplayEdge
            {...({
              id: 'edge-changed',
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
              data: {
                kind: 'cmd-to-evt',
                diff: {
                  status: 'changed',
                  changeIds: ['edge:edge_32', 'schema:viewModel:returns.view.return.detail'],
                },
              },
            } as unknown as Parameters<typeof OrthogonalDisplayEdge>[0])}
          />
        </svg>
      </DiffSelectionProvider>,
    );

    try {
      fireEvent.click(screen.getByLabelText('changed edge'));
      fireEvent.click(container.querySelector('path.em-edge-path.diff-changed')!);

      expect(onDiffSelect).toHaveBeenNthCalledWith(1, ['edge:edge_32', 'schema:viewModel:returns.view.return.detail']);
      expect(onDiffSelect).toHaveBeenNthCalledWith(2, ['edge:edge_32', 'schema:viewModel:returns.view.return.detail']);
    } finally {
      unmount();
      labelHost.remove();
    }
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
