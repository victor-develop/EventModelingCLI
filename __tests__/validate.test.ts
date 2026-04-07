import { validate } from '../src/validation/validate';
import { Node, Edge, ViewModelSchema } from '../src/domain/types';

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

  test('EMV-050: processor without update source', () => {
    const nodes = [makeNode('p1', 'proc')];
    const errors = validate(nodes, [], []);
    expect(errors.some(e => e.code === 'EMV-050')).toBe(true);
  });
});
