import { LayoutEngine } from '../src/layout/layout-engine';
import { NormalizedPathEnvelope, DEFAULT_LAYOUT_CONFIG } from '../src/layout/types';

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

describe('canonical dedup', () => {
  test('two branches sharing the same cmd produce only one cmd occurrence', () => {
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
    ]);

    const state = engine.initLayout(envelope);
    const allOccs = Object.values(state.occurrences);

    const cmdOccs = allOccs.filter((o) => o.canonicalNodeId === 'hotel.cmd.BookRoom');
    expect(cmdOccs.length).toBe(1);

    const evtOccs = allOccs.filter((o) => o.canonicalNodeId === 'hotel.evt.RoomBooked');
    expect(evtOccs.length).toBe(1);
  });

  test('different cmds produce separate occurrences', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('hotel.cmd.BookRoom', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
        ],
      },
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e2', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);
    const allOccs = Object.values(state.occurrences);

    expect(allOccs.filter((o) => o.canonicalNodeId === 'hotel.cmd.BookRoom').length).toBe(1);
    expect(allOccs.filter((o) => o.canonicalNodeId === 'hotel.cmd.CancelBooking').length).toBe(1);
    expect(allOccs.length).toBe(4);
  });

  test('shared nodes (ui/trigger/proc) can appear multiple times across branches', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('hotel.cmd.BookRoom', [
      {
        id: 'b_forward',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
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

    // cmd should still be deduped
    expect(allOccs.filter((o) => o.canonicalNodeId === 'hotel.cmd.BookRoom').length).toBe(1);
    // shared (ui.form) is allowed to be separate
    expect(allOccs.filter((o) => o.canonicalNodeId === 'ui.form.booking').length).toBe(1);
  });

  test('edges from multiple branches all link to the same deduped occurrence', () => {
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
    ]);

    const state = engine.initLayout(envelope);
    const edges = Object.values(state.displayEdges);

    const cmdOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'hotel.cmd.BookRoom')!;
    const evtOcc = Object.values(state.occurrences).find((o) => o.canonicalNodeId === 'hotel.evt.RoomBooked')!;

    // All cmd-to-evt edges should reference the same cmd occurrence and same evt occurrence
    const cmdToEvtEdges = edges.filter((e) => e.kind === 'cmd-to-evt');
    expect(cmdToEvtEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of cmdToEvtEdges) {
      expect(edge.fromOccurrenceId).toBe(cmdOcc.occurrenceId);
      expect(edge.toOccurrenceId).toBe(evtOcc.occurrenceId);
    }
  });

  test('full hotel booking scenario: no duplicate cmds, evts, or viewModels', () => {
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
    ]);

    const state = engine.initLayout(envelope);
    const allOccs = Object.values(state.occurrences);

    // Verify unique occurrences per canonicalNodeId
    const byId = new Map<string, number>();
    for (const o of allOccs) {
      const count = byId.get(o.canonicalNodeId) ?? 0;
      byId.set(o.canonicalNodeId, count + 1);
    }

    // cmd, evt, viewModel should each appear exactly once
    expect(byId.get('hotel.cmd.BookRoom')).toBe(1);
    expect(byId.get('hotel.cmd.CancelBooking')).toBe(1);
    expect(byId.get('hotel.evt.RoomBooked')).toBe(1);
    expect(byId.get('hotel.evt.BookingCancelled')).toBe(1);
    expect(byId.get('hotel.view.BookingSummary')).toBe(1);
    expect(byId.get('hotel.view.RoomAvailability')).toBe(1);

    // Total: 2 cmds + 2 evts + 2 viewModels = 6
    expect(allOccs.length).toBe(6);
  });
});
