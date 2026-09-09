import { Draft, DraftOp } from '../domain/types';

export interface NormalizedDraftChange {
  action: string;
  entityType: DraftOp['entityType'];
  entityId: string;
  command?: string;
  target?: DraftOp['target'];
  before?: unknown;
  after?: unknown;
  legacy: boolean;
}

export interface SemanticDiff {
  summary: Record<string, number>;
  changes: NormalizedDraftChange[];
  legacyOps: number;
  nodesAdded: string[];
  nodesUpdated: string[];
  nodesRemoved: string[];
  edgesAdded: string[];
  edgesUpdated: string[];
  edgesRemoved: string[];
  schemasAdded: string[];
  schemasUpdated: string[];
  schemasRemoved: string[];
  fieldsAdded: string[];
  fieldsUpdated: string[];
  fieldsRemoved: string[];
  proposalsAdded: string[];
  proposalsUpdated: string[];
  proposalsRemoved: string[];
}

export function buildSemanticDiff(draft: Draft): SemanticDiff {
  const changes = draft.ops.map(normalizeDraftOp);
  const diff: SemanticDiff = {
    summary: {},
    changes,
    legacyOps: changes.filter(c => c.legacy).length,
    nodesAdded: idsFor(changes, 'node', 'add'),
    nodesUpdated: idsFor(changes, 'node', 'edit'),
    nodesRemoved: idsFor(changes, 'node', 'remove'),
    edgesAdded: idsFor(changes, 'edge', 'add'),
    edgesUpdated: idsFor(changes, 'edge', 'edit'),
    edgesRemoved: idsFor(changes, 'edge', 'remove'),
    schemasAdded: schemaIdsFor(changes, 'add'),
    schemasUpdated: schemaIdsFor(changes, 'edit'),
    schemasRemoved: schemaIdsFor(changes, 'remove'),
    fieldsAdded: fieldIdsFor(changes, 'add'),
    fieldsUpdated: fieldIdsFor(changes, 'edit'),
    fieldsRemoved: fieldIdsFor(changes, 'remove'),
    proposalsAdded: idsFor(changes, 'proposal', 'add'),
    proposalsUpdated: idsFor(changes, 'proposal', 'edit'),
    proposalsRemoved: idsFor(changes, 'proposal', 'remove'),
  };
  diff.summary = {
    nodesAdded: diff.nodesAdded.length,
    nodesUpdated: diff.nodesUpdated.length,
    nodesRemoved: diff.nodesRemoved.length,
    edgesAdded: diff.edgesAdded.length,
    edgesUpdated: diff.edgesUpdated.length,
    edgesRemoved: diff.edgesRemoved.length,
    schemasAdded: diff.schemasAdded.length,
    schemasUpdated: diff.schemasUpdated.length,
    schemasRemoved: diff.schemasRemoved.length,
    fieldsAdded: diff.fieldsAdded.length,
    fieldsUpdated: diff.fieldsUpdated.length,
    fieldsRemoved: diff.fieldsRemoved.length,
    proposalsAdded: diff.proposalsAdded.length,
    proposalsUpdated: diff.proposalsUpdated.length,
    proposalsRemoved: diff.proposalsRemoved.length,
    totalChanges: changes.length,
    legacyOps: diff.legacyOps,
  };
  return diff;
}

export function normalizeDraftOp(op: DraftOp): NormalizedDraftChange {
  const action = op.action ?? normalizeLegacyAction(op.op);
  return {
    action,
    entityType: op.entityType,
    entityId: op.entityId,
    command: op.command,
    target: op.target,
    before: op.before,
    after: op.after,
    legacy: op.version !== 2,
  };
}

function normalizeLegacyAction(op: string): string {
  if (op === 'update') return 'edit';
  if (op === 'rm' || op === 'delete') return 'remove';
  return op;
}

function idsFor(changes: NormalizedDraftChange[], entityType: DraftOp['entityType'], action: string): string[] {
  return changes
    .filter(change => change.entityType === entityType && change.action === action)
    .map(change => change.entityId);
}

function schemaIdsFor(changes: NormalizedDraftChange[], action: string): string[] {
  return changes
    .filter(change => change.entityType === 'schema' && change.action === action && !change.target?.fieldId)
    .map(change => change.entityId);
}

function fieldIdsFor(changes: NormalizedDraftChange[], action: string): string[] {
  return changes
    .filter(change => change.entityType === 'schema' && change.action === action && Boolean(change.target?.fieldId))
    .map(change => change.entityId);
}
