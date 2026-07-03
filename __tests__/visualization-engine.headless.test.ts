import { walkGraph, buildGraph } from '../src/graph/graph-builder';
import { LayoutEngine } from '../src/layout/layout-engine';
import { buildEnvelopeFromWalkBranches, buildVisualizationSnapshot } from '../src/viewer-contract';
import { renderLayoutAscii, renderLayoutTable } from '../src/terminal-viewer';
import { applyLayoutPatchToReactFlow, toReactFlowEdges, toReactFlowNodes } from '../em-viewer/src/xyflow/adapter';
import { createOrderWorkspace } from './helpers/order-workspace';

describe('visualization-engine.headless', () => {
  test('runs the core visualization path in Node', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const snapshot = buildVisualizationSnapshot({
        workspace,
        focus: 'cmd.submit-order',
        direction: 'forward',
        hops: 1,
      });

      const table = renderLayoutTable(snapshot);
      const ascii = renderLayoutAscii(snapshot);
      expect((ascii.match(/^LANE /gm) ?? []).length).toBe(3);
      expect(table).toContain('SWIMLANES');
      expect(snapshot.occurrences.length).toBeGreaterThan(0);
      expect(snapshot.renderedEdges.length).toBeGreaterThan(0);
      expect(snapshot.renderedEdges.every((edge) => edge.points.length > 0)).toBe(true);

      for (const occurrence of snapshot.occurrences) {
        occurrence.lockLevel = 'hard';
      }
      for (const occurrence of Object.values(snapshot.layoutState.occurrences)) {
        occurrence.lockLevel = 'hard';
      }

      const domainNodes = Object.fromEntries(workspace.listNodes().map((node) => [node.canonicalId, node]));
      let reactNodes: any[] = toReactFlowNodes(snapshot, { includeFrontierHandles: true });
      let reactEdges: any[] = toReactFlowEdges(snapshot);

      expect(reactNodes.filter((node) => node.id.startsWith('lane:'))).toHaveLength(3);
      expect(reactNodes.filter(isOccurrenceNode).length).toBeGreaterThan(0);
      expect(reactEdges.length).toBeGreaterThan(0);
      assertReactFlowGraph(reactNodes, reactEdges);

      const graph = buildGraph(workspace.listNodes(), workspace.listEdges());
      const engine = new LayoutEngine();
      const layoutState = snapshot.layoutState;
      const beforePositions = new Map(
        Object.values(layoutState.occurrences).map((occ) => [occ.occurrenceId, { x: occ.x, y: occ.y }]),
      );
      const beforeReactPositions = occurrenceAbsolutePositions(reactNodes);

      const rightFrontier = Object.values(layoutState.occurrences)
        .sort((a, b) => b.stageIndex - a.stageIndex)[0]!;
      const rightWalk = walkGraph(graph, rightFrontier.canonicalNodeId, 'forward', undefined, 1);
      const rightPatch = engine.appendExploreResult(
        layoutState,
        rightFrontier.occurrenceId,
        buildEnvelopeFromWalkBranches({
          graph,
          focusNodeId: rightFrontier.canonicalNodeId,
          branches: rightWalk.branches,
        }),
      );
      expect(rightPatch.viewportHint.revealDirection).toBe('right');
      ({ nodes: reactNodes, edges: reactEdges } = applyLayoutPatchToReactFlow({
        patch: rightPatch,
        previousNodes: reactNodes,
        previousEdges: reactEdges,
        snapshotContext: { domainNodes, laneMap: snapshot.laneMap },
      }));
      assertStableOccurrencePositions(beforeReactPositions, occurrenceAbsolutePositions(reactNodes));
      assertReactFlowGraph(reactNodes, reactEdges);

      const leftFrontier = Object.values(layoutState.occurrences)
        .find((occ) => occ.canonicalNodeId === 'cmd.submit-order')!;
      const leftWalk = walkGraph(graph, leftFrontier.canonicalNodeId, 'backward', undefined, 1);
      const leftPatch = engine.prependExploreResult(
        layoutState,
        leftFrontier.occurrenceId,
        buildEnvelopeFromWalkBranches({
          graph,
          focusNodeId: leftFrontier.canonicalNodeId,
          branches: leftWalk.branches,
        }),
      );
      expect(leftPatch.viewportHint.revealDirection).toBe('left');
      ({ nodes: reactNodes, edges: reactEdges } = applyLayoutPatchToReactFlow({
        patch: leftPatch,
        previousNodes: reactNodes,
        previousEdges: reactEdges,
        snapshotContext: { domainNodes, laneMap: snapshot.laneMap },
      }));
      assertStableOccurrencePositions(beforeReactPositions, occurrenceAbsolutePositions(reactNodes));
      assertReactFlowGraph(reactNodes, reactEdges);

      for (const [occurrenceId, position] of beforePositions) {
        const current = layoutState.occurrences[occurrenceId];
        expect(current).toBeDefined();
        expect({ x: current!.x, y: current!.y }).toEqual(position);
      }

      expect(() => JSON.stringify({ layoutState, rightPatch, leftPatch, reactNodes, reactEdges })).not.toThrow();
    } finally {
      cleanup();
    }
  });
});

function isOccurrenceNode(node: { id: string; parentId?: string }): boolean {
  return Boolean(node.parentId) && !node.id.startsWith('frontier:');
}

function assertReactFlowGraph(nodes: any[], edges: any[]): void {
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of nodes.filter(isOccurrenceNode)) {
    expect(node.parentId).toMatch(/^lane:/);
    expect(node.extent).toBe('parent');
    expect(nodeIds.has(node.parentId)).toBe(true);
  }
  for (const edge of edges) {
    expect(nodeIds.has(edge.source)).toBe(true);
    expect(nodeIds.has(edge.target)).toBe(true);
    expect(edge.data?.points?.length).toBeGreaterThan(0);
  }
}

function occurrenceAbsolutePositions(nodes: any[]): Map<string, { x: number; y: number }> {
  const laneById = new Map(nodes.filter((node) => node.id.startsWith('lane:')).map((node) => [node.id, node]));
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes.filter(isOccurrenceNode)) {
    const lane = laneById.get(node.parentId);
    expect(lane).toBeDefined();
    positions.set(node.id, {
      x: lane.position.x + node.position.x,
      y: lane.position.y + node.position.y,
    });
  }
  return positions;
}

function assertStableOccurrencePositions(
  before: Map<string, { x: number; y: number }>,
  after: Map<string, { x: number; y: number }>,
): void {
  for (const [nodeId, position] of before) {
    expect(after.get(nodeId)).toEqual(position);
  }
}
