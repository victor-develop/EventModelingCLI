import { buildGraph, getNeighbors, walkGraph, tracePath, toMermaid, findRoots } from '../src/graph/graph-builder';
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

describe('findRoots', () => {
  test('finds single root in linear chain', () => {
    const nodes = [makeNode('BookRoom', 'cmd'), makeNode('RoomBooked', 'evt'), makeNode('Avail', 'viewModel')];
    const edges = [
      makeEdge('e1', 'commandCausesEvent', 'BookRoom', 'RoomBooked'),
      makeEdge('e2', 'eventRefreshesViewModel', 'RoomBooked', 'Avail'),
    ];
    const g = buildGraph(nodes, edges);
    const roots = findRoots(g);
    expect(roots.length).toBe(1);
    expect(roots[0]!.canonicalId).toBe('BookRoom');
    expect(roots[0]!.kind).toBe('cmd');
  });

  test('finds multiple disconnected roots', () => {
    const nodes = [
      makeNode('BookRoom', 'cmd'), makeNode('RoomBooked', 'evt'),
      makeNode('CancelBooking', 'cmd'), makeNode('BookingCancelled', 'evt'),
      makeNode('Summary', 'viewModel'),
    ];
    const edges = [
      makeEdge('e1', 'commandCausesEvent', 'BookRoom', 'RoomBooked'),
      makeEdge('e2', 'eventRefreshesViewModel', 'RoomBooked', 'Summary'),
      makeEdge('e3', 'commandCausesEvent', 'CancelBooking', 'BookingCancelled'),
      makeEdge('e4', 'eventRefreshesViewModel', 'BookingCancelled', 'Summary'),
    ];
    const g = buildGraph(nodes, edges);
    const roots = findRoots(g);
    const rootIds = roots.map(r => r.canonicalId);
    expect(rootIds).toContain('BookRoom');
    expect(rootIds).toContain('CancelBooking');
    expect(roots.length).toBe(2);
  });

  test('trigger is root when no incoming flow edges', () => {
    const nodes = [makeNode('Timer', 'trigger'), makeNode('Cleanup', 'cmd'), makeNode('Cleaned', 'evt')];
    const edges = [
      makeEdge('e1', 'processorOrTriggerIssuesCommand', 'Timer', 'Cleanup'),
      makeEdge('e2', 'commandCausesEvent', 'Cleanup', 'Cleaned'),
    ];
    const g = buildGraph(nodes, edges);
    const roots = findRoots(g);
    expect(roots.length).toBe(1);
    expect(roots[0]!.canonicalId).toBe('Timer');
  });

  test('returns empty for empty graph', () => {
    const g = buildGraph([], []);
    const roots = findRoots(g);
    expect(roots).toEqual([]);
  });

  test('excludes evt and viewModel from roots', () => {
    const nodes = [makeNode('BookRoom', 'cmd'), makeNode('RoomBooked', 'evt'), makeNode('Avail', 'viewModel')];
    const edges = [makeEdge('e1', 'commandCausesEvent', 'BookRoom', 'RoomBooked')];
    const g = buildGraph(nodes, edges);
    const roots = findRoots(g);
    const kinds = roots.map(r => r.kind);
    expect(kinds).not.toContain('evt');
    expect(kinds).not.toContain('viewModel');
  });
});

describe('viaNodeId fallback', () => {
  function makeEdgeWithVia(id: string, type: Edge['type'], from: string, to: string, via: string): Edge {
    return { id, projectId: 'p', type, fromNodeId: from, toNodeId: to, viaNodeId: via };
  }

  test('walkGraph backward uses viaNodeId when fromNodeId is not a node', () => {
    const nodes = [
      makeNode('hotel.cmd.BookRoom', 'cmd'),
      makeNode('hotel.evt.RoomBooked', 'evt'),
      makeNode('ui.form.booking-form', 'ui.form' as Node['kind']),
    ];
    const edges: Edge[] = [
      makeEdge('e1', 'commandCausesEvent', 'hotel.cmd.BookRoom', 'hotel.evt.RoomBooked'),
      makeEdgeWithVia('e2', 'roleUsesUIToIssueCommand', 'guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);
    const result = walkGraph(g, 'hotel.cmd.BookRoom', 'backward', undefined, 3);
    expect(result.branches.length).toBeGreaterThan(0);
    const pathNodeIds = result.branches[0]!.path
      .filter(s => s.nodeId)
      .map(s => s.nodeId);
    expect(pathNodeIds).toContain('ui.form.booking-form');
  });

  test('getNeighbors uses viaNodeId fallback', () => {
    const nodes = [
      makeNode('hotel.cmd.BookRoom', 'cmd'),
      makeNode('ui.form.booking-form', 'ui.form' as Node['kind']),
    ];
    const edges: Edge[] = [
      makeEdgeWithVia('e1', 'roleUsesUIToIssueCommand', 'guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);
    const neighbors = getNeighbors(g, 'hotel.cmd.BookRoom', 'in');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0]!.nodeId).toBe('ui.form.booking-form');
  });
});
