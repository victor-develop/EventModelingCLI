import { EdgeType } from '../domain/types';
import { DisplayEdge, DisplayEdgeKind, DisplayNodeKind } from './types';

let deCounter = 0;

const EDGE_LIFT_MAP: Record<string, { kind: DisplayEdgeKind; from: DisplayNodeKind; to: DisplayNodeKind }> = {
  roleUsesUIToIssueCommand: { kind: 'shared-to-cmd', from: 'shared', to: 'cmd' },
  processorOrTriggerIssuesCommand: { kind: 'shared-to-cmd', from: 'shared', to: 'cmd' },
  commandCausesEvent: { kind: 'cmd-to-evt', from: 'cmd', to: 'evt' },
  eventRefreshesViewModel: { kind: 'evt-to-viewModel', from: 'evt', to: 'viewModel' },
  uiOrProcessorConsumesViewModel: { kind: 'viewModel-to-shared', from: 'viewModel', to: 'shared' },
  eventUpdatesProcessor: { kind: 'evt-to-shared', from: 'evt', to: 'shared' },
};

export function semanticLift(edgeType: EdgeType, originalEdgeId: string): DisplayEdge {
  const mapping = EDGE_LIFT_MAP[edgeType];
  if (!mapping) throw new Error(`Unknown edge type for semantic lift: ${edgeType}`);

  deCounter++;
  return {
    displayEdgeId: `de_${deCounter}`,
    fromNodeKind: mapping.from,
    toNodeKind: mapping.to,
    kind: mapping.kind,
    originalEdgeType: edgeType,
    originalEdgeId,
  };
}

export function resetDeCounter(): void {
  deCounter = 0;
}
