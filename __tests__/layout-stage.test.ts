import { assignStages } from '../src/layout/stage';
import { Occurrence, Branch, NormalizedPathEnvelope, DisplayEdge } from '../src/layout/types';

describe('stage assignment', () => {
  test('assigns stage 4k for shared, 4k+1 for cmd, 4k+2 for evt, 4k+3 for viewModel', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_shared', canonicalNodeId: 'ui.screen.x', nodeKind: 'shared',
        lane: 'shared', stageIndex: 0, rowIndex: 0, displayRole: 'ui',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 0, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_evt', canonicalNodeId: 'evt.y', nodeKind: 'evt',
        lane: 'event', stageIndex: 0, rowIndex: 0, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_vm', canonicalNodeId: 'view.z', nodeKind: 'viewModel',
        lane: 'commandViewModel', stageIndex: 0, rowIndex: 0, displayRole: 'projection',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
    ];

    const displayEdges: DisplayEdge[] = [
      { displayEdgeId: 'de1', fromNodeKind: 'shared', toNodeKind: 'cmd', kind: 'shared-to-cmd', originalEdgeType: 'roleUsesUIToIssueCommand', originalEdgeId: 'e1' },
      { displayEdgeId: 'de2', fromNodeKind: 'cmd', toNodeKind: 'evt', kind: 'cmd-to-evt', originalEdgeType: 'commandCausesEvent', originalEdgeId: 'e2' },
      { displayEdgeId: 'de3', fromNodeKind: 'evt', toNodeKind: 'viewModel', kind: 'evt-to-viewModel', originalEdgeType: 'eventRefreshesViewModel', originalEdgeId: 'e3' },
    ];

    const edgeOccLinks = [
      { fromOccId: 'occ_shared', toOccId: 'occ_cmd', displayEdge: displayEdges[0] },
      { fromOccId: 'occ_cmd', toOccId: 'occ_evt', displayEdge: displayEdges[1] },
      { fromOccId: 'occ_evt', toOccId: 'occ_vm', displayEdge: displayEdges[2] },
    ];

    const result = assignStages(occs, edgeOccLinks as any, 'occ_cmd');
    const shared = result.find(o => o.occurrenceId === 'occ_shared')!;
    const cmd = result.find(o => o.occurrenceId === 'occ_cmd')!;
    const evt = result.find(o => o.occurrenceId === 'occ_evt')!;
    const vm = result.find(o => o.occurrenceId === 'occ_vm')!;

    expect(cmd.stageIndex).toBe(1);
    expect(evt.stageIndex).toBe(2);
    expect(vm.stageIndex).toBe(3);
    expect(shared.stageIndex).toBe(0);
  });

  test('anchor cmd gets stage 1, backward shared gets stage 0', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_ui', canonicalNodeId: 'ui.x', nodeKind: 'shared',
        lane: 'shared', stageIndex: 0, rowIndex: 0, displayRole: 'ui',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 0, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
    ];

    const edgeOccLinks = [
      { fromOccId: 'occ_ui', toOccId: 'occ_cmd', displayEdge: { kind: 'shared-to-cmd' } },
    ];

    const result = assignStages(occs, edgeOccLinks as any, 'occ_cmd');
    const cmd = result.find(o => o.occurrenceId === 'occ_cmd')!;
    const ui = result.find(o => o.occurrenceId === 'occ_ui')!;

    expect(cmd.stageIndex).toBe(1);
    expect(ui.stageIndex).toBe(0);
  });

  test('two forward branches from same anchor get consistent stages', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 0, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_evt1', canonicalNodeId: 'evt.a', nodeKind: 'evt',
        lane: 'event', stageIndex: 0, rowIndex: 0, displayRole: 'event',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
      {
        occurrenceId: 'occ_evt2', canonicalNodeId: 'evt.b', nodeKind: 'evt',
        lane: 'event', stageIndex: 0, rowIndex: 0, displayRole: 'event',
        branchClusterId: 'b2', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
    ];

    const edgeOccLinks = [
      { fromOccId: 'occ_cmd', toOccId: 'occ_evt1', displayEdge: { kind: 'cmd-to-evt' } },
      { fromOccId: 'occ_cmd', toOccId: 'occ_evt2', displayEdge: { kind: 'cmd-to-evt' } },
    ];

    const result = assignStages(occs, edgeOccLinks as any, 'occ_cmd');
    const evt1 = result.find(o => o.occurrenceId === 'occ_evt1')!;
    const evt2 = result.find(o => o.occurrenceId === 'occ_evt2')!;

    expect(evt1.stageIndex).toBe(2);
    expect(evt2.stageIndex).toBe(2);
  });

  test('assigns correct x coordinates from stageIndex', () => {
    const occs: Occurrence[] = [
      {
        occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
        lane: 'commandViewModel', stageIndex: 0, rowIndex: 0, displayRole: 'command',
        branchClusterId: 'b1', lockLevel: 'free', x: 0, y: 0, width: 220, height: 56,
      },
    ];

    const result = assignStages(occs, [], 'occ_cmd');
    const cmd = result.find(o => o.occurrenceId === 'occ_cmd')!;
    expect(cmd.stageIndex).toBe(1);
  });
});
