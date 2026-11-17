import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type {
  ViewerDiffChange,
  VisualizationSnapshot,
} from 'event-modeling-spec-cli/viewer-contract/types';
import { DiffDrawer } from './DiffDrawer';

afterEach(() => {
  cleanup();
});

describe('DiffDrawer', () => {
  test('renders field-level before and after details for a changed edge', () => {
    render(
      <DiffDrawer
        changeIds={['edge:edge_32']}
        changesById={new Map([
          ['edge:edge_32', edgeChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Diff detail' })).toBeInTheDocument();
    expect(screen.getByText('viewModelConsumedByUiOrProcessor edge_32 changed')).toBeInTheDocument();
    expect(screen.getByText('meta.fieldRefs[0]')).toBeInTheDocument();
    expect(screen.getAllByText('label-status').length).toBeGreaterThan(0);
    expect(screen.getAllByText((content) => content.includes('[REDACTED]')).length).toBeGreaterThan(0);
    expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
  });

  test('redacts sensitive scalar values in field-level rows', () => {
    render(
      <DiffDrawer
        changeIds={['edge:edge-secret']}
        changesById={new Map([
          ['edge:edge-secret', sensitiveScalarChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('meta.apiKey')).toBeInTheDocument();
    expect(screen.getAllByText('[REDACTED]').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('old-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('new-secret')).not.toBeInTheDocument();
  });

  test('shows related changes for a grouped node marker and can switch selection', () => {
    const onSelectChangeIds = vi.fn();
    render(
      <DiffDrawer
        changeIds={['node:returns.view.return.detail', 'schema:viewModel:returns.view.return.detail']}
        changesById={new Map([
          ['node:returns.view.return.detail', nodeChange()],
          ['schema:viewModel:returns.view.return.detail', schemaChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={onSelectChangeIds}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('view model schema returns.view.return.detail changed'));

    expect(onSelectChangeIds).toHaveBeenCalledWith([
      'schema:viewModel:returns.view.return.detail',
      'node:returns.view.return.detail',
    ]);
  });

  test('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <DiffDrawer
        changeIds={['node:returns.view.return.detail']}
        changesById={new Map([
          ['node:returns.view.return.detail', nodeChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('renders an added edge as source, relation, target, and collapses technical payload', () => {
    render(
      <DiffDrawer
        changeIds={['edge:edge_17']}
        changesById={new Map([
          ['edge:edge_17', addedEdgeChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Booking Summary')).toBeInTheDocument();
    expect(screen.getByText('Booking Confirmation')).toBeInTheDocument();
    expect(screen.getByText('consumed by')).toBeInTheDocument();
    expect(screen.getByText('booking_id')).toBeInTheDocument();
    expect(screen.getByText('guest_name')).toBeInTheDocument();
    expect(screen.getByText('Technical payload').closest('details')).not.toHaveAttribute('open');
  });

  test('opens technical payload by default when no model preview is available', () => {
    render(
      <DiffDrawer
        changeIds={['schema:viewModel:returns.view.return.detail']}
        changesById={new Map([
          ['schema:viewModel:returns.view.return.detail', schemaChange()],
        ])}
        snapshot={snapshot()}
        onSelectChangeIds={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/structured model preview is not available/i)).toBeInTheDocument();
    expect(screen.getByText('Technical payload').closest('details')).toHaveAttribute('open');
  });
});

function edgeChange(): ViewerDiffChange {
  return {
    id: 'edge:edge_32',
    entityType: 'edge',
    status: 'changed',
    title: 'viewModelConsumedByUiOrProcessor edge_32 changed',
    targetNodeId: 'returns.view.return.detail',
    targetEdgeId: 'edge_32',
    before: {
      id: 'edge_32',
      type: 'viewModelConsumedByUiOrProcessor',
      fromNodeId: 'returns.view.return.detail',
      toNodeId: 'ui.return.detail',
      meta: { apiKey: 'secret-value' },
    },
    after: {
      id: 'edge_32',
      type: 'viewModelConsumedByUiOrProcessor',
      fromNodeId: 'returns.view.return.detail',
      toNodeId: 'ui.return.detail',
      meta: { apiKey: 'secret-value', fieldRefs: ['label-status'] },
    },
    changedFields: ['meta.fieldRefs[0]'],
    fieldChanges: [
      { path: 'meta.fieldRefs[0]', status: 'added', after: 'label-status' },
    ],
  };
}

function sensitiveScalarChange(): ViewerDiffChange {
  return {
    id: 'edge:edge-secret',
    entityType: 'edge',
    status: 'changed',
    title: 'secret edge changed',
    targetEdgeId: 'edge-secret',
    before: {
      id: 'edge-secret',
      type: 'viewModelConsumedByUiOrProcessor',
      fromNodeId: 'returns.view.return.detail',
      toNodeId: 'ui.return.detail',
      meta: { apiKey: 'old-secret' },
    },
    after: {
      id: 'edge-secret',
      type: 'viewModelConsumedByUiOrProcessor',
      fromNodeId: 'returns.view.return.detail',
      toNodeId: 'ui.return.detail',
      meta: { apiKey: 'new-secret' },
    },
    changedFields: ['meta.apiKey'],
    fieldChanges: [
      { path: 'meta.apiKey', status: 'changed', before: 'old-secret', after: 'new-secret' },
    ],
  };
}

function addedEdgeChange(): ViewerDiffChange {
  return {
    id: 'edge:edge_17',
    entityType: 'edge',
    status: 'added',
    title: 'viewModelConsumedByUiOrProcessor edge_17 added',
    targetNodeId: 'hotel.view.booking-summary',
    targetEdgeId: 'edge_17',
    after: {
      id: 'edge_17',
      type: 'viewModelConsumedByUiOrProcessor',
      fromNodeId: 'hotel.view.booking-summary',
      toNodeId: 'ui.form.booking-confirmation',
      meta: {
        fieldRefs: ['booking_id', 'guest_name'],
      },
    },
  };
}

function nodeChange(): ViewerDiffChange {
  return {
    id: 'node:returns.view.return.detail',
    entityType: 'node',
    status: 'changed',
    title: 'Return Detail node changed',
    targetNodeId: 'returns.view.return.detail',
    before: { canonicalId: 'returns.view.return.detail', displayName: 'Return Detail' },
    after: { canonicalId: 'returns.view.return.detail', displayName: 'Return Detail Draft' },
    changedFields: ['displayName'],
    fieldChanges: [
      { path: 'displayName', status: 'changed', before: 'Return Detail', after: 'Return Detail Draft' },
    ],
  };
}

function schemaChange(): ViewerDiffChange {
  return {
    id: 'schema:viewModel:returns.view.return.detail',
    entityType: 'schema',
    status: 'changed',
    title: 'view model schema returns.view.return.detail changed',
    targetNodeId: 'returns.view.return.detail',
    before: { viewModelNodeId: 'returns.view.return.detail', fields: [] },
    after: { viewModelNodeId: 'returns.view.return.detail', fields: [{ fieldId: 'label-status' }] },
    changedFields: ['fields[0]'],
    fieldChanges: [
      { path: 'fields[0]', status: 'added', after: { fieldId: 'label-status' } },
    ],
  };
}

function snapshot(): Pick<VisualizationSnapshot, 'domainNodes'> {
  return {
    domainNodes: {
      'hotel.view.booking-summary': {
        id: 'node_booking_summary',
        projectId: 'hotel',
        kind: 'viewModel',
        canonicalId: 'hotel.view.booking-summary',
        displayName: 'Booking Summary',
        tags: [],
        domains: [],
      },
      'ui.form.booking-confirmation': {
        id: 'node_booking_confirmation',
        projectId: 'hotel',
        kind: 'ui.form',
        canonicalId: 'ui.form.booking-confirmation',
        displayName: 'Booking Confirmation',
        tags: [],
        domains: [],
      },
      'returns.view.return.detail': {
        id: 'node_return_detail',
        projectId: 'returns',
        kind: 'viewModel',
        canonicalId: 'returns.view.return.detail',
        displayName: 'Return Detail',
        tags: [],
        domains: [],
      },
      'ui.return.detail': {
        id: 'node_return_ui',
        projectId: 'returns',
        kind: 'ui.screen',
        canonicalId: 'ui.return.detail',
        displayName: 'Return Detail',
        tags: [],
        domains: [],
      },
    },
  };
}
