import { buildOccurrences, mergeOccurrences } from '../src/layout/occurrence';
import { Branch, Occurrence, NormalizedPathEnvelope, LayoutState } from '../src/layout/types';

describe('occurrence builder', () => {
  test('builds occurrences from a single forward branch', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'cmd.create-refund' },
      branches: [{
        branchId: 'b1',
        direction: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' },
          { type: 'node', nodeId: 'evt.refund-created', nodeKind: 'evt' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    expect(occs.length).toBe(2);
    expect(occs[0].canonicalNodeId).toBe('cmd.create-refund');
    expect(occs[0].nodeKind).toBe('cmd');
    expect(occs[0].lane).toBe('commandViewModel');
    expect(occs[1].canonicalNodeId).toBe('evt.refund-created');
    expect(occs[1].nodeKind).toBe('evt');
    expect(occs[1].lane).toBe('event');
  });

  test('builds occurrences from backward branch', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'cmd.create-refund' },
      branches: [{
        branchId: 'b1',
        direction: 'backward',
        path: [
          { type: 'node', nodeId: 'ui.screen.refund', nodeKind: 'ui.screen' },
          { type: 'edge', edgeId: 'e0', edgeType: 'roleUsesUIToIssueCommand', displayDirection: 'forward' },
          { type: 'node', nodeId: 'cmd.create-refund', nodeKind: 'cmd' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    expect(occs.length).toBe(2);
    expect(occs[0].canonicalNodeId).toBe('ui.screen.refund');
    expect(occs[0].nodeKind).toBe('shared');
    expect(occs[0].lane).toBe('nonRole');
  });

  test('generates unique occurrenceIds', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'cmd.x' },
      branches: [{
        branchId: 'b1',
        direction: 'forward',
        path: [
          { type: 'node', nodeId: 'cmd.x', nodeKind: 'cmd' },
          { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent', displayDirection: 'forward' },
          { type: 'node', nodeId: 'evt.y', nodeKind: 'evt' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    const ids = occs.map(o => o.occurrenceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('maps ui.* to nonRole lane', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'ui.screen.x' },
      branches: [{
        branchId: 'b1',
        direction: 'forward',
        path: [
          { type: 'node', nodeId: 'ui.screen.x', nodeKind: 'ui.screen' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    expect(occs[0].lane).toBe('nonRole');
    expect(occs[0].nodeKind).toBe('shared');
  });

  test('maps proc to nonRole lane', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'proc.x' },
      branches: [{
        branchId: 'b1',
        direction: 'forward',
        path: [
          { type: 'node', nodeId: 'proc.x', nodeKind: 'proc' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    expect(occs[0].lane).toBe('nonRole');
  });

  test('maps viewModel to commandViewModel lane', () => {
    const envelope: NormalizedPathEnvelope = {
      anchor: { nodeId: 'view.x' },
      branches: [{
        branchId: 'b1',
        direction: 'forward',
        path: [
          { type: 'node', nodeId: 'view.x', nodeKind: 'viewModel' },
        ],
      }],
      frontier: {},
    };

    const occs = buildOccurrences(envelope, 1);
    expect(occs[0].lane).toBe('commandViewModel');
    expect(occs[0].nodeKind).toBe('viewModel');
  });
});

describe('mergeOccurrences', () => {
  test('merges occurrences with same canonicalNodeId and stageIndex', () => {
    const existing: Occurrence[] = [
      {
        occurrenceId: 'occ_1',
        canonicalNodeId: 'cmd.x',
        nodeKind: 'cmd',
        lane: 'commandViewModel',
        stageIndex: 1,
        rowIndex: 0,
        displayRole: 'command',
        branchClusterId: 'b1',
        lockLevel: 'soft',
        x: 400,
        y: 200,
        width: 220,
        height: 56,
      },
    ];

    const incoming: Occurrence[] = [
      {
        occurrenceId: 'occ_2',
        canonicalNodeId: 'cmd.x',
        nodeKind: 'cmd',
        lane: 'commandViewModel',
        stageIndex: 1,
        rowIndex: 0,
        displayRole: 'command',
        branchClusterId: 'b2',
        lockLevel: 'free',
        x: 400,
        y: 200,
        width: 220,
        height: 56,
      },
    ];

    const result = mergeOccurrences(incoming, existing);
    expect(result.merged.length).toBe(1);
    expect(result.merged[0].canonicalNodeId).toBe('cmd.x');
  });

  test('does not merge when stageIndex differs', () => {
    const existing: Occurrence[] = [
      {
        occurrenceId: 'occ_1',
        canonicalNodeId: 'cmd.x',
        nodeKind: 'cmd',
        lane: 'commandViewModel',
        stageIndex: 1,
        rowIndex: 0,
        displayRole: 'command',
        branchClusterId: 'b1',
        lockLevel: 'soft',
        x: 400,
        y: 200,
        width: 220,
        height: 56,
      },
    ];

    const incoming: Occurrence[] = [
      {
        occurrenceId: 'occ_2',
        canonicalNodeId: 'cmd.x',
        nodeKind: 'cmd',
        lane: 'commandViewModel',
        stageIndex: 5,
        rowIndex: 0,
        displayRole: 'command',
        branchClusterId: 'b2',
        lockLevel: 'free',
        x: 2000,
        y: 200,
        width: 220,
        height: 56,
      },
    ];

    const result = mergeOccurrences(incoming, existing);
    expect(result.merged.length).toBe(2);
  });

  test('returns new occurrences that were not merged', () => {
    const incoming: Occurrence[] = [
      {
        occurrenceId: 'occ_new',
        canonicalNodeId: 'evt.y',
        nodeKind: 'evt',
        lane: 'event',
        stageIndex: 2,
        rowIndex: 0,
        displayRole: 'event',
        branchClusterId: 'b1',
        lockLevel: 'free',
        x: 800,
        y: 400,
        width: 220,
        height: 56,
      },
    ];

    const result = mergeOccurrences(incoming, []);
    expect(result.merged.length).toBe(1);
    expect(result.added.length).toBe(1);
  });
});
