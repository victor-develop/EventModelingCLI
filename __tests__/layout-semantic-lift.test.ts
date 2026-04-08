import { semanticLift } from '../src/layout/semantic-lift';
import { DisplayEdge, DisplayEdgeKind } from '../src/layout/types';

describe('semantic-lift', () => {
  const cases: Array<{ edgeType: string; expectedKind: DisplayEdgeKind; expectedFrom: string; expectedTo: string }> = [
    { edgeType: 'roleUsesUIToIssueCommand', expectedKind: 'shared-to-cmd', expectedFrom: 'shared', expectedTo: 'cmd' },
    { edgeType: 'processorOrTriggerIssuesCommand', expectedKind: 'shared-to-cmd', expectedFrom: 'shared', expectedTo: 'cmd' },
    { edgeType: 'commandCausesEvent', expectedKind: 'cmd-to-evt', expectedFrom: 'cmd', expectedTo: 'evt' },
    { edgeType: 'eventRefreshesViewModel', expectedKind: 'evt-to-viewModel', expectedFrom: 'evt', expectedTo: 'viewModel' },
    { edgeType: 'uiOrProcessorConsumesViewModel', expectedKind: 'viewModel-to-shared', expectedFrom: 'viewModel', expectedTo: 'shared' },
    { edgeType: 'eventUpdatesProcessor', expectedKind: 'evt-to-shared', expectedFrom: 'evt', expectedTo: 'shared' },
  ];

  for (const c of cases) {
    test(`${c.edgeType} -> ${c.expectedKind} (${c.expectedFrom} -> ${c.expectedTo})`, () => {
      const result = semanticLift(c.edgeType as any, 'e1');
      expect(result.kind).toBe(c.expectedKind);
      expect(result.fromNodeKind).toBe(c.expectedFrom);
      expect(result.toNodeKind).toBe(c.expectedTo);
      expect(result.originalEdgeType).toBe(c.edgeType);
      expect(result.originalEdgeId).toBe('e1');
    });
  }

  test('returns unique displayEdgeId per call', () => {
    const r1 = semanticLift('commandCausesEvent' as any, 'e1');
    const r2 = semanticLift('commandCausesEvent' as any, 'e2');
    expect(r1.displayEdgeId).not.toBe(r2.displayEdgeId);
  });

  test('display edge from shared lane goes to cmd lane', () => {
    const r = semanticLift('roleUsesUIToIssueCommand' as any, 'e1');
    expect(r.kind).toBe('shared-to-cmd');
  });

  test('cmd-to-evt is always forward', () => {
    const r = semanticLift('commandCausesEvent' as any, 'e1');
    expect(r.kind).toBe('cmd-to-evt');
  });
});
