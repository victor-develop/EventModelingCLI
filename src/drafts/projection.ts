import { createHash } from 'node:crypto';
import {
  CommandField,
  CommandSchema,
  Draft,
  DraftOp,
  Edge,
  EventField,
  EventSchema,
  ModelSnapshot,
  Node,
  Proposal,
  ViewModelSchema,
} from '../domain/types';
import type { Workspace } from '../workspace/workspace';

export type ModelEntityKind = 'node' | 'edge' | 'commandSchema' | 'eventSchema' | 'viewModelSchema' | 'proposal';

export interface ModelSnapshotMismatch {
  key: string;
  status: 'missing' | 'extra' | 'changed';
}

export interface SnapshotEntityDiff {
  kind: ModelEntityKind;
  id: string;
  status: 'added' | 'changed' | 'removed';
  before?: unknown;
  after?: unknown;
}

export interface ModelSnapshotDiff {
  nodes: SnapshotEntityDiff[];
  edges: SnapshotEntityDiff[];
  commandSchemas: SnapshotEntityDiff[];
  eventSchemas: SnapshotEntityDiff[];
  viewModelSchemas: SnapshotEntityDiff[];
  proposals: SnapshotEntityDiff[];
}

export function currentModelSnapshot(ws: Workspace): ModelSnapshot {
  return normalizeModelSnapshot({
    nodes: ws.listNodes(),
    edges: ws.listEdges(),
    commandSchemas: ws.listCommandSchemas(),
    eventSchemas: ws.listEventSchemas(),
    viewModelSchemas: ws.listViewModelSchemas(),
    proposals: ws.listProposals(),
  });
}

export function currentModelFingerprint(ws: Workspace): string {
  return modelSnapshotFingerprint(currentModelSnapshot(ws));
}

export function projectDraftSnapshot(baseSnapshot: ModelSnapshot, ops: DraftOp[]): ModelSnapshot {
  const nodes = new Map(baseSnapshot.nodes.map(node => [node.canonicalId, snapshot(node)]));
  const edges = new Map(baseSnapshot.edges.map(edge => [edge.id, snapshot(edge)]));
  const commandSchemas = new Map(baseSnapshot.commandSchemas.map(schema => [schema.commandNodeId, snapshot(schema)]));
  const eventSchemas = new Map(baseSnapshot.eventSchemas.map(schema => [schema.eventNodeId, snapshot(schema)]));
  const viewModelSchemas = new Map(baseSnapshot.viewModelSchemas.map(schema => [schema.viewModelNodeId, snapshot(schema)]));
  const proposals = new Map(baseSnapshot.proposals.map(proposal => [proposal.id, snapshot(proposal)]));

  for (const op of ops) {
    if (op.version !== 2) continue;
    if (op.entityType === 'node') applyMapDraftOp(nodes, op);
    if (op.entityType === 'edge') applyMapDraftOp(edges, op);
    if (op.entityType === 'proposal') applyMapDraftOp(proposals, op);
    if (op.entityType === 'schema') {
      applySchemaDraftOp(op, commandSchemas, eventSchemas, viewModelSchemas);
    }
  }

  return normalizeModelSnapshot({
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    commandSchemas: [...commandSchemas.values()],
    eventSchemas: [...eventSchemas.values()],
    viewModelSchemas: [...viewModelSchemas.values()],
    proposals: [...proposals.values()],
  });
}

export function modelSnapshotForDraftGraph(draft: Draft, graph: 'base' | 'after'): ModelSnapshot {
  if (!draft.baseSnapshot) {
    throw new Error(`Draft "${draft.id}" does not have a base model snapshot`);
  }
  return graph === 'base'
    ? normalizeModelSnapshot(draft.baseSnapshot)
    : projectDraftSnapshot(draft.baseSnapshot, draft.ops);
}

