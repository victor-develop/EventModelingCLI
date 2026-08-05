import { validate } from '../src/validation/validate';
import { Node, Edge, ViewModelSchema, CommandSchema, EventSchema } from '../src/domain/types';

function makeNode(id: string, kind: Node['kind']): Node {
  return {
    id,
    projectId: 'proj_test',
    kind,
    canonicalId: id,
    displayName: id,
    tags: [],
    domains: [],
  };
}

function makeEdge(id: string, type: Edge['type'], from: string, to: string): Edge {
  return {
    id,
    projectId: 'proj_test',
    type,
    fromNodeId: from,
    toNodeId: to,
  };
}

describe('validation rules', () => {
  test('EMV-001: story without command', () => {
    const nodes = [makeNode('s1', 'story.story')];
    const errors = validate(nodes, [], []);
    expect(errors.some(e => e.code === 'EMV-001')).toBe(true);
  });

  test('EMV-001: story with command passes', () => {
    const nodes = [makeNode('s1', 'story.story'), makeNode('c1', 'cmd')];
    const edges = [
      makeEdge('e1', 'storyOwnsCommand', 's1', 'c1'),
      makeEdge('e2', 'commandCausesEvent', 'c1', 'evt1'),
      makeEdge('e3', 'eventRefreshesViewModel', 'evt1', 'v1'),
    ];
    nodes.push(makeNode('evt1', 'evt'), makeNode('v1', 'viewModel'));
    const errors = validate(nodes, edges, []);
    expect(errors.some(e => e.code === 'EMV-001')).toBe(false);
  });

  test('EMV-010: story-bound canonical command with event loop passes', () => {
    const cmdNode = { ...makeNode('node_1', 'cmd'), canonicalId: 'returns.cmd.request-return' };
    const evtNode = { ...makeNode('node_2', 'evt'), canonicalId: 'returns.evt.return.requested' };
    const viewNode = { ...makeNode('node_3', 'viewModel'), canonicalId: 'returns.view.return.detail' };
    const nodes = [makeNode('story.request-return', 'story.story'), cmdNode, evtNode, viewNode];
    const edges = [
      makeEdge('e1', 'storyOwnsCommand', 'story.request-return', 'returns.cmd.request-return'),
      makeEdge('e2', 'commandCausesEvent', 'returns.cmd.request-return', 'returns.evt.return.requested'),
      makeEdge('e3', 'eventRefreshesViewModel', 'returns.evt.return.requested', 'returns.view.return.detail'),
    ];

    const errors = validate(nodes, edges, []);

    expect(errors.some(e => e.code === 'EMV-010')).toBe(false);
  });

  test('EMV-020: command without event', () => {
    const nodes = [makeNode('c1', 'cmd')];
    const errors = validate(nodes, [], []);
    expect(errors.some(e => e.code === 'EMV-020')).toBe(true);
  });

  test('EMV-030: field missing source', () => {
    const schema: ViewModelSchema = {
      viewModelNodeId: 'v1',
      fields: [{ fieldId: 'f1', name: 'f1', type: 'string', nullable: false, source: { eventNodeId: '', eventFieldPath: '' } }],
    };
    const errors = validate([makeNode('v1', 'viewModel')], [], [schema]);
    expect(errors.some(e => e.code === 'EMV-030')).toBe(true);
  });

  test('EMV-000: unknown persisted edge type is reported', () => {
    const edge = {
      ...makeEdge('e1', 'commandCausesEvent', 'c1', 'e1'),
      type: 'legacyConsumesViewModel',
    } as unknown as Edge;

    const errors = validate([], [edge], []);

    expect(errors.some(e => e.code === 'EMV-000')).toBe(true);
  });

  test('EMV-041: view consumption edge must point from viewModel to UI or processor', () => {
    const nodes = [makeNode('v1', 'viewModel'), makeNode('ui1', 'ui.screen')];
    const edge = makeEdge('e1', 'viewModelConsumedByUiOrProcessor', 'ui1', 'v1');

    const errors = validate(nodes, [edge], []);

    expect(errors.some(e => e.code === 'EMV-041')).toBe(true);
  });

  test('EMV-040: field refs are checked against the source view model schema', () => {
    const nodes = [makeNode('v1', 'viewModel'), makeNode('ui1', 'ui.screen')];
    const edge: Edge = {
      ...makeEdge('e1', 'viewModelConsumedByUiOrProcessor', 'v1', 'ui1'),
      meta: { fieldRefs: ['missing'] },
    };
    const schema: ViewModelSchema = {
      viewModelNodeId: 'v1',
      fields: [{ fieldId: 'present', name: 'present', type: 'string', nullable: false, source: { eventNodeId: 'evt1', eventFieldPath: 'payload.present' } }],
    };

    const errors = validate(nodes, [edge], [schema]);

    expect(errors.some(e => e.code === 'EMV-040')).toBe(true);
  });

  test('EMV-050: processor without update source', () => {
    const nodes = [makeNode('p1', 'proc')];
    const errors = validate(nodes, [], []);
    expect(errors.some(e => e.code === 'EMV-050')).toBe(true);
  });

  test('EMV-050: processor used as role issue surface does not need update source', () => {
    const nodes = [
      makeNode('p1', 'proc'),
      makeNode('c1', 'cmd'),
    ];
    const edge: Edge = {
      ...makeEdge('e1', 'roleIssuesCommand', 'role.buyer', 'c1'),
      viaNodeId: 'p1',
    };

    const errors = validate(nodes, [edge], []);

    expect(errors.some(e => e.code === 'EMV-050')).toBe(false);
  });

  test('EMV-032: view field source path is checked against event schema when present', () => {
    const nodes = [makeNode('evt1', 'evt'), makeNode('v1', 'viewModel')];
    const edges = [makeEdge('e1', 'eventRefreshesViewModel', 'evt1', 'v1')];
    const vmSchema: ViewModelSchema = {
      viewModelNodeId: 'v1',
      fields: [{ fieldId: 'f.status', name: 'status', type: 'string', nullable: false, source: { eventNodeId: 'evt1', eventFieldPath: 'payload.status' } }],
    };
    const eventSchema: EventSchema = {
      eventNodeId: 'evt1',
      version: 1,
      payload: { fields: [{ fieldId: 'status', name: 'status', type: 'string', required: true }] },
    };

    const errors = validate(nodes, edges, [vmSchema], [], [eventSchema]);

    expect(errors.some(e => e.code === 'EMV-032')).toBe(false);
  });

  test('EMV-032: missing event payload field is reported', () => {
    const nodes = [makeNode('evt1', 'evt'), makeNode('v1', 'viewModel')];
    const edges = [makeEdge('e1', 'eventRefreshesViewModel', 'evt1', 'v1')];
    const vmSchema: ViewModelSchema = {
      viewModelNodeId: 'v1',
      fields: [{ fieldId: 'f.status', name: 'status', type: 'string', nullable: false, source: { eventNodeId: 'evt1', eventFieldPath: 'payload.status' } }],
    };
    const eventSchema: EventSchema = {
      eventNodeId: 'evt1',
      version: 1,
      payload: { fields: [{ fieldId: 'chargeId', name: 'chargeId', type: 'string', required: true }] },
    };

    const errors = validate(nodes, edges, [vmSchema], [], [eventSchema]);

    expect(errors.some(e => e.code === 'EMV-032')).toBe(true);
  });

  test('EMV-060: command schema target must be a command node', () => {
    const schema: CommandSchema = {
      commandNodeId: 'evt1',
      version: 1,
      input: { fields: [] },
    };

    const errors = validate([makeNode('evt1', 'evt')], [], [], [schema], []);

    expect(errors.some(e => e.code === 'EMV-060')).toBe(true);
  });

  test('EMV-062: duplicate command schema field ids are reported', () => {
    const schema: CommandSchema = {
      commandNodeId: 'c1',
      version: 1,
      input: {
        fields: [
          { fieldId: 'orderId', name: 'orderId', type: 'string', required: true },
          { fieldId: 'orderId', name: 'orderId', type: 'string', required: true },
        ],
      },
    };

    const errors = validate([makeNode('c1', 'cmd')], [], [], [schema], []);

    expect(errors.some(e => e.code === 'EMV-062')).toBe(true);
  });

  test('EMV-063: malformed command schema envelope is reported', () => {
    const schema = {
      commandNodeId: 'c1',
      version: 1,
      payload: { fields: [] },
    } as unknown as CommandSchema;

    const errors = validate([makeNode('c1', 'cmd')], [], [], [schema], []);

    expect(errors.some(e => e.code === 'EMV-063')).toBe(true);
  });

  test('EMV-063: malformed event schema envelope is reported', () => {
    const schema = {
      eventNodeId: 'evt1',
      version: 1,
      input: { fields: [] },
    } as unknown as EventSchema;

    const errors = validate([makeNode('evt1', 'evt')], [], [], [], [schema]);

    expect(errors.some(e => e.code === 'EMV-063')).toBe(true);
  });
});
