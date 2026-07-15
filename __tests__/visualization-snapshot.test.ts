import { buildEnvelopeFromWalkBranches, buildVisualizationSnapshot, VisualizationSnapshotError } from '../src/viewer-contract';
import { renderLayoutAscii, renderLayoutTable } from '../src/terminal-viewer/renderers';
import type { Edge, Node } from '../src/domain/types';
import { createOrderWorkspace } from './helpers/order-workspace';
import { buildGraph } from '../src/graph/graph-builder';

describe('buildVisualizationSnapshot', () => {
  test('builds a renderer-agnostic snapshot from a workspace', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const snapshot = buildVisualizationSnapshot({
        workspace,
        focus: 'cmd.submit-order',
        direction: 'both',
        hops: 2,
      });

      expect(snapshot.focusNodeId).toBe('cmd.submit-order');
      expect(snapshot.projectName).toBe('Order Management');
      expect(snapshot.occurrences.length).toBeGreaterThan(0);
      expect(snapshot.renderedEdges.length).toBeGreaterThan(0);
      expect(snapshot.swimlaneRects.map((rect) => rect.lane)).toEqual(['shared', 'commandViewModel', 'event']);
      expect(snapshot.laneMap).toEqual({
        shared: 'shared',
        commandViewModel: 'command / viewModel',
        event: 'event',
      });
      expect(Object.keys(snapshot.domainNodes)).toContain('cmd.submit-order');
      expect(Object.keys(snapshot.domainEdges).length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  test('throws a structured NOT_FOUND error for a missing focus', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      expect(() => buildVisualizationSnapshot({
        workspace,
        focus: 'cmd.missing',
        direction: 'both',
        hops: 2,
      })).toThrow(VisualizationSnapshotError);
    } finally {
      cleanup();
    }
  });

  test('excludes UI hierarchy and story ownership edges from event-modeling layout', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'ui.checkout.summary', 'ui.section', 'Checkout Summary'));
      workspace.saveNode(node(projectId, 'story.checkout', 'story.story', 'Checkout Story'));
      workspace.saveEdge(edge(projectId, 'edge-ui-parent', 'parentOf', 'ui.checkout', 'ui.checkout.summary'));
      workspace.saveEdge(edge(projectId, 'edge-story-command', 'storyOwnsCommand', 'story.checkout', 'cmd.submit-order'));

      const snapshot = buildVisualizationSnapshot({
        workspace,
        focus: 'ui.checkout',
        direction: 'forward',
        hops: 1,
      });
      const domainEdgeTypes = Object.values(snapshot.domainEdges).map((item) => item.type);
      const ascii = renderLayoutAscii(snapshot);
      const table = renderLayoutTable(snapshot);

      expect(domainEdgeTypes).toEqual(['roleIssuesCommand']);
      expect(snapshot.renderedEdges.map((item) => item.kind)).not.toContain('shared-to-shared');
      expect(ascii).not.toContain('ui.checkout --shared-to-shared--> ui.checkout.summary');
      expect(table).toContain('left-to-right edges: PASS');
    } finally {
      cleanup();
    }
  });

  test('keeps view consumption in canonical event-modeling direction', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'vm.checkout-summary', 'viewModel', 'Checkout Summary'));
      workspace.saveEdge(edge(projectId, 'edge-ui-consumes-summary', 'viewModelConsumedByUiOrProcessor', 'vm.checkout-summary', 'ui.checkout'));

      const uiForward = buildVisualizationSnapshot({
        workspace,
        focus: 'ui.checkout',
        direction: 'forward',
        hops: 1,
      });
      expect(Object.keys(uiForward.domainEdges)).not.toContain('edge-ui-consumes-summary');

      const viewForward = buildVisualizationSnapshot({
        workspace,
        focus: 'vm.checkout-summary',
        direction: 'forward',
        hops: 1,
      });
      const occurrences = new Map(viewForward.occurrences.map((occ) => [occ.occurrenceId, occ]));
      const renderedEdge = viewForward.renderedEdges.find((item) => item.displayEdgeId === 'de_1')!;

      expect(Object.keys(viewForward.domainEdges)).toContain('edge-ui-consumes-summary');
      expect(renderedEdge.kind).toBe('viewModel-to-shared');
      expect(occurrences.get(renderedEdge.fromOccurrenceId)?.canonicalNodeId).toBe('vm.checkout-summary');
      expect(occurrences.get(renderedEdge.toOccurrenceId)?.canonicalNodeId).toBe('ui.checkout');
    } finally {
      cleanup();
    }
  });

  test('renders repeated view model consumption when a later event refreshes the same view model', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'cmd.ship-order', 'cmd', 'Ship Order'));
      workspace.saveNode(node(projectId, 'evt.order-shipped', 'evt', 'Order Shipped'));
      workspace.saveEdge(edge(projectId, 'edge-pay-to-ship', 'roleIssuesCommand', 'ui.pay-order-action', 'cmd.ship-order'));
      workspace.saveEdge(edge(projectId, 'edge-ship-to-shipped', 'commandCausesEvent', 'cmd.ship-order', 'evt.order-shipped'));
      workspace.saveEdge(edge(projectId, 'edge-shipped-to-detail', 'eventRefreshesViewModel', 'evt.order-shipped', 'vm.order-detail'));

      const snapshot = buildVisualizationSnapshot({
        workspace,
        focus: 'ui.checkout',
        direction: 'forward',
        hops: 8,
      });
      const detailOccurrences = snapshot.occurrences
        .filter((occ) => occ.canonicalNodeId === 'vm.order-detail')
        .sort((a, b) => a.stageIndex - b.stageIndex);
      const payActionOccurrences = snapshot.occurrences
        .filter((occ) => occ.canonicalNodeId === 'ui.pay-order-action')
        .sort((a, b) => a.stageIndex - b.stageIndex);
      const edgesByOriginalId = new Map(snapshot.renderedEdges.map((item) => [item.meta?.originalEdgeId, item]));

      expect(detailOccurrences.map((occ) => occ.stageIndex)).toEqual([3, 7]);
      expect(payActionOccurrences.map((occ) => occ.stageIndex)).toEqual([4, 8]);

      const shippedToDetail = edgesByOriginalId.get('edge-shipped-to-detail')!;
      const repeatedViewToUi = snapshot.renderedEdges
        .filter((item) => item.meta?.originalEdgeId === 'edge-vm-to-pay')
        .find((item) => item.fromOccurrenceId === detailOccurrences[1]!.occurrenceId);

      expect(shippedToDetail.toOccurrenceId).toBe(detailOccurrences[1]!.occurrenceId);
      expect(repeatedViewToUi?.toOccurrenceId).toBe(payActionOccurrences[1]!.occurrenceId);
      expect(renderLayoutTable(snapshot)).toContain('left-to-right edges: PASS');
    } finally {
      cleanup();
    }
  });

  test('exposes role-owned shared surfaces as separate renderer-agnostic lanes', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'role.buyer', 'role', 'Buyer'));
      workspace.saveNode(node(projectId, 'role.merchant', 'role', 'Merchant'));
      workspace.saveNode(node(projectId, 'ui.screen.return-portal', 'ui.screen', 'Return Portal'));
      workspace.saveNode(node(projectId, 'returns.cmd.request-return', 'cmd', 'Request Return'));
      workspace.saveNode(node(projectId, 'returns.cmd.approve-return', 'cmd', 'Approve Return'));
      workspace.saveEdge(edge(projectId, 'edge-buyer-request', 'roleIssuesCommand', 'role.buyer', 'returns.cmd.request-return', 'ui.screen.return-portal'));
      workspace.saveEdge(edge(projectId, 'edge-merchant-approve', 'roleIssuesCommand', 'role.merchant', 'returns.cmd.approve-return', 'ui.screen.return-portal'));

      const snapshot = buildVisualizationSnapshot({
        workspace,
        focus: 'ui.screen.return-portal',
        direction: 'forward',
        hops: 1,
      });
      const portalLanes = snapshot.occurrences
        .filter((occ) => occ.canonicalNodeId === 'ui.screen.return-portal')
        .map((occ) => occ.lane)
        .sort();
      const laneLabels = new Map(snapshot.laneDescriptors.map((descriptor) => [descriptor.id, descriptor.label]));

      expect(portalLanes).toEqual(['role:role.buyer', 'role:role.merchant']);
      expect(snapshot.swimlaneRects.map((rect) => rect.lane)).toEqual([
        'role:role.buyer',
        'role:role.merchant',
        'commandViewModel',
      ]);
      expect(laneLabels.get('role:role.buyer')).toBe('Buyer');
      expect(laneLabels.get('role:role.merchant')).toBe('Merchant');
      expect(snapshot.laneMap).toMatchObject({
        'role:role.buyer': 'Buyer',
        'role:role.merchant': 'Merchant',
      });
      expect(renderLayoutAscii(snapshot)).toContain('LANE Buyer');
      expect(renderLayoutAscii(snapshot)).toContain('LANE Merchant');
      expect(renderLayoutTable(snapshot)).toContain('role:role.buyer');
      expect(renderLayoutTable(snapshot)).toContain('left-to-right edges: PASS');
    } finally {
      cleanup();
    }
  });

  test('assigns role lanes per path occurrence when a shared surface is revisited', () => {
    const projectId = 'returns';
    const nodes = [
      node(projectId, 'role.buyer', 'role', 'Buyer'),
      node(projectId, 'role.merchant', 'role', 'Merchant'),
      node(projectId, 'ui.screen.return-portal', 'ui.screen', 'Return Portal'),
      node(projectId, 'returns.cmd.request-return', 'cmd', 'Request Return'),
      node(projectId, 'returns.evt.return-requested', 'evt', 'Return Requested'),
      node(projectId, 'returns.vm.return-case', 'viewModel', 'Return Case'),
      node(projectId, 'returns.cmd.approve-return', 'cmd', 'Approve Return'),
    ];
    const edges = [
      edge(projectId, 'edge-buyer-request', 'roleIssuesCommand', 'role.buyer', 'returns.cmd.request-return', 'ui.screen.return-portal'),
      edge(projectId, 'edge-requested', 'commandCausesEvent', 'returns.cmd.request-return', 'returns.evt.return-requested'),
      edge(projectId, 'edge-refresh-case', 'eventRefreshesViewModel', 'returns.evt.return-requested', 'returns.vm.return-case'),
      edge(projectId, 'edge-case-to-portal', 'viewModelConsumedByUiOrProcessor', 'returns.vm.return-case', 'ui.screen.return-portal'),
      edge(projectId, 'edge-merchant-approve', 'roleIssuesCommand', 'role.merchant', 'returns.cmd.approve-return', 'ui.screen.return-portal'),
    ];
    const graph = buildGraph(nodes, edges);

    const envelope = buildEnvelopeFromWalkBranches({
      graph,
      focusNodeId: 'ui.screen.return-portal',
      branches: [{
        path: [
          { nodeId: 'ui.screen.return-portal', nodeKind: 'ui.screen' },
          { edgeId: 'edge-buyer-request', edgeType: 'roleIssuesCommand', direction: 'forward' },
          { nodeId: 'returns.cmd.request-return', nodeKind: 'cmd' },
          { edgeId: 'edge-requested', edgeType: 'commandCausesEvent', direction: 'forward' },
          { nodeId: 'returns.evt.return-requested', nodeKind: 'evt' },
          { edgeId: 'edge-refresh-case', edgeType: 'eventRefreshesViewModel', direction: 'forward' },
          { nodeId: 'returns.vm.return-case', nodeKind: 'viewModel' },
          { edgeId: 'edge-case-to-portal', edgeType: 'viewModelConsumedByUiOrProcessor', direction: 'forward' },
          { nodeId: 'ui.screen.return-portal', nodeKind: 'ui.screen' },
          { edgeId: 'edge-merchant-approve', edgeType: 'roleIssuesCommand', direction: 'forward' },
          { nodeId: 'returns.cmd.approve-return', nodeKind: 'cmd' },
        ],
      }],
    });

    const portalLanes = envelope.branches[0]!.path
      .filter((step) => step.type === 'node' && step.nodeId === 'ui.screen.return-portal')
      .map((step) => step.type === 'node' ? step.lane : undefined);

    expect(portalLanes).toEqual(['role:role.buyer', 'role:role.merchant']);
  });
});

function node(projectId: string, canonicalId: string, kind: Node['kind'], displayName: string): Node {
  return {
    id: canonicalId,
    projectId,
    kind,
    canonicalId,
    displayName,
    tags: [],
    domains: [],
  };
}

function edge(
  projectId: string,
  id: string,
  type: Edge['type'],
  fromNodeId: string,
  toNodeId: string,
  viaNodeId?: string,
): Edge {
  return {
    id,
    projectId,
    type,
    fromNodeId,
    toNodeId,
    viaNodeId,
  };
}
