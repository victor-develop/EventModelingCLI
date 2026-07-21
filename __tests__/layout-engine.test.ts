import { LayoutEngine } from '../src/layout/layout-engine';
import { NormalizedPathEnvelope, LayoutState, LayoutConfig, DEFAULT_LAYOUT_CONFIG } from '../src/layout/types';
import { resetDeCounter } from '../src/layout/semantic-lift';

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
          { type: 'edge', edgeId: 'e0', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
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
          { type: 'edge', edgeId: 'e0', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
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

    expect(ui.lane).toBe('nonRole');
    expect(cmd.lane).toBe('commandViewModel');
    expect(evt.lane).toBe('event');
    expect(vm.lane).toBe('commandViewModel');

    expect(ui.x).toBeLessThan(cmd.x);
    expect(cmd.x).toBeLessThan(evt.x);
    expect(evt.x).toBeLessThan(vm.x);

    const edges = Object.values(state.displayEdges);
    expect(edges.length).toBe(3);
  });

  test('appendExploreResult uses staged x-coordinates for row solving', () => {
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
    const evtOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'evt.y')!;

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

    for (const occ of Object.values(state.occurrences)) {
      expect(occ.x).toBe(occ.stageIndex * DEFAULT_LAYOUT_CONFIG.stageGap);
    }

    const vmOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'view.z')!;
    expect(vmOcc).toBeDefined();
    expect(vmOcc.stageIndex).toBeGreaterThan(evtOcc.stageIndex);
  });

  test('appendExploreResult continues ids from a server-built state in a fresh engine context', () => {
    const serverEngine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
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

    const serverState = serverEngine.initLayout(initEnvelope);
    const browserState = JSON.parse(JSON.stringify(serverState));
    const existingOccurrenceIds = new Set(Object.keys(browserState.occurrences));
    const existingEdgeIds = new Set(Object.keys(browserState.displayEdges));
    const evtOcc = Object.values(browserState.occurrences).find((o: any) => o.canonicalNodeId === 'evt.y') as any;

    resetDeCounter();
    const patch = new LayoutEngine(DEFAULT_LAYOUT_CONFIG).appendExploreResult(
      browserState,
      evtOcc.occurrenceId,
      makeEnvelope('evt.y', [
        {
          id: 'b2',
          dir: 'forward',
          path: [
            { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
            { type: 'edge', edgeId: 'e2', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
            { type: 'node', nodeId: 'view.z', nodeKind: 'viewModel' },
          ],
        },
      ]),
    );

    expect(patch.addedOccurrences.every(o => !existingOccurrenceIds.has(o.occurrenceId))).toBe(true);
    expect(patch.addedEdges.every(e => !existingEdgeIds.has(e.displayEdgeId))).toBe(true);
    for (const occurrenceId of existingOccurrenceIds) {
      expect(browserState.occurrences[occurrenceId]).toEqual(serverState.occurrences[occurrenceId]);
    }
    for (const edgeId of existingEdgeIds) {
      expect(browserState.displayEdges[edgeId]).toEqual(serverState.displayEdges[edgeId]);
    }
  });

  test('appendExploreResult merges same-stage shared duplicate without moving the existing occurrence', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('view.order-detail', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'view.order-detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'consume-a', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.screen.order-detail', nodeKind: 'ui.screen' },
        ],
      },
    ]));
    const viewOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'view.order-detail')!;
    const existingUi = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'ui.screen.order-detail')!;
    const originalUiStage = existingUi.stageIndex;

    const patch = engine.appendExploreResult(state, viewOcc.occurrenceId, makeEnvelope('view.order-detail', [
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'view.order-detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'consume-b', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.screen.order-detail', nodeKind: 'ui.screen' },
        ],
      },
    ]));

    const uiOccurrences = Object.values(state.occurrences).filter(o => o.canonicalNodeId === 'ui.screen.order-detail');
    expect(uiOccurrences).toHaveLength(1);
    expect(uiOccurrences[0].occurrenceId).toBe(existingUi.occurrenceId);
    expect(uiOccurrences[0].stageIndex).toBe(originalUiStage);
    expect(patch.addedOccurrences).toHaveLength(0);
    expect(patch.addedEdges).toHaveLength(1);
    expect(patch.addedEdges[0].fromOccurrenceId).toBe(viewOcc.occurrenceId);
    expect(patch.addedEdges[0].toOccurrenceId).toBe(existingUi.occurrenceId);
    expect(patch.addedEdges[0].meta.originalEdgeId).toBe('consume-b');
  });

  test('appendExploreResult binds the explored source occurrence instead of another repeated shared node', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('ui.screen.return-lookup', [
      {
        id: 'bwd_0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-lookup', nodeKind: 'ui.screen', lane: 'role:role.buyer' },
          { type: 'edge', edgeId: 'e-consumed-by-ui', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.view.order.summary', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'fwd_1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-lookup', nodeKind: 'ui.screen', lane: 'role:role.buyer' },
          { type: 'edge', edgeId: 'e-lookup-order', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
        ],
      },
    ]));

    const uiOccurrences = Object.values(state.occurrences)
      .filter(o => o.canonicalNodeId === 'ui.screen.return-lookup')
      .sort((a, b) => a.stageIndex - b.stageIndex);
    const leftUiOcc = uiOccurrences[0]!;
    const rightUiOcc = uiOccurrences[uiOccurrences.length - 1]!;

    const patch = engine.appendExploreResult(state, rightUiOcc.occurrenceId, makeEnvelope('ui.screen.return-lookup', [
      {
        id: 'fwd_0',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-lookup', nodeKind: 'ui.screen', lane: 'role:role.buyer' },
          { type: 'edge', edgeId: 'e-lookup-order', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-order-looked-up', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order.lookup-completed', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-refresh-draft', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.return.draft', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'fwd_1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-lookup', nodeKind: 'ui.screen', lane: 'role:role.buyer' },
          { type: 'edge', edgeId: 'e-lookup-order', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-order-looked-up', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order.lookup-completed', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-refresh-summary', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.order.summary', nodeKind: 'viewModel' },
        ],
      },
    ]));

    const addedLookupOrder = patch.addedOccurrences.find(o => o.canonicalNodeId === 'returns.cmd.lookup-order')!;
    const roleEdgesToAddedCommand = patch.addedEdges.filter(edge =>
      edge.meta.originalEdgeId === 'e-lookup-order' &&
      edge.toOccurrenceId === addedLookupOrder.occurrenceId,
    );

    expect(roleEdgesToAddedCommand).toHaveLength(1);
    expect(roleEdgesToAddedCommand[0]?.fromOccurrenceId).toBe(rightUiOcc.occurrenceId);
    expect(roleEdgesToAddedCommand.some(edge => edge.fromOccurrenceId === leftUiOcc.occurrenceId)).toBe(false);
  });

  test('prependExploreResult emits a distinct edge when same-stage compaction removes the added duplicate', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('cmd.submit-order', [
      {
        id: 'b1',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.checkout', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'issue-a', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.submit-order', nodeKind: 'cmd' },
        ],
      },
    ]));
    const cmdOcc = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'cmd.submit-order')!;
    const existingUi = Object.values(state.occurrences).find(o => o.canonicalNodeId === 'ui.screen.checkout')!;

    const patch = engine.prependExploreResult(state, cmdOcc.occurrenceId, makeEnvelope('cmd.submit-order', [
      {
        id: 'b2',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.checkout', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'issue-b', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.submit-order', nodeKind: 'cmd' },
        ],
      },
    ]));

    expect(Object.values(state.occurrences).filter(o => o.canonicalNodeId === 'ui.screen.checkout')).toHaveLength(1);
    expect(patch.addedOccurrences).toHaveLength(0);
    expect(patch.addedEdges).toHaveLength(1);
    expect(patch.addedEdges[0].fromOccurrenceId).toBe(existingUi.occurrenceId);
    expect(patch.addedEdges[0].toOccurrenceId).toBe(cmdOcc.occurrenceId);
    expect(patch.addedEdges[0].meta.originalEdgeId).toBe('issue-b');
  });

  test('prependExploreResult is idempotent when backward path already exists at final stages', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('ui.screen.install', [
      {
        id: 'bwd_0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.install', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'consume', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'view.install.status', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'refresh', edgeType: 'eventRefreshesViewModel', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'evt.installed', nodeKind: 'evt' },
        ],
      },
      {
        id: 'fwd_1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.install', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'issue', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.install', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'cause', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.installed', nodeKind: 'evt' },
        ],
      },
    ]));
    const occurrenceCount = Object.keys(state.occurrences).length;
    const edgeCount = Object.keys(state.displayEdges).length;
    const leftUiOcc = Object.values(state.occurrences)
      .filter(o => o.canonicalNodeId === 'ui.screen.install')
      .sort((a, b) => a.stageIndex - b.stageIndex)[0]!;

    const patch = engine.prependExploreResult(state, leftUiOcc.occurrenceId, makeEnvelope('ui.screen.install', [
      {
        id: 'bwd_0',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.install', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'consume', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'view.install.status', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'refresh', edgeType: 'eventRefreshesViewModel', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'evt.installed', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'cause', edgeType: 'commandCausesEvent', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'cmd.install', nodeKind: 'cmd' },
        ],
      },
    ]));

    expect(patch.addedOccurrences).toHaveLength(0);
    expect(patch.addedEdges).toHaveLength(0);
    expect(Object.keys(state.occurrences)).toHaveLength(occurrenceCount);
    expect(Object.keys(state.displayEdges)).toHaveLength(edgeCount);
  });

  test('appendExploreResult does not duplicate an existing role marker edge for the same role and surface', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('ui.screen.return-portal', [
      {
        id: 'initial',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-portal', nodeKind: 'ui.screen' },
          {
            type: 'edge',
            edgeId: 'issue-a',
            edgeType: 'roleIssuesCommand',
            displayDirection: 'forward' as const,
            roleNodeId: 'role.buyer',
            surfaceNodeId: 'ui.screen.return-portal',
          },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
        ],
      },
    ]));
    const portalOcc = Object.values(state.occurrences)
      .find((occ) => occ.canonicalNodeId === 'ui.screen.return-portal')!;
    const edgeCount = Object.keys(state.displayEdges).length;

    const patch = engine.appendExploreResult(state, portalOcc.occurrenceId, makeEnvelope('ui.screen.return-portal', [
      {
        id: 'second-command',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.return-portal', nodeKind: 'ui.screen' },
          {
            type: 'edge',
            edgeId: 'issue-b',
            edgeType: 'roleIssuesCommand',
            displayDirection: 'forward' as const,
            roleNodeId: 'role.buyer',
            surfaceNodeId: 'ui.screen.return-portal',
          },
          { type: 'node', nodeId: 'returns.cmd.request-return', nodeKind: 'cmd' },
        ],
      },
    ]));
    const roleEdges = Object.values(state.displayEdges)
      .filter((edge) => edge.kind === 'role-to-shared');

    expect(roleEdges).toHaveLength(1);
    expect(patch.addedEdges.filter((edge) => edge.kind === 'role-to-shared')).toHaveLength(0);
    expect(patch.addedEdges.filter((edge) => edge.kind === 'shared-to-cmd')).toHaveLength(1);
    expect(Object.keys(state.displayEdges)).toHaveLength(edgeCount + 1);
  });

  test('duplicate shared branch targets route left-to-right', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('view.tracking-status', [
      {
        id: 'b1',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'view.tracking-status', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'consume-a', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.section.tracking', nodeKind: 'ui.section' },
        ],
      },
      {
        id: 'b2',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'view.tracking-status', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'consume-b', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.section.tracking', nodeKind: 'ui.section' },
        ],
      },
    ]));

    const edges = Object.values(state.displayEdges);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((edge) => edge.points[0]![0] <= edge.points[edge.points.length - 1]![0])).toBe(true);

    const sections = Object.values(state.occurrences)
      .filter((occ) => occ.canonicalNodeId === 'ui.section.tracking');
    expect(sections).toHaveLength(1);
    expect(sections[0].stageIndex).toBe(4);
  });

  test('cyclic branches are linearly unrolled instead of pushing stages unboundedly', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('returns.proc.public-api', [
      {
        id: 'backward_cycle',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'e-view-proc', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.view.return-detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'e-evt-view', edgeType: 'eventRefreshesViewModel', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.evt.order-verified', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-cmd-evt', edgeType: 'commandCausesEvent', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-proc-cmd', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'e-view-proc-again', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.view.return-context', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'forward_cycle',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'e-proc-cmd-fwd', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-cmd-evt-fwd', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order-verified', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-evt-view-fwd', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.return-detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'e-view-proc-fwd', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'e-proc-cmd-again', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
        ],
      },
    ]));

    const occurrences = Object.values(state.occurrences);
    const stages = occurrences.map((occ) => occ.stageIndex);

    expect(Math.max(...stages)).toBeLessThanOrEqual(9);
    expect(occurrences
      .filter((occ) => occ.canonicalNodeId === 'returns.cmd.lookup-order')
      .map((occ) => occ.stageIndex)
      .sort((a, b) => a - b)).toEqual([1, 5]);
    expect(Object.values(state.displayEdges).every((edge) => {
      const from = state.occurrences[edge.fromOccurrenceId]!;
      const to = state.occurrences[edge.toOccurrenceId]!;
      return to.stageIndex >= from.stageIndex;
    })).toBe(true);
  });

  test('initLayout completes visible adjacent semantic fanout edges after occurrence compaction', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('returns.proc.public-api', [
      {
        id: 'first_order_lookup_to_detail',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'issue-lookup', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'order-verified', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order-verified', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'refresh-detail', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.return-detail', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'context_consumed_without_visible_refresh',
        dir: 'backward',
        path: [
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'context-consumed', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'backward' as const },
          { type: 'node', nodeId: 'returns.view.return-request-context', nodeKind: 'viewModel' },
        ],
      },
      {
        id: 'later_cycle_contains_context_refresh_definition',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'issue-lookup', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'order-verified', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order-verified', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'refresh-detail', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.return-detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'detail-consumed', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.proc.public-api', nodeKind: 'proc' },
          { type: 'edge', edgeId: 'issue-lookup', edgeType: 'processorOrTriggerIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.cmd.lookup-order', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'order-verified', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.evt.order-verified', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'refresh-context', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'returns.view.return-request-context', nodeKind: 'viewModel' },
        ],
      },
    ]));

    const orderVerified = Object.values(state.occurrences)
      .find((occ) => occ.canonicalNodeId === 'returns.evt.order-verified' && occ.stageIndex === 2)!;
    const requestContext = Object.values(state.occurrences)
      .find((occ) => occ.canonicalNodeId === 'returns.view.return-request-context' && occ.stageIndex === 3)!;
    const incomingContextRefresh = Object.values(state.displayEdges).filter((edge) =>
      edge.fromOccurrenceId === orderVerified.occurrenceId &&
      edge.toOccurrenceId === requestContext.occurrenceId &&
      edge.meta.originalEdgeId === 'refresh-context'
    );

    expect(incomingContextRefresh).toHaveLength(1);
    expect(incomingContextRefresh[0]?.kind).toBe('evt-to-viewModel');
  });

  test('appendExploreResult emits repeated original edges when occurrence endpoints differ', () => {
    const engine = new LayoutEngine(DEFAULT_LAYOUT_CONFIG);
    const state = engine.initLayout(makeEnvelope('ui.checkout', [
      {
        id: 'checkout_to_shipped',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.checkout', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e-ui-submit', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.submit', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-submit-event', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.submitted', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-submitted-detail', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'vm.detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'e-detail-screen', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.detail', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e-ui-ship', edgeType: 'roleIssuesCommand', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'cmd.ship', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e-ship-event', edgeType: 'commandCausesEvent', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'evt.shipped', nodeKind: 'evt' },
        ],
      },
    ]));
    const shippedOcc = Object.values(state.occurrences).find((occ) => occ.canonicalNodeId === 'evt.shipped')!;

    const patch = engine.appendExploreResult(state, shippedOcc.occurrenceId, makeEnvelope('evt.shipped', [
      {
        id: 'shipped_back_to_detail',
        dir: 'forward',
        path: [
          { type: 'node', nodeId: 'evt.shipped', nodeKind: 'evt' },
          { type: 'edge', edgeId: 'e-shipped-detail', edgeType: 'eventRefreshesViewModel', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'vm.detail', nodeKind: 'viewModel' },
          { type: 'edge', edgeId: 'e-detail-screen', edgeType: 'viewModelConsumedByUiOrProcessor', displayDirection: 'forward' as const },
          { type: 'node', nodeId: 'ui.detail', nodeKind: 'ui.screen' },
        ],
      },
    ]));

    const addedDetail = patch.addedOccurrences.find((occ) => occ.canonicalNodeId === 'vm.detail')!;
    const addedScreen = patch.addedOccurrences.find((occ) => occ.canonicalNodeId === 'ui.detail')!;
    const repeatedConsumptionEdge = patch.addedEdges.find((edge) => edge.meta?.originalEdgeId === 'e-detail-screen');

    expect(addedDetail.stageIndex).toBeGreaterThan(shippedOcc.stageIndex);
    expect(repeatedConsumptionEdge?.fromOccurrenceId).toBe(addedDetail.occurrenceId);
    expect(repeatedConsumptionEdge?.toOccurrenceId).toBe(addedScreen.occurrenceId);
  });
});
