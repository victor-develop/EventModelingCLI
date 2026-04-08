import { solveLaneRows } from '../src/layout/row-solver';
import { Occurrence, RenderedEdge, LayoutConfig, DEFAULT_LAYOUT_CONFIG } from '../src/layout/types';

describe('row-solver', () => {
  test('assigns distinct rows to same-stage same-lane occurrences', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'evt.a', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_2', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b2', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
    ];

    const result = solveLaneRows(occs, [], DEFAULT_LAYOUT_CONFIG);
    expect(result[0].rowIndex).not.toBe(result[1].rowIndex);
  });

  test('assigns same row to different-stage occurrences in same lane', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'evt.a', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_2', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 6, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b2', lockLevel: 'free', x: 2400, y: 0, width: 220, height: 56,
      },
    ];

    const result = solveLaneRows(occs, [], DEFAULT_LAYOUT_CONFIG);
    expect(result[0].rowIndex).toBe(result[1].rowIndex);
  });

  test('respects hard lock level', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'evt.a', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: 5, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'hard', x: 800, y: 800, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_2', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b2', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
    ];

    const result = solveLaneRows(occs, [], DEFAULT_LAYOUT_CONFIG);
    const locked = result.find(o => o.occurrenceId === 'occ_1')!;
    expect(locked.rowIndex).toBe(5);
  });

  test('computes y from laneBaseY + rowIndex * rowGap', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_1', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: -1, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 0, width: 220, height: 56,
      },
    ];

    const result = solveLaneRows(occs, [], DEFAULT_LAYOUT_CONFIG);
    expect(result[0].rowIndex).toBe(0);
    expect(result[0].y).toBe(DEFAULT_LAYOUT_CONFIG.laneBaseY.commandViewModel + 0 * DEFAULT_LAYOUT_CONFIG.rowGap);
  });

  test('barycenter sweep reduces crossings', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_cmd_a', canonicalNodeId: 'cmd.a', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_cmd_b', canonicalNodeId: 'cmd.b', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 1, rowIndex: 1, displayRole: 'command',
        branchClusterId: 'b2', lockLevel: 'free', x: 400, y: 280, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_evt_a', canonicalNodeId: 'evt.a', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_evt_b', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 2, rowIndex: -1, displayRole: 'event',
        branchClusterId: 'b2', lockLevel: 'free', x: 800, y: 0, width: 220, height: 56,
      },
    ];

    const edges: RenderedEdge[] = [
      { displayEdgeId: 'de1', fromOccurrenceId: 'occ_cmd_a', toOccurrenceId: 'occ_evt_a', kind: 'cmd-to-evt', points: [], meta: {} },
      { displayEdgeId: 'de2', fromOccurrenceId: 'occ_cmd_b', toOccurrenceId: 'occ_evt_b', kind: 'cmd-to-evt', points: [], meta: {} },
    ];

    const result = solveLaneRows(occs, edges, DEFAULT_LAYOUT_CONFIG);
    const evtA = result.find(o => o.occurrenceId === 'occ_evt_a')!;
    const evtB = result.find(o => o.occurrenceId === 'occ_evt_b')!;

    expect(evtA.rowIndex).toBeLessThan(evtB.rowIndex);
  });
});
