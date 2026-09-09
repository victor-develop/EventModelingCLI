import type { Edge, ModelSnapshot, Node } from '../domain/types';
import type {
  DiffMarker,
  DiffOverlay,
  DiffStatus,
  ViewerDiffFieldChange,
  ViewerDiffChange,
  VisualizationSnapshot,
} from '../viewer-contract/types';
import { redactDiffValue } from '../viewer-contract/redaction';
import { diffModelSnapshots, stableJson, type SnapshotEntityDiff } from './projection';

export function buildDiffOverlayForSnapshot(args: {
  baseSnapshot: ModelSnapshot;
  afterSnapshot: ModelSnapshot;
  snapshot: VisualizationSnapshot;
}): DiffOverlay {
  const changes = buildViewerDiffChanges(args.baseSnapshot, args.afterSnapshot);
  const nodesByCanonicalId: Record<string, DiffMarker> = {};
  const edgesById: Record<string, DiffMarker> = {};

  for (const change of changes) {
    if ((change.entityType === 'node' || change.entityType === 'schema') && change.targetNodeId) {
      mergeMarker(nodesByCanonicalId, change.targetNodeId, change.status, change.id);
    }
    if (change.entityType === 'edge' && change.targetEdgeId) {
      mergeMarker(edgesById, change.targetEdgeId, change.status, change.id);
    }
  }

  const visibleNodeIds = new Set([
    ...Object.keys(args.snapshot.domainNodes),
    ...args.snapshot.occurrences.map(occurrence => occurrence.canonicalNodeId),
  ]);
  const visibleEdgeIds = new Set([
    ...Object.keys(args.snapshot.domainEdges),
    ...args.snapshot.renderedEdges
      .map(edge => edge.meta?.originalEdgeId)
      .filter((id): id is string => typeof id === 'string'),
  ]);
  const visibleChanges: ViewerDiffChange[] = [];
  const hiddenChanges: ViewerDiffChange[] = [];

  for (const change of changes) {
    if (isChangeVisible(change, visibleNodeIds, visibleEdgeIds)) {
      visibleChanges.push(change);
    } else {
      hiddenChanges.push(change);
    }
  }

  return {
    nodesByCanonicalId,
    edgesById,
    visibleChanges,
    hiddenChanges,
    summary: summarizeChanges(changes),
  };
}

function isChangeVisible(
  change: ViewerDiffChange,
  visibleNodeIds: Set<string>,
  visibleEdgeIds: Set<string>,
): boolean {
  if (change.entityType === 'edge') {
    return Boolean(change.targetEdgeId && visibleEdgeIds.has(change.targetEdgeId));
  }
  if (change.entityType === 'proposal') return false;
  return Boolean(change.targetNodeId && visibleNodeIds.has(change.targetNodeId));
}