export function normalizeModelSnapshot(modelSnapshot: ModelSnapshot): ModelSnapshot {
  return {
    nodes: modelSnapshot.nodes.map(node => snapshot(node)).sort((a, b) => a.canonicalId.localeCompare(b.canonicalId)),
    edges: modelSnapshot.edges.map(edge => snapshot(edge)).sort((a, b) => a.id.localeCompare(b.id)),
    commandSchemas: modelSnapshot.commandSchemas.map(schema => snapshot(schema)).sort((a, b) => a.commandNodeId.localeCompare(b.commandNodeId)),
    eventSchemas: modelSnapshot.eventSchemas.map(schema => snapshot(schema)).sort((a, b) => a.eventNodeId.localeCompare(b.eventNodeId)),
    viewModelSchemas: modelSnapshot.viewModelSchemas.map(schema => snapshot(schema)).sort((a, b) => a.viewModelNodeId.localeCompare(b.viewModelNodeId)),
    proposals: modelSnapshot.proposals.map(proposal => snapshot(proposal)).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function modelSnapshotFingerprint(modelSnapshot: ModelSnapshot): string {
  const normalized = normalizeModelSnapshot(modelSnapshot);
  return createHash('sha256')
    .update(stableJson(normalized))
    .digest('hex');
}

export function compareModelSnapshots(expected: ModelSnapshot, actual: ModelSnapshot): ModelSnapshotMismatch[] {
  const expectedMap = flattenModelSnapshot(expected);
  const actualMap = flattenModelSnapshot(actual);
  const keys = new Set([...expectedMap.keys(), ...actualMap.keys()]);
  const mismatches: ModelSnapshotMismatch[] = [];
  for (const key of [...keys].sort()) {
    const expectedValue = expectedMap.get(key);
    const actualValue = actualMap.get(key);
    if (expectedValue === undefined) {
      mismatches.push({ key, status: 'extra' });
    } else if (actualValue === undefined) {
      mismatches.push({ key, status: 'missing' });
    } else if (expectedValue !== actualValue) {
      mismatches.push({ key, status: 'changed' });
    }
  }
  return mismatches;
}

export function diffModelSnapshots(baseSnapshot: ModelSnapshot, afterSnapshot: ModelSnapshot): ModelSnapshotDiff {
  const base = normalizeModelSnapshot(baseSnapshot);
  const after = normalizeModelSnapshot(afterSnapshot);
  return {
    nodes: diffEntityList('node', base.nodes, after.nodes, nodeId),
    edges: diffEntityList('edge', base.edges, after.edges, edgeId),
    commandSchemas: diffEntityList('commandSchema', base.commandSchemas, after.commandSchemas, commandSchemaId),
    eventSchemas: diffEntityList('eventSchema', base.eventSchemas, after.eventSchemas, eventSchemaId),
    viewModelSchemas: diffEntityList('viewModelSchema', base.viewModelSchemas, after.viewModelSchemas, viewModelSchemaId),
    proposals: diffEntityList('proposal', base.proposals, after.proposals, proposalId),
  };
}

export function mergeBaseAndAfterForCompare(baseSnapshot: ModelSnapshot, afterSnapshot: ModelSnapshot): ModelSnapshot {
  const base = normalizeModelSnapshot(baseSnapshot);
  const after = normalizeModelSnapshot(afterSnapshot);
  return normalizeModelSnapshot({
    nodes: mergeEntityList(base.nodes, after.nodes, nodeId),
    edges: mergeEntityList(base.edges, after.edges, edgeId),
    commandSchemas: mergeEntityList(base.commandSchemas, after.commandSchemas, commandSchemaId),
    eventSchemas: mergeEntityList(base.eventSchemas, after.eventSchemas, eventSchemaId),
    viewModelSchemas: mergeEntityList(base.viewModelSchemas, after.viewModelSchemas, viewModelSchemaId),
    proposals: mergeEntityList(base.proposals, after.proposals, proposalId),
  });
}

export function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function applyMapDraftOp<T>(map: Map<string, T>, op: DraftOp): void {
  if (op.after === null || op.after === undefined) {
    map.delete(op.entityId);
    return;
  }
  map.set(op.entityId, snapshot(op.after) as T);
}

function applySchemaDraftOp(
  op: DraftOp,
  commandSchemas: Map<string, CommandSchema>,
  eventSchemas: Map<string, EventSchema>,
  viewModelSchemas: Map<string, ViewModelSchema>,
): void {
  const target = op.target;
  if (!target?.schemaKind || !target.ownerNodeId) return;
  const schemaMap = target.schemaKind === 'command'
    ? commandSchemas
    : target.schemaKind === 'event'
      ? eventSchemas
      : viewModelSchemas;

  if (!target.fieldId) {
    if (op.after === null || op.after === undefined) {
      schemaMap.delete(target.ownerNodeId);
    } else {
      schemaMap.set(target.ownerNodeId, snapshot(op.after) as CommandSchema & EventSchema & ViewModelSchema);
    }
    return;
  }

  const schema = schemaMap.get(target.ownerNodeId) ?? emptySchemaForKind(target.schemaKind, target.ownerNodeId);
  if (op.after === null || op.after === undefined) {
    replaceSchemaFields(schema, target.schemaKind, schemaFields(schema, target.schemaKind).filter(field => field.fieldId !== target.fieldId));
  } else {
    const fields = schemaFields(schema, target.schemaKind);
    const fieldIndex = fields.findIndex(field => field.fieldId === target.fieldId);
    const nextField = snapshot(op.after) as CommandField & EventField & ViewModelSchema['fields'][number];
    if (fieldIndex === -1) {
      fields.push(nextField);
    } else {
      fields[fieldIndex] = nextField;
    }
    replaceSchemaFields(schema, target.schemaKind, fields);
  }
  schemaMap.set(target.ownerNodeId, schema as CommandSchema & EventSchema & ViewModelSchema);
}

function emptySchemaForKind(schemaKind: 'command' | 'event' | 'viewModel', ownerNodeId: string): CommandSchema | EventSchema | ViewModelSchema {
  if (schemaKind === 'command') return { commandNodeId: ownerNodeId, version: 1, input: { fields: [] } };
  if (schemaKind === 'event') return { eventNodeId: ownerNodeId, version: 1, payload: { fields: [] } };
  return { viewModelNodeId: ownerNodeId, fields: [] };
}

function schemaFields(
  schema: CommandSchema | EventSchema | ViewModelSchema,
  schemaKind: 'command' | 'event' | 'viewModel',
): Array<CommandField | EventField | ViewModelSchema['fields'][number]> {
  if (schemaKind === 'command') return [...(schema as CommandSchema).input.fields];
  if (schemaKind === 'event') return [...(schema as EventSchema).payload.fields];
  return [...(schema as ViewModelSchema).fields];
}

function replaceSchemaFields(
  schema: CommandSchema | EventSchema | ViewModelSchema,
  schemaKind: 'command' | 'event' | 'viewModel',
  fields: Array<CommandField | EventField | ViewModelSchema['fields'][number]>,
): void {
  if (schemaKind === 'command') {
    (schema as CommandSchema).input.fields = fields as CommandField[];
  } else if (schemaKind === 'event') {
    (schema as EventSchema).payload.fields = fields as EventField[];
  } else {
    (schema as ViewModelSchema).fields = fields as ViewModelSchema['fields'];
  }
}

function flattenModelSnapshot(modelSnapshot: ModelSnapshot): Map<string, string> {
  const normalized = normalizeModelSnapshot(modelSnapshot);
  const result = new Map<string, string>();
  for (const node of normalized.nodes) result.set(`node:${node.canonicalId}`, stableJson(node));
  for (const edge of normalized.edges) result.set(`edge:${edge.id}`, stableJson(edge));
  for (const schema of normalized.commandSchemas) result.set(`commandSchema:${schema.commandNodeId}`, stableJson(schema));
  for (const schema of normalized.eventSchemas) result.set(`eventSchema:${schema.eventNodeId}`, stableJson(schema));
  for (const schema of normalized.viewModelSchemas) result.set(`viewModelSchema:${schema.viewModelNodeId}`, stableJson(schema));
  for (const proposal of normalized.proposals) result.set(`proposal:${proposal.id}`, stableJson(proposal));
  return result;
}

function diffEntityList<T>(
  kind: ModelEntityKind,
  baseItems: T[],
  afterItems: T[],
  idFor: (item: T) => string,
): SnapshotEntityDiff[] {
  const baseById = new Map(baseItems.map(item => [idFor(item), item]));
  const afterById = new Map(afterItems.map(item => [idFor(item), item]));
  const ids = new Set([...baseById.keys(), ...afterById.keys()]);
  const diffs: SnapshotEntityDiff[] = [];

  for (const id of [...ids].sort()) {
    const before = baseById.get(id);
    const after = afterById.get(id);
    if (before === undefined && after !== undefined) {
      diffs.push({ kind, id, status: 'added', after: snapshot(after) });
    } else if (before !== undefined && after === undefined) {
      diffs.push({ kind, id, status: 'removed', before: snapshot(before) });
    } else if (before !== undefined && after !== undefined && stableJson(before) !== stableJson(after)) {
      diffs.push({ kind, id, status: 'changed', before: snapshot(before), after: snapshot(after) });
    }
  }

  return diffs;
}

function mergeEntityList<T>(baseItems: T[], afterItems: T[], idFor: (item: T) => string): T[] {
  const merged = new Map(baseItems.map(item => [idFor(item), snapshot(item)]));
  for (const item of afterItems) {
    merged.set(idFor(item), snapshot(item));
  }
  return [...merged.values()];
}

function nodeId(node: Node): string {
  return node.canonicalId;
}

function edgeId(edge: Edge): string {
  return edge.id;
}

function commandSchemaId(schema: CommandSchema): string {
  return schema.commandNodeId;
}

function eventSchemaId(schema: EventSchema): string {
  return schema.eventNodeId;
}

function viewModelSchemaId(schema: ViewModelSchema): string {
  return schema.viewModelNodeId;
}

function proposalId(proposal: Proposal): string {
  return proposal.id;
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = sortDeep(record[key]);
    return acc;
  }, {});
}
