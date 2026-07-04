import { buildVisualizationSnapshot, VisualizationSnapshotError } from '../src/viewer-contract';
import { renderLayoutAscii, renderLayoutTable } from '../src/terminal-viewer/renderers';
import type { Edge, Node } from '../src/domain/types';
import { createOrderWorkspace } from './helpers/order-workspace';

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

      expect(domainEdgeTypes).toEqual(['roleUsesUIToIssueCommand']);
      expect(snapshot.renderedEdges.map((item) => item.kind)).not.toContain('shared-to-shared');
      expect(ascii).not.toContain('ui.checkout --shared-to-shared--> ui.checkout.summary');
      expect(table).toContain('left-to-right edges: PASS');
    } finally {
      cleanup();
    }
  });

  test('projects view consumption into event-modeling display direction', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'vm.checkout-summary', 'viewModel', 'Checkout Summary'));
      workspace.saveEdge(edge(projectId, 'edge-ui-consumes-summary', 'uiOrProcessorConsumesViewModel', 'ui.checkout', 'vm.checkout-summary'));

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
): Edge {
  return {
    id,
    projectId,
    type,
    fromNodeId,
    toNodeId,
  };
}
