import { routeCommand } from '../src/cli/router';
import { createOrderWorkspace } from './helpers/order-workspace';

describe('em layout --format', () => {
  test('returns VisualizationSnapshot, table output, and ASCII output', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const json = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'json']);
      expect(json.ok).toBe(true);
      expect(json.data.focusNodeId).toBe('cmd.submit-order');
      expect(Array.isArray(json.data.occurrences)).toBe(true);

      const table = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'table']);
      expect(table.ok).toBe(true);
      expect(table.data.output).toContain('OCCURRENCES');
      expect(table.data.output).toContain('SWIMLANES');

      const ascii = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'ascii']);
      expect(ascii.ok).toBe(true);
      expect(ascii.data.output).toContain('LANE shared');
      expect(ascii.data.output).toContain('INVARIANTS');
    } finally {
      cleanup();
    }
  });
});
