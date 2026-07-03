import { buildVisualizationSnapshot, VisualizationSnapshotError } from '../src/viewer-contract';
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
});
