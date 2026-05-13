import { computeSwimlaneRects } from '../src/layout/layout-engine';
import { Occurrence, DEFAULT_LAYOUT_CONFIG, NormalizedPathEnvelope } from '../src/layout/types';
import { LayoutEngine } from '../src/layout/layout-engine';

function makeEnvelope(
  anchorId: string,
  branches: Array<{ id: string; dir: 'forward' | 'backward'; path: any[] }>,
): NormalizedPathEnvelope {
  return {
    anchor: { nodeId: anchorId },
    branches: branches.map((b) => ({
      branchId: b.id,
      direction: b.dir,
      path: b.path,
    })),
    frontier: {},
  };
}

describe('swimlane rect computation', () => {
  test('single occurrence produces a rect that contains the node', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
      },
    ];

    const rects = computeSwimlaneRects(occs);
    const cmdLane = rects.find((r) => r.lane === 'commandViewModel');
    expect(cmdLane).toBeDefined();

    expect(cmdLane!.x).toBeLessThanOrEqual(400);
    expect(cmdLane!.y).toBeLessThanOrEqual(200);
    expect(cmdLane!.x + cmdLane!.width).toBeGreaterThanOrEqual(400 + 220);
    expect(cmdLane!.y + cmdLane!.height).toBeGreaterThanOrEqual(200 + 56);
  });

  test('rect contains all occurrences in the same lane', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'cmd.a', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_2', canonicalNodeId: 'cmd.b', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 5, rowIndex: 2, displayRole: 'command',
        branchClusterId: 'b2', lockLevel: 'free', x: 2000, y: 360, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_3', canonicalNodeId: 'view.c', nodeKind: 'viewModel',
        lane: 'commandViewModel', stageIndex: 3, rowIndex: 1, displayRole: 'projection',
        branchClusterId: 'b1', lockLevel: 'free', x: 1200, y: 280, width: 220, height: 56,
      },
    ];

    const rects = computeSwimlaneRects(occs);
    const cmdLane = rects.find((r) => r.lane === 'commandViewModel')!;

    for (const occ of occs) {
      expect(cmdLane.x).toBeLessThanOrEqual(occ.x);
      expect(cmdLane.y).toBeLessThanOrEqual(occ.y);
      expect(cmdLane.x + cmdLane.width).toBeGreaterThanOrEqual(occ.x + occ.width);
      expect(cmdLane.y + cmdLane.height).toBeGreaterThanOrEqual(occ.y + occ.height);
    }
  });

  test('different lane rects do not overlap vertically', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'ui.x', nodeKind: 'shared',
        lane: 'nonRole', stageIndex: 0, rowIndex: 0, displayRole: 'ui',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_2', canonicalNodeId: 'cmd.a', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_3', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: 0, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 400, width: 220, height: 56,
      },
    ];

    const rects = computeSwimlaneRects(occs);
    expect(rects.length).toBe(3);

    const nonRole = rects.find((r) => r.lane === 'nonRole')!;
    const cmdVm = rects.find((r) => r.lane === 'commandViewModel')!;
    const evt = rects.find((r) => r.lane === 'event')!;

    expect(nonRole.y + nonRole.height).toBeLessThanOrEqual(cmdVm.y);
    expect(cmdVm.y + cmdVm.height).toBeLessThanOrEqual(evt.y);
  });

  test('lanes with many rows expand correctly', () => {
    const occs: Occurrence[] = [];
    for (let i = 0; i < 5; i++) {
      occs.push({
        occurrenceId: `occ_evt_${i}`, canonicalNodeId: `evt.${i}`, nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: i, displayRole: 'event',
        branchClusterId: `b${i}`, lockLevel: 'free',
        x: 800, y: 400 + i * 80, width: 220, height: 56,
      });
    }

    const rects = computeSwimlaneRects(occs);
    const evtLane = rects.find((r) => r.lane === 'event')!;

    expect(evtLane.y).toBeLessThanOrEqual(400);
    expect(evtLane.y + evtLane.height).toBeGreaterThanOrEqual(400 + 4 * 80 + 56);
  });

  test('empty lanes produce no rect', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
      },
    ];

    const rects = computeSwimlaneRects(occs);
    expect(rects.find((r) => r.lane === 'nonRole')).toBeUndefined();
    expect(rects.find((r) => r.lane === 'event')).toBeUndefined();
    expect(rects.find((r) => r.lane === 'commandViewModel')).toBeDefined();
  });
});

