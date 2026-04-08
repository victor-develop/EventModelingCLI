import { routeEdges } from '../src/layout/edge-router';
import { Occurrence, RenderedEdge, DEFAULT_LAYOUT_CONFIG } from '../src/layout/types';

describe('edge-router', () => {
  test('routes orthogonal polyline between adjacent stages', () => {
    const from: Occurrence = {
      occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
      lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
      branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
    };

    const to: Occurrence = {
      occurrenceId: 'occ_evt', canonicalNodeId: 'evt.y', nodeKind: 'evt',
      lane: 'event', stageIndex: 2, rowIndex: 0, displayRole: 'event',
      branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 400, width: 220, height: 56,
    };

    const edge: RenderedEdge = {
      displayEdgeId: 'de1',
      fromOccurrenceId: 'occ_cmd',
      toOccurrenceId: 'occ_evt',
      kind: 'cmd-to-evt',
      points: [],
      meta: {},
    };

    const result = routeEdges([edge], { occ_cmd: from, occ_evt: to }, DEFAULT_LAYOUT_CONFIG);
    expect(result.length).toBe(1);
    expect(result[0].points.length).toBeGreaterThanOrEqual(2);

    const points = result[0].points;
    expect(points[0][0]).toBeLessThan(points[points.length - 1][0]);
  });

  test('source exits from right side of node', () => {
    const from: Occurrence = {
      occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
      lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
      branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
    };

    const to: Occurrence = {
      occurrenceId: 'occ_evt', canonicalNodeId: 'evt.y', nodeKind: 'evt',
      lane: 'event', stageIndex: 2, rowIndex: 0, displayRole: 'event',
      branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 400, width: 220, height: 56,
    };

    const edge: RenderedEdge = {
      displayEdgeId: 'de1', fromOccurrenceId: 'occ_cmd', toOccurrenceId: 'occ_evt',
      kind: 'cmd-to-evt', points: [], meta: {},
    };

    const result = routeEdges([edge], { occ_cmd: from, occ_evt: to }, DEFAULT_LAYOUT_CONFIG);
    const startX = result[0].points[0][0];
    expect(startX).toBe(from.x + from.width);
  });

  test('target enters from left side of node', () => {
    const from: Occurrence = {
      occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
      lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
      branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
    };

    const to: Occurrence = {
      occurrenceId: 'occ_evt', canonicalNodeId: 'evt.y', nodeKind: 'evt',
      lane: 'event', stageIndex: 2, rowIndex: 0, displayRole: 'event',
      branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 400, width: 220, height: 56,
    };

    const edge: RenderedEdge = {
      displayEdgeId: 'de1', fromOccurrenceId: 'occ_cmd', toOccurrenceId: 'occ_evt',
      kind: 'cmd-to-evt', points: [], meta: {},
    };

    const result = routeEdges([edge], { occ_cmd: from, occ_evt: to }, DEFAULT_LAYOUT_CONFIG);
    const lastPoint = result[0].points[result[0].points.length - 1];
    expect(lastPoint[0]).toBe(to.x);
  });

  test('routes multi-segment polyline when lanes differ', () => {
    const from: Occurrence = {
      occurrenceId: 'occ_cmd', canonicalNodeId: 'cmd.x', nodeKind: 'cmd',
      lane: 'commandViewModel', stageIndex: 1, rowIndex: 0, displayRole: 'command',
      branchClusterId: 'b1', lockLevel: 'free', x: 400, y: 200, width: 220, height: 56,
    };

    const to: Occurrence = {
      occurrenceId: 'occ_evt', canonicalNodeId: 'evt.y', nodeKind: 'evt',
      lane: 'event', stageIndex: 2, rowIndex: 2, displayRole: 'event',
      branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 560, width: 220, height: 56,
    };

    const edge: RenderedEdge = {
      displayEdgeId: 'de1', fromOccurrenceId: 'occ_cmd', toOccurrenceId: 'occ_evt',
      kind: 'cmd-to-evt', points: [], meta: {},
    };

    const result = routeEdges([edge], { occ_cmd: from, occ_evt: to }, DEFAULT_LAYOUT_CONFIG);
    expect(result[0].points.length).toBeGreaterThanOrEqual(4);
  });

  test('routes multiple edges from same source without overlap', () => {
    const from: Occurrence = {
      occurrenceId: 'occ_evt', canonicalNodeId: 'evt.x', nodeKind: 'evt',
      lane: 'event', stageIndex: 2, rowIndex: 0, displayRole: 'event',
      branchClusterId: 'b1', lockLevel: 'free', x: 800, y: 400, width: 220, height: 56,
    };

    const to1: Occurrence = {
      occurrenceId: 'occ_vm1', canonicalNodeId: 'view.a', nodeKind: 'viewModel',
      lane: 'commandViewModel', stageIndex: 3, rowIndex: 0, displayRole: 'projection',
      branchClusterId: 'b1', lockLevel: 'free', x: 1200, y: 200, width: 220, height: 56,
    };

    const to2: Occurrence = {
      occurrenceId: 'occ_vm2', canonicalNodeId: 'view.b', nodeKind: 'viewModel',
      lane: 'commandViewModel', stageIndex: 3, rowIndex: 1, displayRole: 'projection',
      branchClusterId: 'b2', lockLevel: 'free', x: 1200, y: 280, width: 220, height: 56,
    };

    const edges: RenderedEdge[] = [
      { displayEdgeId: 'de1', fromOccurrenceId: 'occ_evt', toOccurrenceId: 'occ_vm1', kind: 'evt-to-viewModel', points: [], meta: {} },
      { displayEdgeId: 'de2', fromOccurrenceId: 'occ_evt', toOccurrenceId: 'occ_vm2', kind: 'evt-to-viewModel', points: [], meta: {} },
    ];

    const result = routeEdges(edges, { occ_evt: from, occ_vm1: to1, occ_vm2: to2 }, DEFAULT_LAYOUT_CONFIG);
    expect(result.length).toBe(2);
    expect(result[0].points).not.toEqual(result[1].points);
  });
});