export function buildViewerDiffChanges(
  baseSnapshot: ModelSnapshot,
  afterSnapshot: ModelSnapshot,
): ViewerDiffChange[] {
  const diff = diffModelSnapshots(baseSnapshot, afterSnapshot);
  const baseNodes = new Map(baseSnapshot.nodes.map(node => [node.canonicalId, node]));
  const afterNodes = new Map(afterSnapshot.nodes.map(node => [node.canonicalId, node]));
  const baseEdges = new Map(baseSnapshot.edges.map(edge => [edge.id, edge]));
  const afterEdges = new Map(afterSnapshot.edges.map(edge => [edge.id, edge]));

  return [
    ...diff.nodes.map(change => nodeChange(change, baseNodes, afterNodes)),
    ...diff.edges.map(change => edgeChange(change, baseEdges, afterEdges)),
    ...diff.commandSchemas.map(change => schemaChange(change, 'command', 'command')),
    ...diff.eventSchemas.map(change => schemaChange(change, 'event', 'event')),
    ...diff.viewModelSchemas.map(change => schemaChange(change, 'viewModel', 'view model')),
    ...diff.proposals.map(change => proposalChange(change)),
  ].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

function nodeChange(
  change: SnapshotEntityDiff,
  baseNodes: Map<string, Node>,
  afterNodes: Map<string, Node>,
): ViewerDiffChange {
  const node = afterNodes.get(change.id) ?? baseNodes.get(change.id);
  return withDiffDetails(change, {
    id: `node:${change.id}`,
    entityType: 'node',
    status: change.status,
    title: `${node?.displayName ?? change.id} node ${change.status}`,
    targetNodeId: change.id,
  });
}

function edgeChange(
  change: SnapshotEntityDiff,
  baseEdges: Map<string, Edge>,
  afterEdges: Map<string, Edge>,
): ViewerDiffChange {
  const edge = afterEdges.get(change.id) ?? baseEdges.get(change.id);
  return withDiffDetails(change, {
    id: `edge:${change.id}`,
    entityType: 'edge',
    status: change.status,
    title: `${edge?.type ?? 'edge'} ${change.id} ${change.status}`,
    targetNodeId: edge?.fromNodeId,
    targetEdgeId: change.id,
  });
}

function schemaChange(change: SnapshotEntityDiff, schemaKind: string, schemaLabel: string): ViewerDiffChange {
  return withDiffDetails(change, {
    id: `schema:${schemaKind}:${change.id}`,
    entityType: 'schema',
    status: change.status,
    title: `${schemaLabel} schema ${change.id} ${change.status}`,
    targetNodeId: change.id,
  });
}

function proposalChange(change: SnapshotEntityDiff): ViewerDiffChange {
  return withDiffDetails(change, {
    id: `proposal:${change.id}`,
    entityType: 'proposal',
    status: change.status,
    title: `proposal ${change.id} ${change.status}`,
  });
}

function withDiffDetails(
  change: SnapshotEntityDiff,
  viewerChange: ViewerDiffChange,
): ViewerDiffChange {
  const fieldChanges = change.status === 'changed'
    ? diffValueFields(change.before, change.after).map(redactFieldChange)
    : [];
  return {
    ...viewerChange,
    before: redactDiffValue(change.before),
    after: redactDiffValue(change.after),
    changedFields: fieldChanges.map(field => field.path),
    fieldChanges,
  };
}

function redactFieldChange(change: ViewerDiffFieldChange): ViewerDiffFieldChange {
  return {
    ...change,
    before: change.before === undefined ? undefined : redactDiffValue(change.before, change.path),
    after: change.after === undefined ? undefined : redactDiffValue(change.after, change.path),
  };
}

function mergeMarker(
  map: Record<string, DiffMarker>,
  key: string,
  status: DiffStatus,
  changeId: string,
): void {
  const existing = map[key];
  if (!existing) {
    map[key] = { status, changeIds: [changeId] };
    return;
  }
  if (!existing.changeIds.includes(changeId)) {
    existing.changeIds.push(changeId);
  }
  existing.status = higherPriorityStatus(existing.status, status);
}

function higherPriorityStatus(left: DiffStatus, right: DiffStatus): DiffStatus {
  const priority: Record<DiffStatus, number> = {
    removed: 3,
    added: 2,
    changed: 1,
  };
  return priority[right] > priority[left] ? right : left;
}

function summarizeChanges(changes: ViewerDiffChange[]): Record<string, number> {
  const summary: Record<string, number> = {
    totalChanges: changes.length,
    added: 0,
    changed: 0,
    removed: 0,
  };
  for (const change of changes) {
    summary[change.status] = (summary[change.status] ?? 0) + 1;
  }
  return summary;
}

function diffValueFields(before: unknown, after: unknown, path = ''): ViewerDiffFieldChange[] {
  if (stableJson(before) === stableJson(after)) return [];

  if (isPlainRecord(before) && isPlainRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].sort().flatMap((key) => {
      const nextPath = appendPath(path, key);
      const beforeHasKey = Object.prototype.hasOwnProperty.call(before, key);
      const afterHasKey = Object.prototype.hasOwnProperty.call(after, key);
      if (!beforeHasKey) {
        return collectValueFields(after[key], nextPath, 'added');
      }
      if (!afterHasKey) {
        return collectValueFields(before[key], nextPath, 'removed');
      }
      return diffValueFields(before[key], after[key], nextPath);
    });
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);
    const changes: ViewerDiffFieldChange[] = [];
    for (let index = 0; index < maxLength; index += 1) {
      const nextPath = `${path}[${index}]`;
      if (index >= before.length) {
        changes.push({ path: nextPath, status: 'added', after: after[index] });
      } else if (index >= after.length) {
        changes.push({ path: nextPath, status: 'removed', before: before[index] });
      } else {
        changes.push(...diffValueFields(before[index], after[index], nextPath));
      }
    }
    return changes;
  }

  return [{
    path: path || 'value',
    status: 'changed',
    before,
    after,
  }];
}

function collectValueFields(
  value: unknown,
  path: string,
  status: Extract<DiffStatus, 'added' | 'removed'>,
): ViewerDiffFieldChange[] {
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) {
      return [fieldChangeForValue(path, status, value)];
    }
    return keys.flatMap(key => collectValueFields(value[key], appendPath(path, key), status));
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [fieldChangeForValue(path, status, value)];
    }
    return value.flatMap((item, index) => collectValueFields(item, `${path}[${index}]`, status));
  }

  return [fieldChangeForValue(path, status, value)];
}

function fieldChangeForValue(
  path: string,
  status: Extract<DiffStatus, 'added' | 'removed'>,
  value: unknown,
): ViewerDiffFieldChange {
  return status === 'added'
    ? { path, status, after: value }
    : { path, status, before: value };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendPath(base: string, key: string): string {
  return base ? `${base}.${key}` : key;
}
