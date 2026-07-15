import { EdgeType } from '../domain/types';
import { DisplayEdge, DisplayEdgeKind, DisplayNodeKind } from './types';

let deCounter = 0;

const EDGE_LIFT_MAP: Partial<Record<EdgeType, { kind: DisplayEdgeKind; from: DisplayNodeKind; to: DisplayNodeKind }>> = {
  roleIssuesCommand: { kind: 'shared-to-cmd', from: 'shared', to: 'cmd' },
  processorOrTriggerIssuesCommand: { kind: 'shared-to-cmd', from: 'shared', to: 'cmd' },
  commandCausesEvent: { kind: 'cmd-to-evt', from: 'cmd', to: 'evt' },
  eventRefreshesViewModel: { kind: 'evt-to-viewModel', from: 'evt', to: 'viewModel' },
  viewModelConsumedByUiOrProcessor: { kind: 'viewModel-to-shared', from: 'viewModel', to: 'shared' },
  eventUpdatesProcessor: { kind: 'evt-to-shared', from: 'evt', to: 'shared' },
};

export function semanticLift(edgeType: EdgeType, originalEdgeId: string, displayEdgeId?: string): DisplayEdge {
  const mapping = EDGE_LIFT_MAP[edgeType];
  if (!mapping) throw new Error(`Unknown edge type for semantic lift: ${edgeType}`);

  deCounter++;
  return {
    displayEdgeId: displayEdgeId ?? `de_${deCounter}`,
    fromNodeKind: mapping.from,
    toNodeKind: mapping.to,
    kind: mapping.kind,
    originalEdgeType: edgeType,
    originalEdgeId,
  };
}

export function semanticLiftOverride(args: {
  kind: DisplayEdgeKind;
  fromNodeKind: DisplayNodeKind;
  toNodeKind: DisplayNodeKind;
  originalEdgeType: string;
  originalEdgeId: string;
  displayEdgeId?: string;
}): DisplayEdge {
  deCounter++;
  return {
    displayEdgeId: args.displayEdgeId ?? `de_${deCounter}`,
    fromNodeKind: args.fromNodeKind,
    toNodeKind: args.toNodeKind,
    kind: args.kind,
    originalEdgeType: args.originalEdgeType as EdgeType,
    originalEdgeId: args.originalEdgeId,
  };
}

export function resetDeCounter(): void {
  deCounter = 0;
}
