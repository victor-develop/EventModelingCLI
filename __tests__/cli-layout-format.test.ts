import { routeCommand } from '../src/cli/router';
import { createOrderWorkspace } from './helpers/order-workspace';

describe('em layout --format', () => {
  test('returns VisualizationSnapshot, table output, and ASCII output', () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const json = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'json']);
      expect(json.ok).toBe(true);
      expect(json.data.focusNodeId).toBe('cmd.submit-order');
      expect(json.data.truncation).toEqual({
        includeTruncatedPaths: false,
        hiddenPathCount: 0,
      });
      expect(Array.isArray(json.data.occurrences)).toBe(true);

      const table = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'table']);
      expect(table.ok).toBe(true);
      expect(table.data.output).toContain('TRUNCATION');
      expect(table.data.output).toContain('OCCURRENCES');
      expect(table.data.output).toContain('SWIMLANES');

      const allPaths = routeCommand(workspace, [
        'layout',
        '--focus',
        'cmd.submit-order',
        '--format',
        'json',
        '--include-truncated-paths',
      ]);
      expect(allPaths.ok).toBe(true);
      expect(allPaths.data.truncation).toEqual({
        includeTruncatedPaths: true,
        hiddenPathCount: 0,
      });

      const ascii = routeCommand(workspace, ['layout', '--focus', 'cmd.submit-order', '--format', 'ascii']);
      expect(ascii.ok).toBe(true);
      expect(ascii.data.output).toContain('LANE shared');
      expect(ascii.data.output).toContain('INVARIANTS');
    } finally {
      cleanup();
    }
  });
});
