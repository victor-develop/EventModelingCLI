import { computeVisibleSwimlaneRects, normalizeLayoutPatchForViewer } from '../src/viewer-contract/normalize';
import type { LayoutPatch, LayoutState, Occurrence } from '../src/layout/types';

function occurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    occurrenceId: 'occ',
    canonicalNodeId: 'node',
    nodeKind: 'cmd',
    lane: 'commandViewModel',
    stageIndex: 1,
    rowIndex: 0,
    displayRole: 'command',
    branchClusterId: 'branch',
    lockLevel: 'none',
    x: 0,
    y: 0,
    width: 220,
    height: 56,
    ...overrides,
  };
}

describe('viewer normalization', () => {
  test('visible swimlane rects share the same horizontal envelope', () => {
    const rects = computeVisibleSwimlaneRects([
      occurrence({
        occurrenceId: 'occ-ui',
        canonicalNodeId: 'ui.checkout',
        nodeKind: 'shared',
        lane: 'shared',
        displayRole: 'ui',
        x: 1600,
        y: 0,
      }),
      occurrence({
        occurrenceId: 'occ-cmd',
        canonicalNodeId: 'cmd.submit-order',
        nodeKind: 'cmd',
        lane: 'commandViewModel',
        displayRole: 'command',
        x: 0,
        y: 200,
      }),
      occurrence({
        occurrenceId: 'occ-event',
        canonicalNodeId: 'evt.order-submitted',
        nodeKind: 'evt',
        lane: 'event',
        displayRole: 'event',
        x: 800,
        y: 400,
      }),
    ]);

    const leftEdges = new Set(rects.map((rect) => rect.x));
    const widths = new Set(rects.map((rect) => rect.width));

    expect(leftEdges.size).toBe(1);
    expect(widths.size).toBe(1);
    expect(rects.find((rect) => rect.lane === 'shared')?.x).toBe(-40);
  });

  test('normalizes layout patches with the same visible swimlane envelope as snapshots', () => {
    const ui = occurrence({
      occurrenceId: 'occ-ui',
      canonicalNodeId: 'ui.checkout',
      nodeKind: 'shared',
      lane: 'nonRole',
      displayRole: 'ui',
      lockLevel: 'free',
      x: 1600,
      y: 0,
    });
    const cmd = occurrence({
      occurrenceId: 'occ-cmd',
      canonicalNodeId: 'cmd.submit-order',
      nodeKind: 'cmd',
      lane: 'commandViewModel',
      displayRole: 'command',
      x: 0,
      y: 200,
    });
    const event = occurrence({
      occurrenceId: 'occ-event',
      canonicalNodeId: 'evt.order-submitted',
      nodeKind: 'evt',
      lane: 'event',
      displayRole: 'event',
      x: 800,
      y: 400,
    });
    const patch: LayoutPatch = {
      addedOccurrences: [ui],
      updatedOccurrences: [],
      addedEdges: [],
      updatedEdges: [],
      updatedStageRange: { min: 0, max: 4 },
      viewportHint: { revealDirection: 'right' },
      updatedSwimlaneRects: [
        { lane: 'nonRole', x: 1560, y: -40, width: 300, height: 136 },
        { lane: 'commandViewModel', x: -40, y: 160, width: 1900, height: 136 },
        { lane: 'event', x: 760, y: 360, width: 300, height: 136 },
      ],
    };

    const normalized = normalizeLayoutPatchForViewer(patch, layoutState([ui, cmd, event]));
    const leftEdges = new Set(normalized.updatedSwimlaneRects.map((rect) => rect.x));
    const widths = new Set(normalized.updatedSwimlaneRects.map((rect) => rect.width));

    expect(normalized.addedOccurrences[0]?.lane).toBe('shared');
    expect(normalized.addedOccurrences[0]?.lockLevel).toBe('none');
    expect(leftEdges.size).toBe(1);
    expect(widths.size).toBe(1);
    expect(normalized.updatedSwimlaneRects.find((rect) => rect.lane === 'shared')?.x).toBe(-40);
  });

  test('preserves role lanes instead of collapsing them into shared', () => {
    const buyerUi = occurrence({
      occurrenceId: 'occ-buyer-ui',
      canonicalNodeId: 'ui.screen.return-request',
      nodeKind: 'shared',
      lane: 'role:role.buyer',
      displayRole: 'ui',
      x: 0,
      y: 0,
    });
    const merchantUi = occurrence({
      occurrenceId: 'occ-merchant-ui',
      canonicalNodeId: 'ui.screen.return-review',
      nodeKind: 'shared',
      lane: 'role:role.merchant',
      displayRole: 'ui',
      x: 400,
      y: 200,
    });

    const normalized = normalizeLayoutPatchForViewer({
      addedOccurrences: [buyerUi, merchantUi],
      updatedOccurrences: [],
      addedEdges: [],
      updatedEdges: [],
      updatedStageRange: { min: 0, max: 1 },
      viewportHint: {},
      updatedSwimlaneRects: [],
    }, layoutState([buyerUi, merchantUi]));

    expect(normalized.addedOccurrences.map((occ) => occ.lane)).toEqual([
      'role:role.buyer',
      'role:role.merchant',
    ]);
    expect(normalized.updatedSwimlaneRects.map((rect) => rect.lane)).toEqual([
      'role:role.buyer',
      'role:role.merchant',
    ]);
  });
});

function layoutState(occurrences: Occurrence[]): LayoutState {
  return {
    occurrences: Object.fromEntries(occurrences.map((occ) => [occ.occurrenceId, occ])),
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
  };
}
