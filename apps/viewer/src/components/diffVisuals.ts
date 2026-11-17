import type { Node as DomainNode } from 'event-modeling-spec-cli/domain/types';
import type { ViewerDiffChange } from 'event-modeling-spec-cli/viewer-contract/types';
import { redactDiffValue } from 'event-modeling-spec-cli/viewer-contract/redaction';

type DomainNodes = Record<string, DomainNode | undefined>;
type DiffPayload = Record<string, unknown>;

export interface VisualDiffNode {
  id: string;
  label: string;
  kind?: string;
}

export interface VisualEdgeVariant {
  label?: string;
  edgeType: string;
  relation: string;
  from: VisualDiffNode;
  to: VisualDiffNode;
  via?: VisualDiffNode;
  fieldRefs: string[];
}

export interface VisualNodeVariant {
  label?: string;
  node: VisualDiffNode;
}

export type DiffVisual =
  | {
    kind: 'edge';
    status: ViewerDiffChange['status'];
    variants: VisualEdgeVariant[];
  }
  | {
    kind: 'node';
    status: ViewerDiffChange['status'];
    variants: VisualNodeVariant[];
  };

const EDGE_RELATION_LABELS: Record<string, string> = {
  parentOf: 'contains',
  storyOwnsCommand: 'owns command',
  roleIssuesCommand: 'issues command',
  processorOrTriggerIssuesCommand: 'issues command',
  commandCausesEvent: 'causes event',
  eventRefreshesViewModel: 'refreshes view model',
  eventUpdatesProcessor: 'updates processor',
  viewModelConsumedByUiOrProcessor: 'consumed by',
};

export function buildDiffVisual(
  change: ViewerDiffChange,
  domainNodes: DomainNodes,
): DiffVisual | null {
  if (change.entityType === 'edge') {
    return edgeVisual(change, domainNodes);
  }
  if (change.entityType === 'node') {
    return nodeVisual(change, domainNodes);
  }
  return null;
}

function edgeVisual(change: ViewerDiffChange, domainNodes: DomainNodes): DiffVisual | null {
  const parsed: Array<{ label?: string; edge: VisualEdgeVariant }> = [];
  for (const { label, payload } of changePayloads(change)) {
    const edge = parseEdge(payload, domainNodes);
    if (edge) parsed.push({ label, edge });
  }

  if (parsed.length === 0) return null;

  const variants = sameEdgeShape(parsed)
    ? [{ ...parsed[parsed.length - 1].edge, label: undefined }]
    : parsed.map(({ label, edge }) => ({ ...edge, label }));

  return {
    kind: 'edge',
    status: change.status,
    variants,
  };
}

function nodeVisual(change: ViewerDiffChange, domainNodes: DomainNodes): DiffVisual | null {
  const variants: VisualNodeVariant[] = [];
  for (const { label, payload } of changePayloads(change)) {
    const node = parseNode(payload, domainNodes);
    if (node) variants.push({ label, node });
  }

  if (variants.length === 0) return null;
  return {
    kind: 'node',
    status: change.status,
    variants,
  };
}

function changePayloads(change: ViewerDiffChange): Array<{ label?: string; payload: unknown }> {
  if (change.status === 'added') {
    return change.after === undefined ? [] : [{ payload: change.after }];
  }
  if (change.status === 'removed') {
    return change.before === undefined ? [] : [{ payload: change.before }];
  }

  const payloads: Array<{ label?: string; payload: unknown }> = [];
  if (change.before !== undefined) payloads.push({ label: 'Before', payload: change.before });
  if (change.after !== undefined) payloads.push({ label: 'After', payload: change.after });
  return payloads;
}

function parseEdge(payload: unknown, domainNodes: DomainNodes): VisualEdgeVariant | null {
  const edge = asPayload(payload);
  const edgeType = stringValue(edge.type);
  const fromNodeId = stringValue(edge.fromNodeId);
  const toNodeId = stringValue(edge.toNodeId);
  if (!fromNodeId || !toNodeId) return null;

  const viaNodeId = stringValue(edge.viaNodeId);
  return {
    edgeType: edgeType ?? 'edge',
    relation: edgeType ? EDGE_RELATION_LABELS[edgeType] ?? readableEdgeType(edgeType) : 'connects to',
    from: visualNode(fromNodeId, domainNodes),
    to: visualNode(toNodeId, domainNodes),
    via: viaNodeId ? visualNode(viaNodeId, domainNodes) : undefined,
    fieldRefs: fieldReferences(edge.meta),
  };
}

function parseNode(payload: unknown, domainNodes: DomainNodes): VisualDiffNode | null {
  const node = asPayload(payload);
  const id = stringValue(node.canonicalId) ?? stringValue(node.id);
  if (!id) return null;
  const snapshotNode = findDomainNode(domainNodes, id);
  return {
    id,
    label: stringValue(node.displayName) ?? snapshotNode?.displayName ?? id,
    kind: stringValue(node.kind) ?? snapshotNode?.kind,
  };
}

function visualNode(nodeId: string, domainNodes: DomainNodes): VisualDiffNode {
  const node = findDomainNode(domainNodes, nodeId);
  return {
    id: nodeId,
    label: node?.displayName ?? nodeId,
    kind: node?.kind,
  };
}

function findDomainNode(domainNodes: DomainNodes, nodeId: string): DomainNode | undefined {
  const direct = domainNodes[nodeId];
  if (direct) return direct;
  return Object.values(domainNodes).find(node => node?.canonicalId === nodeId);
}

function fieldReferences(meta: unknown): string[] {
  const metaPayload = asPayload(meta);
  if (!Array.isArray(metaPayload.fieldRefs)) return [];
  return metaPayload.fieldRefs.flatMap((value, index) => {
    const redacted = redactDiffValue(value, `meta.fieldRefs[${index}]`);
    return typeof redacted === 'string' ? [redacted] : [];
  });
}

function sameEdgeShape(variants: Array<{ label?: string; edge: VisualEdgeVariant }>): boolean {
  if (variants.length < 2) return false;
  const [first, ...rest] = variants;
  return rest.every(({ edge }) => (
    edge.edgeType === first.edge.edgeType
    && edge.from.id === first.edge.from.id
    && edge.to.id === first.edge.to.id
    && edge.via?.id === first.edge.via?.id
  ));
}

function readableEdgeType(edgeType: string): string {
  return edgeType
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

function asPayload(value: unknown): DiffPayload {
  const redacted = redactDiffValue(value);
  return redacted !== null && typeof redacted === 'object' && !Array.isArray(redacted)
    ? redacted as DiffPayload
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
