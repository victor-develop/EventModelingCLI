import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { DiffPanel } from './DiffPanel';

describe('DiffPanel', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders all visible changes and opens the selected change', () => {
    const onSelectChangeIds = vi.fn();
    render(
      <DiffPanel
        snapshot={snapshotWithChanges(10)}
        selectedChangeIds={['node:change-9']}
        onSelectChangeIds={onSelectChangeIds}
      />,
    );

    expect(screen.getByText('Change 0 node added')).toBeInTheDocument();
    expect(screen.getByText('Change 9 node added')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Change 9 node added'));

    expect(onSelectChangeIds).toHaveBeenCalledWith(['node:change-9']);
  });

  test('collapses and expands the draft diff panel', () => {
    render(
      <DiffPanel
        snapshot={snapshotWithChanges(2)}
        selectedChangeIds={[]}
        onSelectChangeIds={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Collapse draft diff' }));

    expect(screen.queryByText('Change 0 node added')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand draft diff' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand draft diff' }));

    expect(screen.getByText('Change 0 node added')).toBeInTheDocument();
  });
});

function snapshotWithChanges(count: number): VisualizationSnapshot {
  return {
    focusNodeId: 'node:focus',
    projectName: 'Returns Management',
    draft: {
      id: 'draft_001',
      status: 'open',
      baseRevisionId: 'rev_001',
      message: 'Draft',
      graph: 'compare',
      diff: 'overlay',
    },
    diffOverlay: {
      nodesByCanonicalId: {},
      edgesById: {},
      visibleChanges: Array.from({ length: count }, (_, index) => ({
        id: `node:change-${index}`,
        entityType: 'node',
        status: 'added',
        title: `Change ${index} node added`,
        targetNodeId: `node.change-${index}`,
      })),
      hiddenChanges: [],
      summary: { totalChanges: count },
    },
    truncation: {
      includeTruncatedPaths: false,
      hiddenPathCount: 0,
    },
    layoutState: {
      occurrences: {},
      displayEdges: {},
      stageBuckets: {},
      laneRows: {},
      locks: {},
      frontierHandles: {},
      viewport: {
        minStage: 0,
        maxStage: 0,
        zoom: 1,
        centerX: 0,
        centerY: 0,
      },
      swimlaneRects: [],
    },
    occurrences: [],
    renderedEdges: [],
    swimlaneRects: [],
    laneDescriptors: [],
    domainNodes: {},
    domainEdges: {},
    laneMap: {},
  };
}
