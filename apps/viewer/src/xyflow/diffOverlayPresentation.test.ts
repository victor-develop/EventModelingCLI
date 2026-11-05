import { describe, expect, test } from 'vitest';
import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import { isCompareOverlayActive } from './diffOverlayPresentation';

const draft: NonNullable<VisualizationSnapshot['draft']> = {
  id: 'draft_002',
  status: 'draft',
  baseRevisionId: 'rev_001',
  message: 'Compare overlay',
  graph: 'compare',
  diff: 'overlay',
};

const diffOverlay = {
  nodesByCanonicalId: {},
  edgesById: {},
  visibleChanges: [],
  hiddenChanges: [],
  summary: {},
};

describe('isCompareOverlayActive', () => {
  test('enables subdued unchanged elements only for compare overlay snapshots', () => {
    expect(isCompareOverlayActive({ draft, diffOverlay })).toBe(true);
    expect(isCompareOverlayActive({ draft: { ...draft, graph: 'after' }, diffOverlay })).toBe(false);
    expect(isCompareOverlayActive({ draft: { ...draft, diff: 'off' }, diffOverlay })).toBe(false);
    expect(isCompareOverlayActive({ draft })).toBe(false);
  });
});
