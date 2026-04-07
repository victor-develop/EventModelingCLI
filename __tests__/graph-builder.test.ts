import { buildGraph, getNeighbors, walkGraph, tracePath, toMermaid } from '../src/graph/graph-builder';
import { Node, Edge } from '../src/domain/types';

function makeNode(id: string, kind: Node['kind']): Node {
  return { id, projectId: 'p', kind, canonicalId: id, displayName: id, tags: [], domains: [] };
}

function makeEdge(id: string, type: Edge['type'], from: string, to: string): Edge {
  return { id, projectId: 'p', type, fromNodeId: from, toNodeId: to };
}

describe('graph builder', () => {
  test('builds graph with adjacency', () => {
    const nodes = [makeNode('a', 'cmd'), makeNode('b', 'evt')];
    const edges = [makeEdge('e1', 'commandCausesEvent', 'a', 'b')];
    const g = buildGraph(nodes, edges);
    expect(g.nodes.size).toBe(2);
    expect(g.outgoing.get('a')!.length).toBe(1);
    expect(g.incoming.get('b')!.length).toBe(1);
  });

  test('getNeighbors returns 1-hop', () => {
    const nodes = [makeNode('a', 'cmd'), makeNode('b', 'evt'), makeNode('c', 'viewModel')];
    const edges = [
      makeEdge('e1', 'commandCausesEvent', 'a', 'b'),
      makeEdge('e2', 'eventRefreshesViewModel', 'b', 'c'),
    ];
    const g = buildGraph(nodes, edges);
    const neighbors = getNeighbors(g, 'a', 'out');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0]!.nodeId).toBe('b');
  });

  test('walk forward', () => {
    const nodes = [makeNode('a', 'cmd'), makeNode('b', 'evt'), makeNode('c', 'viewModel')];
    const edges = [
      makeEdge('e1', 'commandCausesEvent', 'a', 'b'),
      makeEdge('e2', 'eventRefreshesViewModel', 'b', 'c'),
    ];
    const g = buildGraph(nodes, edges);
    const result = walkGraph(g, 'a', 'forward', undefined, 5);
    expect(result.branches.length).toBeGreaterThan(0);
  });

  test('trace finds path', () => {
    const nodes = [makeNode('a', 'cmd'), makeNode('b', 'evt'), makeNode('c', 'viewModel')];
    const edges = [
      makeEdge('e1', 'commandCausesEvent', 'a', 'b'),
      makeEdge('e2', 'eventRefreshesViewModel', 'b', 'c'),
    ];
    const g = buildGraph(nodes, edges);
    const paths = tracePath(g, 'a', 'c', 10);
    expect(paths.length).toBeGreaterThan(0);
  });

  test('toMermaid generates output', () => {
    const nodes = [makeNode('a', 'cmd'), makeNode('b', 'evt')];
    const edges = [makeEdge('e1', 'commandCausesEvent', 'a', 'b')];
    const g = buildGraph(nodes, edges);
    const mmd = toMermaid(g);
    expect(mmd).toContain('graph TD');
    expect(mmd).toContain('-->');
  });
});
