import { buildGraph, getNeighbors, walkGraph, tracePath, toMermaid, findRoots, resolveNodeId } from '../src/graph/graph-builder';
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

  test('walk forward preserves hop-bounded cycles as repeated occurrences', () => {
    const nodes = [
      makeNode('ui.checkout', 'ui.screen' as Node['kind']),
      makeNode('cmd.submit', 'cmd'),
      makeNode('evt.submitted', 'evt'),
      makeNode('vm.detail', 'viewModel'),
    ];
    const edges = [
      makeEdge('e-ui-cmd', 'roleIssuesCommand', 'ui.checkout', 'cmd.submit'),
      makeEdge('e-cmd-evt', 'commandCausesEvent', 'cmd.submit', 'evt.submitted'),
      makeEdge('e-evt-vm', 'eventRefreshesViewModel', 'evt.submitted', 'vm.detail'),
      makeEdge('e-vm-ui', 'viewModelConsumedByUiOrProcessor', 'vm.detail', 'ui.checkout'),
    ];
    const g = buildGraph(nodes, edges);

    const result = walkGraph(g, 'ui.checkout', 'forward', undefined, 5);
    const nodeIds = result.branches[0]!.path
      .filter((step) => step.nodeId)
      .map((step) => step.nodeId);

    expect(nodeIds.filter((nodeId) => nodeId === 'ui.checkout')).toHaveLength(2);
    expect(nodeIds).toEqual([
      'ui.checkout',
      'cmd.submit',
      'evt.submitted',
      'vm.detail',
      'ui.checkout',
      'cmd.submit',
    ]);
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

  test('includes role issue via surface even when it consumes a view model', () => {
    const nodes = [
      makeNode('ui.screen.return-request-form', 'ui.screen'),
      makeNode('returns.cmd.request-return', 'cmd'),
      makeNode('returns.view.return.draft', 'viewModel'),
    ];
    const roleEdge: Edge = {
      ...makeEdge('e1', 'roleIssuesCommand', 'role.buyer', 'returns.cmd.request-return'),
      viaNodeId: 'ui.screen.return-request-form',
    };
    const edges = [
      roleEdge,
      makeEdge('e2', 'viewModelConsumedByUiOrProcessor', 'returns.view.return.draft', 'ui.screen.return-request-form'),
    ];

    const roots = findRoots(buildGraph(nodes, edges));

    expect(roots.map(r => r.canonicalId)).toContain('ui.screen.return-request-form');
  });

  test('excludes pure UI containers with no event-modeling outgoing edge', () => {
    const nodes = [
      makeNode('ui.app.merchant-admin', 'ui.app'),
      makeNode('ui.screen.return-request-form', 'ui.screen'),
      makeNode('returns.cmd.request-return', 'cmd'),
    ];
    const roleEdge: Edge = {
      ...makeEdge('e1', 'roleIssuesCommand', 'role.buyer', 'returns.cmd.request-return'),
      viaNodeId: 'ui.screen.return-request-form',
    };
    const roots = findRoots(buildGraph(nodes, [roleEdge]));
    const rootIds = roots.map(r => r.canonicalId);

    expect(rootIds).not.toContain('ui.app.merchant-admin');
    expect(rootIds).toContain('ui.screen.return-request-form');
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
      makeEdgeWithVia('e2', 'roleIssuesCommand', 'guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);
    const result = walkGraph(g, 'hotel.cmd.BookRoom', 'backward', undefined, 3);
    expect(result.branches.length).toBeGreaterThan(0);
    const pathNodeIds = result.branches[0]!.path
      .filter(s => s.nodeId)
      .map(s => s.nodeId);
    expect(pathNodeIds).toContain('ui.form.booking-form');
  });

  test('walkGraph backward prefers viaNodeId surface over role node for role-issued commands', () => {
    const nodes = [
      makeNode('role.guest', 'role'),
      makeNode('hotel.cmd.BookRoom', 'cmd'),
      makeNode('ui.form.booking-form', 'ui.form' as Node['kind']),
    ];
    const edges: Edge[] = [
      makeEdgeWithVia('e1', 'roleIssuesCommand', 'role.guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);
    const result = walkGraph(g, 'hotel.cmd.BookRoom', 'backward', undefined, 1);
    const pathNodeIds = result.branches[0]!.path
      .filter(s => s.nodeId)
      .map(s => s.nodeId);

    expect(pathNodeIds).toContain('ui.form.booking-form');
    expect(pathNodeIds).not.toContain('role.guest');
  });

  test('adds implicit role nodes for role-issued commands', () => {
    const nodes = [
      makeNode('hotel.cmd.BookRoom', 'cmd'),
      makeNode('ui.form.booking-form', 'ui.form' as Node['kind']),
    ];
    const edges: Edge[] = [
      makeEdgeWithVia('e1', 'roleIssuesCommand', 'role.guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);

    expect(resolveNodeId(g, 'role.guest')).toBe('role.guest');
    expect(g.nodes.get('role.guest')?.kind).toBe('role');
  });

  test('getNeighbors uses viaNodeId fallback', () => {
    const nodes = [
      makeNode('hotel.cmd.BookRoom', 'cmd'),
      makeNode('ui.form.booking-form', 'ui.form' as Node['kind']),
    ];
    const edges: Edge[] = [
      makeEdgeWithVia('e1', 'roleIssuesCommand', 'guest', 'hotel.cmd.BookRoom', 'ui.form.booking-form'),
    ];
    const g = buildGraph(nodes, edges);
    const neighbors = getNeighbors(g, 'hotel.cmd.BookRoom', 'in');
    expect(neighbors.length).toBe(1);
    expect(neighbors[0]!.nodeId).toBe('ui.form.booking-form');
  });
});
