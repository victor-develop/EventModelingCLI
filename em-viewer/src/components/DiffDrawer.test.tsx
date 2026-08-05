import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { ViewerDiffChange } from '@em/viewer-contract/types';
import { DiffDrawer } from './DiffDrawer';

describe('DiffDrawer', () => {
  test('renders field-level before and after details for a changed edge', () => {
    render(
      <DiffDrawer
        changeIds={['edge:edge_32']}
        changesById={new Map([
          ['edge:edge_32', edgeChange()],
        ])}
        onSelectChangeIds={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Diff detail' })).toBeInTheDocument();
    expect(screen.getByText('viewModelConsumedByUiOrProcessor edge_32 changed')).toBeInTheDocument();
    expect(screen.getByText('meta.fieldRefs[0]')).toBeInTheDocument();
    expect(screen.getByText('label-status')).toBeInTheDocument();
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
        onSelectChangeIds={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
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
      meta: { apiKey: 'secret-value' },
    },
    after: {
      id: 'edge_32',
      type: 'viewModelConsumedByUiOrProcessor',
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
    before: { id: 'edge-secret', meta: { apiKey: 'old-secret' } },
    after: { id: 'edge-secret', meta: { apiKey: 'new-secret' } },
    changedFields: ['meta.apiKey'],
    fieldChanges: [
      { path: 'meta.apiKey', status: 'changed', before: 'old-secret', after: 'new-secret' },
    ],
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