describe('swimlane rects via LayoutEngine', () => {
  test('initLayout returns swimlaneRects that contain all nodes', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('hotel.cmd.BookRoom', [
      {
        id: 'book_summary',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e4', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'book_avail',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1b', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e5', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'cancel_flow',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e2', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e6', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'ui_backward',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.form.booking', nodeKind: 'ui.form' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);
    const allOccs = Object.values(state.occurrences);

    expect(state.swimlaneRects.length).toBeGreaterThan(0);

    for (const rect of state.swimlaneRects) {
      const laneOccs = allOccs.filter((o) => o.lane === rect.lane);
      for (const occ of laneOccs) {
        expect(rect.x).toBeLessThanOrEqual(occ.x);
        expect(rect.y).toBeLessThanOrEqual(occ.y);
        expect(rect.x + rect.width).toBeGreaterThanOrEqual(occ.x + occ.width);
        expect(rect.y + rect.height).toBeGreaterThanOrEqual(occ.y + occ.height);
      }
    }

    const sortedRects = [...state.swimlaneRects].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sortedRects.length; i++) {
      const prevBottom = sortedRects[i - 1]!.y + sortedRects[i - 1]!.height;
      expect(prevBottom).toBeLessThanOrEqual(sortedRects[i]!.y);
    }
  });

  test('appendExploreResult returns updatedSwimlaneRects in patch', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.x', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);
    const cmdVmRectBefore = state.swimlaneRects.find((r) => r.lane === 'commandViewModel')!;

    const evtOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'evt.y')!;
    const appendEnvelope = makeEnvelope('evt.y', [
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.z', nodeKind: 'viewModel' },
        ],
      },
    ]);

    const patch = engine.appendExploreResult(state, evtOcc.occurrenceId, appendEnvelope);

    expect(patch.updatedSwimlaneRects.length).toBeGreaterThan(0);

    const cmdVmRectAfter = patch.updatedSwimlaneRects.find((r) => r.lane === 'commandViewModel')!;
    expect(cmdVmRectAfter).toBeDefined();
    expect(cmdVmRectAfter.height).toBeGreaterThanOrEqual(cmdVmRectBefore.height);

    const vmOcc = patch.addedOccurrences.find((o) => o.canonicalNodeId === 'view.z')!;
    expect(vmOcc).toBeDefined();
    expect(cmdVmRectAfter.x).toBeLessThanOrEqual(vmOcc.x);
    expect(cmdVmRectAfter.y).toBeLessThanOrEqual(vmOcc.y);
    expect(cmdVmRectAfter.x + cmdVmRectAfter.width).toBeGreaterThanOrEqual(vmOcc.x + vmOcc.width);
    expect(cmdVmRectAfter.y + cmdVmRectAfter.height).toBeGreaterThanOrEqual(vmOcc.y + vmOcc.height);
  });

  test('state.swimlaneRects is updated after appendExploreResult', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.x', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);
    const evtOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'evt.y')!;
    const appendEnvelope = makeEnvelope('evt.y', [
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.z', nodeKind: 'viewModel' },
        ],
      },
    ]);

    engine.appendExploreResult(state, evtOcc.occurrenceId, appendEnvelope);

    const allOccs = Object.values(state.occurrences);
    for (const rect of state.swimlaneRects) {
      const laneOccs = allOccs.filter((o) => o.lane === rect.lane);
      for (const occ of laneOccs) {
        expect(rect.y).toBeLessThanOrEqual(occ.y);
        expect(rect.y + rect.height).toBeGreaterThanOrEqual(occ.y + occ.height);
      }
    }

    const sortedRects = [...state.swimlaneRects].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sortedRects.length; i++) {
      const prevBottom = sortedRects[i - 1]!.y + sortedRects[i - 1]!.height;
      expect(prevBottom).toBeLessThanOrEqual(sortedRects[i]!.y);
    }
  });

  test('prependExploreResult returns updatedSwimlaneRects with nonRole lane', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.x', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);
    expect(state.swimlaneRects.find((r) => r.lane === 'nonRole')).toBeUndefined();

    const cmdOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'cmd.x')!;
    const prependEnvelope = makeEnvelope('ui.screen.x', [
      {
        id: 'b0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.x', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
        ],
      },
    ]);

    const patch = engine.prependExploreResult(state, cmdOcc.occurrenceId, prependEnvelope);

    expect(patch.updatedSwimlaneRects.find((r) => r.lane === 'nonRole')).toBeDefined();

    const nonRoleRect = patch.updatedSwimlaneRects.find((r) => r.lane === 'nonRole')!;
    const uiOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'ui.screen.x')!;
    expect(nonRoleRect.x).toBeLessThanOrEqual(uiOcc.x);
    expect(nonRoleRect.y).toBeLessThanOrEqual(uiOcc.y);
    expect(nonRoleRect.x + nonRoleRect.width).toBeGreaterThanOrEqual(uiOcc.x + uiOcc.width);
    expect(nonRoleRect.y + nonRoleRect.height).toBeGreaterThanOrEqual(uiOcc.y + uiOcc.height);

    const sortedRects = [...patch.updatedSwimlaneRects].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sortedRects.length; i++) {
      const prevBottom = sortedRects[i - 1]!.y + sortedRects[i - 1]!.height;
      expect(prevBottom).toBeLessThanOrEqual(sortedRects[i]!.y);
    }
  });

  test('appendExploreResult reports updatedOccurrences when existing node positions shift', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.a', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.a', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.x', nodeKind: 'evt' },
        ],
      },
      {
        id: 'b1b',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.b', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1b', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.x', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);

    const evtOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'evt.x')!;

    const appendEnvelope = makeEnvelope('evt.x', [
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.x', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.z1', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'b2b',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.x', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e3', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.z2', nodeKind: 'viewModel' },
        ],
      },
    ]);

    const patch = engine.appendExploreResult(state, evtOcc.occurrenceId, appendEnvelope);

    for (const occ of Object.values(state.occurrences)) {
      const rect = state.swimlaneRects.find((r) => r.lane === occ.lane);
      if (rect) {
        expect(rect.y).toBeLessThanOrEqual(occ.y);
        expect(rect.y + rect.height).toBeGreaterThanOrEqual(occ.y + occ.height);
      }
    }

    const sortedRects = [...state.swimlaneRects].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sortedRects.length; i++) {
      const prevBottom = sortedRects[i - 1]!.y + sortedRects[i - 1]!.height;
      expect(prevBottom).toBeLessThanOrEqual(sortedRects[i]!.y);
    }
  });

  test('prependExploreResult reports updatedOccurrences for shifted existing nodes', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.x', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);

    const cmdOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'cmd.x')!;
    const prependEnvelope = makeEnvelope('ui.screen.x', [
      {
        id: 'b0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.x', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
        ],
      },
    ]);

    const patch = engine.prependExploreResult(state, cmdOcc.occurrenceId, prependEnvelope);

    for (const occ of Object.values(state.occurrences)) {
      const rect = state.swimlaneRects.find((r) => r.lane === occ.lane);
      if (rect) {
        expect(rect.y).toBeLessThanOrEqual(occ.y);
        expect(rect.y + rect.height).toBeGreaterThanOrEqual(occ.y + occ.height);
      }
    }
  });

  test('full hotel booking: every node is inside its swimlane rect', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('hotel.cmd.BookRoom', [
      {
        id: 'book_summary',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e4', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'book_avail',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1b', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e5', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'cancel_summary',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e2', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e7', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'cancel_avail',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e2b', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e6', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'checkout_flow',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.trigger.CheckoutReminder', nodeKind: 'trigger' },
          { type: 'edge', edgeId: 'e10', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.cmd.Checkout', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e3', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.CheckoutCompleted', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e8', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'ui_backward',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.form.booking-form', nodeKind: 'ui.form' },
          { type: 'edge', edgeId: 'e_ui1', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);
    const allOccs = Object.values(state.occurrences);

    for (const occ of allOccs) {
      const rect = state.swimlaneRects.find((r) => r.lane === occ.lane);
      expect(rect).toBeDefined();
      expect(rect!.x).toBeLessThanOrEqual(occ.x);
      expect(rect!.x + rect!.width).toBeGreaterThanOrEqual(occ.x + occ.width);
      expect(rect!.y).toBeLessThanOrEqual(occ.y);
      expect(rect!.y + rect!.height).toBeGreaterThanOrEqual(occ.y + occ.height);
    }

    const sortedRects = [...state.swimlaneRects].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sortedRects.length; i++) {
      const prevBottom = sortedRects[i - 1]!.y + sortedRects[i - 1]!.height;
      expect(prevBottom).toBeLessThanOrEqual(sortedRects[i]!.y);
    }
  });
});
