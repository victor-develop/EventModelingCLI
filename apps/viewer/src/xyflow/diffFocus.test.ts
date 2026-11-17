import { describe, expect, test } from 'vitest';
import type {
  ViewerDiffChange,
  VisualizationSnapshot,
} from 'event-modeling-spec-cli/viewer-contract/types';
import {
  resolveDiffFocusTargets,
  resolveDiffFocusViewport,
} from './diffFocus';

describe('resolveDiffFocusTargets', () => {
  test('resolves every visible occurrence for a node change', () => {
    const targets = resolveDiffFocusTargets(snapshot(), [nodeChange('node:checkout-form', 'ui.form.checkout-form')]);

    expect(targets).toEqual({
      nodeIds: ['occ-checkout-form-2', 'occ-checkout-form-1'],
      edgeIds: [],
    });
  });

  test('resolves both endpoints and the displayed edge for an edge change', () => {
    const targets = resolveDiffFocusTargets(snapshot(), [edgeChange('edge:summary-to-form', 'edge_17')]);

    expect(targets).toEqual({
      nodeIds: ['occ-summary-1', 'occ-checkout-form-1'],
      edgeIds: ['display-edge-17'],
    });
  });

  test('fits diff targets inside the canvas area left of the diff drawer', () => {
    const viewport = resolveDiffFocusViewport(
      { x: 0, y: 0, width: 420, height: 56 },
      { left: 0, right: 883, width: 883, height: 1048 },
      { left: 444, right: 864, width: 420, height: 942 },
    );

    const scaledWidth = 420 * viewport.zoom;
    const left = viewport.x;
    const right = viewport.x + scaledWidth;

    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(444);
  });

  test('uses the full canvas when no overlay covers its horizontal area', () => {
    const viewport = resolveDiffFocusViewport(
      { x: 0, y: 0, width: 220, height: 56 },
      { left: 0, right: 883, width: 883, height: 1048 },
    );

    expect(viewport.x).toBeGreaterThan(0);
    expect(viewport.x + 220 * viewport.zoom).toBeLessThan(883);
  });
});

function nodeChange(id: string, targetNodeId: string): ViewerDiffChange {
  return {
    id,
    entityType: 'node',
    status: 'added',
    title: 'Node added',
    targetNodeId,
  };
}

function edgeChange(id: string, targetEdgeId: string): ViewerDiffChange {
  return {
    id,
    entityType: 'edge',
    status: 'added',
    title: 'Edge added',
    targetEdgeId,
  };
}

function snapshot(): VisualizationSnapshot {
  return {
    occurrences: [
      occurrence('occ-summary-1', 'hotel.view.booking-summary'),
      occurrence('occ-checkout-form-2', 'ui.form.checkout-form'),
      occurrence('occ-checkout-form-1', 'ui.form.checkout-form'),
    ],
    renderedEdges: [
      {
        displayEdgeId: 'display-edge-17',
        fromOccurrenceId: 'occ-summary-1',
        toOccurrenceId: 'occ-checkout-form-1',
        kind: 'viewModelConsumedByUiOrProcessor',
        points: [],
        meta: { originalEdgeId: 'edge_17' },
      },
    ],
  } as unknown as VisualizationSnapshot;
}

function occurrence(occurrenceId: string, canonicalNodeId: string) {
  return {
    occurrenceId,
    canonicalNodeId,
  };
}
