import { LayoutEngine } from '../src/layout/layout-engine';
import { NormalizedPathEnvelope, LayoutState, LayoutConfig, DEFAULT_LAYOUT_CONFIG } from '../src/layout/types';

function makeEnvelope(
  anchorId: string,
  branches: Array<{ id: string; dir: 'forward' | 'backward'; path: any[] }>,
): NormalizedPathEnvelope {
  return {
    anchor: { nodeId: anchorId },
    branches: branches.map((b, i) => ({
      branchId: b.id,
      direction: b.dir,
      path: b.path,
    })),
    frontier: {},
  };
}

describe('LayoutEngine', () => {
  test('initLayout creates state from envelope', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('cmd.create-refund', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.refund-detail', nodeKind: 'viewModel' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);
    expect(Object.keys(state.occurrences).length).toBe(3);

    const cmdOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'cmd.create-refund')!;
    expect(cmdOcc).toBeDefined();
    expect(cmdOcc.nodeKind).toBe('cmd');
    expect(cmdOcc.stageIndex).toBe(1);

    const evtOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'evt.refund-created')!;
    expect(evtOcc.stageIndex).toBe(2);

    const vmOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'view.refund-detail')!;
    expect(vmOcc.stageIndex).toBe(3);
  });

  test('initLayout creates display edges', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('cmd.create-refund', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);
    const edges = Object.values(state.displayEdges);
    expect(edges.length).toBe(1);
    expect(edges[0].kind).toBe('cmd-to-evt');
    expect(edges[0].points.length).toBeGreaterThanOrEqual(2);
  });

  test('appendExploreResult adds new occurrences to the right', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.create-refund', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);
    const evtOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'evt.refund-created')!;

    const appendEnvelope = makeEnvelope('evt.refund-created', [
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'view.refund-detail', nodeKind: 'viewModel' },
        ],
      },
    ]);

    const patch = engine.appendExploreResult(state, evtOcc.occurrenceId, appendEnvelope);
    expect(patch.addedOccurrences.length).toBeGreaterThanOrEqual(1);
    expect(patch.updatedStageRange.min).toBeLessThanOrEqual(evtOcc.stageIndex);
    expect(patch.viewportHint.revealDirection).toBe('right');

    const vmOcc = patch.addedOccurrences.find(o => o.canonicalNodeId === 'view.refund-detail');
    expect(vmOcc).toBeDefined();
    expect(vmOcc!.stageIndex).toBeGreaterThan(evtOcc.stageIndex);
  });

  test('prependExploreResult adds new occurrences to the left', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const initEnvelope = makeEnvelope('cmd.create-refund', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
        ],
      },
    ]);

    const state = engine.initLayout(initEnvelope);
    const cmdOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'cmd.create-refund')!;

    const prependEnvelope = makeEnvelope('ui.screen.refund', [
      {
        id: 'b0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.refund', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
        ],
      },
    ]);

    const patch = engine.prependExploreResult(state, cmdOcc.occurrenceId, prependEnvelope);
    expect(patch.addedOccurrences.length).toBeGreaterThanOrEqual(1);
    expect(patch.viewportHint.revealDirection).toBe('left');

    const uiOcc = patch.addedOccurrences.find(o => o.canonicalNodeId === 'ui.screen.refund');
    expect(uiOcc).toBeDefined();
    expect(uiOcc!.stageIndex).toBeLessThan(cmdOcc.stageIndex);
  });

  test('existing occurrences are not displaced by append', () => {
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
    const cmdOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'cmd.x')!;
    const originalCmdStage = cmdOcc.stageIndex;

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

    const evtOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'evt.y')!;
    engine.appendExploreResult(state, evtOcc.occurrenceId, appendEnvelope);

    expect(cmdOcc.stageIndex).toBe(originalCmdStage);
  });

  test('full hotel booking flow produces correct layout', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const envelope = makeEnvelope('hotel.cmd.BookRoom', [
      {
        id: 'b_forward',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'b_backward',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.form.booking', nodeKind: 'ui.form' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
        ],
      },
    ]);

    const state = engine.initLayout(envelope);

    const ui = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'ui.form.booking')!;
    const cmd = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'hotel.cmd.BookRoom')!;
    const evt = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'hotel.evt.RoomBooked')!;
    const vm = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'hotel.view.BookingSummary')!;

    expect(ui.stageIndex).toBe(0);
    expect(cmd.stageIndex).toBe(1);
    expect(evt.stageIndex).toBe(2);
    expect(vm.stageIndex).toBe(3);

    expect(ui.lane).toBe('shared');
    expect(cmd.lane).toBe('commandViewModel');
    expect(evt.lane).toBe('event');
    expect(vm.lane).toBe('commandViewModel');

    expect(ui.x).toBeLessThan(cmd.x);
    expect(cmd.x).toBeLessThan(evt.x);
    expect(evt.x).toBeLessThan(vm.x);

    const edges = Object.values(state.displayEdges);
    expect(edges.length).toBe(3);
  });
});
