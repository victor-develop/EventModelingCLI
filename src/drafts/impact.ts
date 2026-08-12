import type {
  CommandField,
  CommandSchema,
  Draft,
  Edge,
  EdgeType,
  EventField,
  EventSchema,
  ModelSnapshot,
  Node,
  ViewModelField,
  ViewModelSchema,
} from '../domain/types';
import { isEventModelingEdgeType, toEventModelingEdges } from '../domain/event-modeling-edges';
import {
  diffModelSnapshots,
  modelSnapshotForDraftGraph,
  stableJson,
} from './projection';

type SchemaField = CommandField | EventField | ViewModelField;

export type ImpactGraph = 'base' | 'after';
export type ImpactStatus = 'added' | 'changed' | 'removed';
export type ImpactSchemaKind = 'command' | 'event' | 'viewModel';

export interface DraftImpactSeed {
  id: string;
  entityType: 'node' | 'edge' | 'schema' | 'field';
  status: ImpactStatus;
  graph: ImpactGraph | 'both';
  nodeId?: string;
  edgeId?: string;
  schemaKind?: ImpactSchemaKind;
  fieldId?: string;
  changedFields?: string[];
}

export interface DraftImpactPath {
  graph: ImpactGraph;
  direction: 'upstream' | 'downstream' | 'related';
  path: string[];
  depth: number;
}

export interface DraftImpactNode {
  canonicalId: string;
  kind: Node['kind'];
  reasons: string[];
  changeIds: string[];
  traversalDepth: number;
  paths: DraftImpactPath[];
}

export interface DraftImpactNodeGroups {
  stories: DraftImpactNode[];
  roles: DraftImpactNode[];
  uiSurfaces: DraftImpactNode[];
  triggers: DraftImpactNode[];
  processors: DraftImpactNode[];
  commands: DraftImpactNode[];
  events: DraftImpactNode[];
  viewModels: DraftImpactNode[];
  other: DraftImpactNode[];
}

export interface DraftImpactEdge {
  id: string;
  types: EdgeType[];
  graphs: ImpactGraph[];
  reasons: string[];
  changeIds: string[];
  paths: DraftImpactPath[];
}

export interface DraftSchemaImpact {
  id: string;
  relationship:
    | 'commandFieldToIssuer'
    | 'eventFieldToViewModelField'
    | 'viewModelFieldToConsumer';
  source: { schemaKind: ImpactSchemaKind; nodeId: string; fieldId: string };
  target: { nodeId: string; fieldId?: string; schemaKind?: ImpactSchemaKind };
  certainty: 'explicit' | 'candidate';
  graphs: ImpactGraph[];
  reasons: string[];
  changeIds: string[];
}

export interface DraftCompatibilityWarning {
  id: string;
  code: string;
  severity: 'warning';
  message: string;
  schemaKind: ImpactSchemaKind;
  nodeId: string;
  fieldId: string;
  changeId: string;
  affectedNodeIds: string[];
}

export interface DraftImpactAnalysis {
  draftId: string;
  baseRevisionId: string;
  seeds: DraftImpactSeed[];
  affectedNodes: DraftImpactNodeGroups;
  affectedEdges: DraftImpactEdge[];
  schemaImpacts: DraftSchemaImpact[];
  compatibilityWarnings: DraftCompatibilityWarning[];
  summary: Record<string, number>;
  warnings: string[];
}

interface SchemaFieldChange {
  schemaKind: ImpactSchemaKind;
  nodeId: string;
  fieldId: string;
  status: ImpactStatus;
  before: SchemaField | null;
  after: SchemaField | null;
  changedFields: string[];
}

interface GraphConnection {
  edge: Edge;
  fromNodeId: string;
  toNodeId: string;
}

interface ImpactGraphView {
  name: ImpactGraph;
  nodes: Map<string, Node>;
  aliases: Map<string, string>;
  edges: Map<string, Edge>;
  outgoing: Map<string, GraphConnection[]>;
  incoming: Map<string, GraphConnection[]>;
}

interface MutableImpactNode {
  canonicalId: string;
  kind: Node['kind'];
  reasons: Set<string>;
  changeIds: Set<string>;
  traversalDepth: number;
  paths: Map<string, DraftImpactPath>;
}

interface MutableImpactEdge {
  id: string;
  types: Set<EdgeType>;
  graphs: Set<ImpactGraph>;
  reasons: Set<string>;
  changeIds: Set<string>;
  paths: Map<string, DraftImpactPath>;
}

interface MutableSchemaImpact {
  id: string;
  relationship: DraftSchemaImpact['relationship'];
  source: DraftSchemaImpact['source'];
  target: DraftSchemaImpact['target'];
  certainty: DraftSchemaImpact['certainty'];
  graphs: Set<ImpactGraph>;
  reasons: Set<string>;
  changeIds: Set<string>;
}

/**
 * Compute the draft-wide semantic impact from the authoritative base/after
 * snapshots. This intentionally does not inspect source code: it is the
 * reusable model-side analysis consumed by CLI, HTTP, and future agents.
 */
export function buildDraftImpactAnalysis(draft: Draft): DraftImpactAnalysis {
  if (!draft.baseSnapshot) {
    throw new Error(`Draft "${draft.id}" does not have a base model snapshot`);
  }

  const baseSnapshot = modelSnapshotForDraftGraph(draft, 'base');
  const afterSnapshot = modelSnapshotForDraftGraph(draft, 'after');
  const snapshotDiff = diffModelSnapshots(baseSnapshot, afterSnapshot);
  const schemaFieldChanges = collectSchemaFieldChanges(snapshotDiff);
  const seeds = collectSeeds(snapshotDiff, schemaFieldChanges);
  const views: Record<ImpactGraph, ImpactGraphView> = {
    base: buildImpactGraph('base', baseSnapshot),
    after: buildImpactGraph('after', afterSnapshot),
  };

  const nodes = new Map<string, MutableImpactNode>();
  const edges = new Map<string, MutableImpactEdge>();
  const schemaImpacts = new Map<string, MutableSchemaImpact>();
  const warnings = new Set<string>();

  for (const seed of seeds) {
    for (const graphName of graphsForSeed(seed)) {
      const graph = views[graphName];
      if (seed.entityType === 'edge' && seed.edgeId) {
        const edge = graph.edges.get(seed.edgeId);
        if (!edge) continue;
        const endpointIds = edgeEndpoints(graph, edge);
        const edgePath = endpointIds.length >= 2
          ? [endpointIds[0]!, `edge:${edge.id}`, endpointIds[1]!]
          : [`edge:${edge.id}`];
        addAffectedEdge(edges, edge, graphName, seed, `seed ${seed.status} edge`, {
          graph: graphName,
          direction: 'related',
          path: edgePath,
          depth: 1,
        });
        for (const endpointId of endpointIds) {
          traverseFromSeed({ graph, startNodeId: endpointId, seed, nodes, edges, reason: `endpoint of ${seed.id}` });
        }
        continue;
      }

      if (seed.nodeId) {
        const startNodeId = canonicalNodeId(graph, seed.nodeId) ?? seed.nodeId;
        traverseFromSeed({
          graph,
          startNodeId,
          seed,
          nodes,
          edges,
          reason: `seed ${seed.entityType} ${seed.status}`,
        });
      }
    }
  }

  const schemaTargets = new Map<string, Set<string>>();
  for (const fieldChange of schemaFieldChanges) {
    const seed = fieldSeedFor(fieldChange);
    if (!seed) continue;
    const graphNames = graphsForStatus(fieldChange.status);

    if (fieldChange.schemaKind === 'command') {
      for (const graphName of graphNames) {
        addCommandIssuerImpacts({
          graph: views[graphName],
          fieldChange,
          seed,
          schemaImpacts,
          nodes,
          schemaTargets,
        });
      }
    }

    if (fieldChange.schemaKind === 'event') {
      for (const graphName of graphNames) {
        addEventFieldImpacts({
          graph: views[graphName],
          snapshot: graphName === 'base' ? baseSnapshot : afterSnapshot,
          fieldChange,
          seed,
          schemaImpacts,
          nodes,
          schemaTargets,
        });
      }
    }

    if (fieldChange.schemaKind === 'viewModel') {
      for (const graphName of graphNames) {
        addViewModelFieldConsumerImpacts({
          graph: views[graphName],
          fieldChange,
          seed,
          schemaImpacts,
          nodes,
          schemaTargets,
        });
      }
    }
  }

  const compatibilityWarnings = collectCompatibilityWarnings(schemaFieldChanges, schemaTargets, warnings);

  return {
    draftId: draft.id,
    baseRevisionId: draft.baseRevisionId,
    seeds,
    affectedNodes: groupAffectedNodes(nodes),
    affectedEdges: [...edges.values()]
      .map(finalizeAffectedEdge)
      .sort((left, right) => left.id.localeCompare(right.id)),
    schemaImpacts: [...schemaImpacts.values()]
      .map(finalizeSchemaImpact)
      .sort((left, right) => left.id.localeCompare(right.id)),
    compatibilityWarnings,
    summary: {
      seedCount: seeds.length,
      affectedNodeCount: nodes.size,
      affectedEdgeCount: edges.size,
      schemaImpactCount: schemaImpacts.size,
      compatibilityWarningCount: compatibilityWarnings.length,
      informationalWarningCount: warnings.size,
    },
    warnings: [...warnings].sort(),
  };
}

function collectSeeds(
  diff: ReturnType<typeof diffModelSnapshots>,
  fieldChanges: SchemaFieldChange[],
): DraftImpactSeed[] {
  const seeds: DraftImpactSeed[] = [];
  for (const change of diff.nodes) {
    seeds.push({
      id: `node:${change.status}:${change.id}`,
      entityType: 'node',
      status: change.status,
      graph: graphForStatus(change.status),
      nodeId: change.id,
    });
  }
  for (const change of diff.edges) {
    const beforeEdge = change.before as Edge | undefined;
    const afterEdge = change.after as Edge | undefined;
    if (!isEventModelingEdgeType(beforeEdge?.type as EdgeType) && !isEventModelingEdgeType(afterEdge?.type as EdgeType)) continue;
    seeds.push({
      id: `edge:${change.status}:${change.id}`,
      entityType: 'edge',
      status: change.status,
      graph: graphForStatus(change.status),
      edgeId: change.id,
    });
  }
  for (const [schemaKind, changes] of [
    ['command', diff.commandSchemas],
    ['event', diff.eventSchemas],
    ['viewModel', diff.viewModelSchemas],
  ] as const) {
    for (const change of changes) {
      seeds.push({
        id: `schema:${change.status}:${schemaKind}:${change.id}`,
        entityType: 'schema',
        status: change.status,
        graph: graphForStatus(change.status),
        nodeId: change.id,
        schemaKind,
      });
    }
  }
  for (const fieldChange of fieldChanges) {
    seeds.push({
      id: fieldSeedId(fieldChange),
      entityType: 'field',
      status: fieldChange.status,
      graph: graphForStatus(fieldChange.status),
      nodeId: fieldChange.nodeId,
      schemaKind: fieldChange.schemaKind,
      fieldId: fieldChange.fieldId,
      changedFields: fieldChange.changedFields,
    });
  }
  return seeds.sort((left, right) => left.id.localeCompare(right.id));
}

function collectSchemaFieldChanges(diff: ReturnType<typeof diffModelSnapshots>): SchemaFieldChange[] {
  const changes: SchemaFieldChange[] = [];
  for (const [schemaKind, schemaDiffs] of [
    ['command', diff.commandSchemas],
    ['event', diff.eventSchemas],
    ['viewModel', diff.viewModelSchemas],
  ] as const) {
    for (const schemaDiff of schemaDiffs) {
      const beforeFields = fieldsForSchema(schemaKind, schemaDiff.before);
      const afterFields = fieldsForSchema(schemaKind, schemaDiff.after);
      const beforeById = new Map(beforeFields.map(field => [field.fieldId, field]));
      const afterById = new Map(afterFields.map(field => [field.fieldId, field]));
      const fieldIds = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
      for (const fieldId of fieldIds) {
        const before = beforeById.get(fieldId) ?? null;
        const after = afterById.get(fieldId) ?? null;
        if (!before && after) {
          changes.push({ schemaKind, nodeId: schemaDiff.id, fieldId, status: 'added', before, after, changedFields: [] });
        } else if (before && !after) {
          changes.push({ schemaKind, nodeId: schemaDiff.id, fieldId, status: 'removed', before, after, changedFields: [] });
        } else if (before && after && stableJson(before) !== stableJson(after)) {
          changes.push({
            schemaKind,
            nodeId: schemaDiff.id,
            fieldId,
            status: 'changed',
            before,
            after,
            changedFields: changedFieldKeys(before, after),
          });
        }
      }
    }
  }
  return changes.sort((left, right) => (
    left.schemaKind.localeCompare(right.schemaKind)
    || left.nodeId.localeCompare(right.nodeId)
    || left.fieldId.localeCompare(right.fieldId)
  ));
}

function fieldsForSchema(schemaKind: ImpactSchemaKind, value: unknown): SchemaField[] {
  if (!value || typeof value !== 'object') return [];
  if (schemaKind === 'command') {
    return ((value as CommandSchema).input?.fields ?? []) as CommandField[];
  }
  if (schemaKind === 'event') {
    return ((value as EventSchema).payload?.fields ?? []) as EventField[];
  }
  return ((value as ViewModelSchema).fields ?? []) as ViewModelField[];
}

function changedFieldKeys(before: SchemaField, after: SchemaField): string[] {
  const left = before as unknown as Record<string, unknown>;
  const right = after as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter(key => stableJson(left[key]) !== stableJson(right[key]))
    .sort();
}

function buildImpactGraph(name: ImpactGraph, modelSnapshot: ModelSnapshot): ImpactGraphView {
  const nodes = new Map<string, Node>();
  const aliases = new Map<string, string>();
  for (const node of modelSnapshot.nodes) {
    nodes.set(node.canonicalId, node);
    aliases.set(node.canonicalId, node.canonicalId);
    aliases.set(node.id, node.canonicalId);
  }
  const resolve = (nodeId: string): string | undefined => aliases.get(nodeId);
  const edges = new Map<string, Edge>();
  const outgoing = new Map<string, GraphConnection[]>();
  const incoming = new Map<string, GraphConnection[]>();
  const addConnection = (edge: Edge, fromRef: string, toRef: string) => {
    const fromNodeId = resolve(fromRef);
    const toNodeId = resolve(toRef);
    if (!fromNodeId || !toNodeId) return;
    const connection: GraphConnection = { edge, fromNodeId, toNodeId };
    addConnectionToIndex(outgoing, fromNodeId, connection);
    addConnectionToIndex(incoming, toNodeId, connection);
  };

  for (const edge of toEventModelingEdges(modelSnapshot.edges)) {
    edges.set(edge.id, edge);
    addConnection(edge, edge.fromNodeId, edge.toNodeId);
    if (edge.type === 'roleIssuesCommand' && edge.viaNodeId) {
      addConnection(edge, edge.viaNodeId, edge.toNodeId);
    }
  }
  for (const connections of outgoing.values()) sortConnections(connections);
  for (const connections of incoming.values()) sortConnections(connections);
  return { name, nodes, aliases, edges, outgoing, incoming };
}

function canonicalNodeId(graph: ImpactGraphView, nodeId: string): string | undefined {
  return graph.aliases.get(nodeId);
}

function addConnectionToIndex(index: Map<string, GraphConnection[]>, key: string, connection: GraphConnection): void {
  const entries = index.get(key) ?? [];
  if (!entries.some(existing => (
    existing.edge.id === connection.edge.id
    && existing.fromNodeId === connection.fromNodeId
    && existing.toNodeId === connection.toNodeId
  ))) {
    entries.push(connection);
  }
  index.set(key, entries);
}

function sortConnections(connections: GraphConnection[]): void {
  connections.sort((left, right) => (
    left.edge.id.localeCompare(right.edge.id)
    || left.fromNodeId.localeCompare(right.fromNodeId)
    || left.toNodeId.localeCompare(right.toNodeId)
  ));
}

function traverseFromSeed(args: {
  graph: ImpactGraphView;
  startNodeId: string;
  seed: DraftImpactSeed;
  nodes: Map<string, MutableImpactNode>;
  edges: Map<string, MutableImpactEdge>;
  reason: string;
}): void {
  const startNode = args.graph.nodes.get(args.startNodeId);
  if (!startNode) return;
  addAffectedNode(args.nodes, startNode, args.seed, args.reason, {
    graph: args.graph.name,
    direction: 'related',
    path: [startNode.canonicalId],
    depth: 0,
  });
  traverseDirection(args, 'upstream');
  traverseDirection(args, 'downstream');
}

function traverseDirection(
  args: {
    graph: ImpactGraphView;
    startNodeId: string;
    seed: DraftImpactSeed;
    nodes: Map<string, MutableImpactNode>;
    edges: Map<string, MutableImpactEdge>;
    reason: string;
  },
  direction: 'upstream' | 'downstream',
): void {
  const queue: Array<{ nodeId: string; path: string[]; depth: number }> = [{
    nodeId: args.startNodeId,
    path: [args.startNodeId],
    depth: 0,
  }];
  const visited = new Set<string>([args.startNodeId]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const connections = direction === 'downstream'
      ? args.graph.outgoing.get(current.nodeId) ?? []
      : args.graph.incoming.get(current.nodeId) ?? [];
    for (const connection of connections) {
      const nextNodeId = direction === 'downstream' ? connection.toNodeId : connection.fromNodeId;
      const nextNode = args.graph.nodes.get(nextNodeId);
      if (!nextNode) continue;
      const path: DraftImpactPath = {
        graph: args.graph.name,
        direction,
        path: [...current.path, `edge:${connection.edge.id}`, nextNodeId],
        depth: current.depth + 1,
      };
      addAffectedEdge(args.edges, connection.edge, args.graph.name, args.seed, `${direction} from ${args.startNodeId}`, path);
      addAffectedNode(args.nodes, nextNode, args.seed, `${direction} from ${args.startNodeId}`, path);
      if (!visited.has(nextNodeId)) {
        visited.add(nextNodeId);
        queue.push({ nodeId: nextNodeId, path: path.path, depth: path.depth });
      }
    }
  }
}

function addAffectedNode(
  records: Map<string, MutableImpactNode>,
  node: Node,
  seed: DraftImpactSeed,
  reason: string,
  path: DraftImpactPath,
): void {
  const record = records.get(node.canonicalId) ?? {
    canonicalId: node.canonicalId,
    kind: node.kind,
    reasons: new Set<string>(),
    changeIds: new Set<string>(),
    traversalDepth: path.depth,
    paths: new Map<string, DraftImpactPath>(),
  };
  record.reasons.add(reason);
  record.changeIds.add(seed.id);
  record.traversalDepth = Math.min(record.traversalDepth, path.depth);
  record.paths.set(pathKey(path), path);
  records.set(node.canonicalId, record);
}

function addAffectedEdge(
  records: Map<string, MutableImpactEdge>,
  edge: Edge,
  graph: ImpactGraph,
  seed: DraftImpactSeed,
  reason: string,
  path: DraftImpactPath,
): void {
  const record = records.get(edge.id) ?? {
    id: edge.id,
    types: new Set<EdgeType>(),
    graphs: new Set<ImpactGraph>(),
    reasons: new Set<string>(),
    changeIds: new Set<string>(),
    paths: new Map<string, DraftImpactPath>(),
  };
  record.types.add(edge.type);
  record.graphs.add(graph);
  record.reasons.add(reason);
  record.changeIds.add(seed.id);
  record.paths.set(pathKey(path), path);
  records.set(edge.id, record);
}

function edgeEndpoints(graph: ImpactGraphView, edge: Edge): string[] {
  const refs = edge.type === 'roleIssuesCommand' && edge.viaNodeId
    ? [edge.fromNodeId, edge.viaNodeId, edge.toNodeId]
    : [edge.fromNodeId, edge.toNodeId];
  const byId = new Map<string, string>();
  for (const node of graph.nodes.values()) {
    byId.set(node.id, node.canonicalId);
    byId.set(node.canonicalId, node.canonicalId);
  }
  return [...new Set(refs.map(ref => byId.get(ref)).filter((id): id is string => Boolean(id)))];
}

function addCommandIssuerImpacts(args: {
  graph: ImpactGraphView;
  fieldChange: SchemaFieldChange;
  seed: DraftImpactSeed;
  schemaImpacts: Map<string, MutableSchemaImpact>;
  nodes: Map<string, MutableImpactNode>;
  schemaTargets: Map<string, Set<string>>;
}): void {
  const commandNodeId = canonicalNodeId(args.graph, args.fieldChange.nodeId);
  if (!commandNodeId) return;
  const connections = args.graph.incoming.get(commandNodeId) ?? [];
  for (const connection of connections) {
    const issuer = args.graph.nodes.get(connection.fromNodeId);
    if (!issuer) continue;
    const target = { nodeId: issuer.canonicalId };
    addSchemaImpact(args.schemaImpacts, args.schemaTargets, {
      id: `command-issuer:${args.fieldChange.nodeId}:${args.fieldChange.fieldId}:${issuer.canonicalId}:${connection.edge.id}`,
      relationship: 'commandFieldToIssuer',
      source: fieldSource(args.fieldChange),
      target,
      certainty: 'explicit',
      graph: args.graph.name,
      seed: args.seed,
      reason: `issuer connected by ${connection.edge.type}`,
    });
    addRelatedNode(args.nodes, issuer, args.seed, args.graph.name, args.fieldChange, target.nodeId, 'command field issuer');
  }
}

function addEventFieldImpacts(args: {
  graph: ImpactGraphView;
  snapshot: ModelSnapshot;
  fieldChange: SchemaFieldChange;
  seed: DraftImpactSeed;
  schemaImpacts: Map<string, MutableSchemaImpact>;
  nodes: Map<string, MutableImpactNode>;
  schemaTargets: Map<string, Set<string>>;
}): void {
  for (const viewSchema of args.snapshot.viewModelSchemas) {
    for (const viewField of viewSchema.fields) {
      if (!eventFieldSourceMatches(args.graph, args.fieldChange, viewField)) continue;
      const viewNodeId = canonicalNodeId(args.graph, viewSchema.viewModelNodeId) ?? viewSchema.viewModelNodeId;
      const viewNode = args.graph.nodes.get(viewNodeId);
      if (viewNode) {
        addRelatedNode(args.nodes, viewNode, args.seed, args.graph.name, args.fieldChange, viewField.fieldId, 'event field source');
      }
      addSchemaImpact(args.schemaImpacts, args.schemaTargets, {
        id: `event-source:${args.fieldChange.nodeId}:${args.fieldChange.fieldId}:${viewNodeId}:${viewField.fieldId}`,
        relationship: 'eventFieldToViewModelField',
        source: fieldSource(args.fieldChange),
        target: { schemaKind: 'viewModel', nodeId: viewNodeId, fieldId: viewField.fieldId },
        certainty: 'explicit',
        graph: args.graph.name,
        seed: args.seed,
        reason: `ViewModel field source ${viewField.source.eventFieldPath}`,
      });
      addViewModelFieldConsumerImpacts({
        graph: args.graph,
        fieldChange: {
          schemaKind: 'viewModel',
          nodeId: viewNodeId,
          fieldId: viewField.fieldId,
          status: args.fieldChange.status,
          before: viewField,
          after: viewField,
          changedFields: [],
        },
        seed: args.seed,
        schemaImpacts: args.schemaImpacts,
        nodes: args.nodes,
        schemaTargets: args.schemaTargets,
      });
      const eventKey = schemaFieldKey(args.fieldChange.schemaKind, args.fieldChange.nodeId, args.fieldChange.fieldId);
      const viewKey = schemaFieldKey('viewModel', viewNodeId, viewField.fieldId);
      const eventTargets = args.schemaTargets.get(eventKey) ?? new Set<string>();
      for (const targetId of args.schemaTargets.get(viewKey) ?? []) eventTargets.add(targetId);
      args.schemaTargets.set(eventKey, eventTargets);
    }
  }
}

function addViewModelFieldConsumerImpacts(args: {
  graph: ImpactGraphView;
  fieldChange: SchemaFieldChange;
  seed: DraftImpactSeed;
  schemaImpacts: Map<string, MutableSchemaImpact>;
  nodes: Map<string, MutableImpactNode>;
  schemaTargets: Map<string, Set<string>>;
}): void {
  const viewModelNodeId = canonicalNodeId(args.graph, args.fieldChange.nodeId);
  if (!viewModelNodeId) return;
  const connections = args.graph.outgoing.get(viewModelNodeId) ?? [];
  for (const connection of connections) {
    if (connection.edge.type !== 'viewModelConsumedByUiOrProcessor') continue;
    const consumer = args.graph.nodes.get(connection.toNodeId);
    if (!consumer) continue;
    const fieldRefs = stringArray(connection.edge.meta?.fieldRefs);
    if (fieldRefs.length > 0 && !fieldRefs.includes(args.fieldChange.fieldId)) continue;
    const certainty = fieldRefs.length > 0 ? 'explicit' : 'candidate';
    addSchemaImpact(args.schemaImpacts, args.schemaTargets, {
      id: `view-consumer:${args.fieldChange.nodeId}:${args.fieldChange.fieldId}:${consumer.canonicalId}:${connection.edge.id}`,
      relationship: 'viewModelFieldToConsumer',
      source: fieldSource(args.fieldChange),
      target: { nodeId: consumer.canonicalId },
      certainty,
      graph: args.graph.name,
      seed: args.seed,
      reason: certainty === 'explicit'
        ? `consumer references field through ${connection.edge.id}`
        : `consumer has no fieldRefs; review candidate through ${connection.edge.id}`,
    });
    addRelatedNode(args.nodes, consumer, args.seed, args.graph.name, args.fieldChange, consumer.canonicalId, 'ViewModel field consumer');
  }
}

function addSchemaImpact(
  records: Map<string, MutableSchemaImpact>,
  schemaTargets: Map<string, Set<string>>,
  args: {
    id: string;
    relationship: DraftSchemaImpact['relationship'];
    source: DraftSchemaImpact['source'];
    target: DraftSchemaImpact['target'];
    certainty: DraftSchemaImpact['certainty'];
    graph: ImpactGraph;
    seed: DraftImpactSeed;
    reason: string;
  },
): void {
  const record = records.get(args.id) ?? {
    id: args.id,
    relationship: args.relationship,
    source: args.source,
    target: args.target,
    certainty: args.certainty,
    graphs: new Set<ImpactGraph>(),
    reasons: new Set<string>(),
    changeIds: new Set<string>(),
  };
  record.graphs.add(args.graph);
  record.reasons.add(args.reason);
  record.changeIds.add(args.seed.id);
  records.set(args.id, record);
  const key = schemaFieldKey(args.source.schemaKind, args.source.nodeId, args.source.fieldId);
  const targets = schemaTargets.get(key) ?? new Set<string>();
  targets.add(args.target.nodeId);
  schemaTargets.set(key, targets);
}

function addRelatedNode(
  nodes: Map<string, MutableImpactNode>,
  node: Node,
  seed: DraftImpactSeed,
  graph: ImpactGraph,
  fieldChange: SchemaFieldChange,
  targetId: string,
  reason: string,
): void {
  addAffectedNode(nodes, node, seed, reason, {
    graph,
    direction: 'related',
    path: [fieldChange.nodeId, `field:${fieldChange.fieldId}`, targetId],
    depth: 1,
  });
}

function collectCompatibilityWarnings(
  fieldChanges: SchemaFieldChange[],
  schemaTargets: Map<string, Set<string>>,
  informationalWarnings: Set<string>,
): DraftCompatibilityWarning[] {
  const warnings: DraftCompatibilityWarning[] = [];
  for (const fieldChange of fieldChanges) {
    const targets = [...(schemaTargets.get(schemaFieldKey(fieldChange.schemaKind, fieldChange.nodeId, fieldChange.fieldId)) ?? new Set<string>())].sort();
    const rules = compatibilityRulesFor(fieldChange);
    for (const rule of rules) {
      warnings.push({
        id: `${rule.code}:${fieldChange.schemaKind}:${fieldChange.nodeId}:${fieldChange.fieldId}`,
        code: rule.code,
        severity: 'warning',
        message: rule.message,
        schemaKind: fieldChange.schemaKind,
        nodeId: fieldChange.nodeId,
        fieldId: fieldChange.fieldId,
        changeId: fieldSeedId(fieldChange),
        affectedNodeIds: targets,
      });
    }
    if (rules.length > 0 && targets.length === 0 && (fieldChange.schemaKind === 'event' || fieldChange.schemaKind === 'viewModel')) {
      informationalWarnings.add(`No explicit modeled consumer was found for ${fieldChange.schemaKind} field ${fieldChange.nodeId}.${fieldChange.fieldId}`);
    }
  }
  return warnings.sort((left, right) => left.id.localeCompare(right.id));
}

function compatibilityRulesFor(change: SchemaFieldChange): Array<{ code: string; message: string }> {
  const label = `${change.schemaKind} field ${change.nodeId}.${change.fieldId}`;
  if (change.status === 'removed') {
    return [{ code: `${schemaCodePrefix(change.schemaKind)}_FIELD_REMOVED`, message: `${label} was removed and may break existing consumers.` }];
  }
  if (change.status === 'added') {
    if (change.schemaKind === 'command' && (change.after as CommandField | null)?.required === true) {
      return [{ code: 'COMMAND_REQUIRED_FIELD_ADDED', message: `${label} was added as required and may break command issuers.` }];
    }
    return [];
  }

  const rules: Array<{ code: string; message: string }> = [];
  if (change.changedFields.includes('type')) {
    rules.push({ code: `${schemaCodePrefix(change.schemaKind)}_FIELD_TYPE_CHANGED`, message: `${label} changed type and may break consumers.` });
  }
  if (change.changedFields.includes('required')) {
    rules.push({ code: `${schemaCodePrefix(change.schemaKind)}_FIELD_REQUIREDNESS_CHANGED`, message: `${label} changed requiredness and may break consumers.` });
  }
  if (change.changedFields.includes('nullable')) {
    rules.push({ code: `${schemaCodePrefix(change.schemaKind)}_FIELD_NULLABILITY_CHANGED`, message: `${label} changed nullability and may break consumers.` });
  }
  return rules;
}

function schemaCodePrefix(schemaKind: ImpactSchemaKind): string {
  if (schemaKind === 'viewModel') return 'VIEW_MODEL';
  return schemaKind.toUpperCase();
}

function eventFieldSourceMatches(graph: ImpactGraphView, change: SchemaFieldChange, field: ViewModelField): boolean {
  const eventId = canonicalNodeId(graph, field.source.eventNodeId) ?? field.source.eventNodeId;
  const changedEventId = canonicalNodeId(graph, change.nodeId) ?? change.nodeId;
  if (eventId !== changedEventId) return false;
  const changedField = graph.name === 'base'
    ? (change.before ?? change.after)
    : (change.after ?? change.before);
  if (!changedField) return false;
  const sourcePath = normalizeSchemaPath(field.source.eventFieldPath);
  return sourcePath === normalizeSchemaPath(changedField.fieldId)
    || sourcePath === normalizeSchemaPath(changedField.name);
}

function normalizeSchemaPath(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, '')
    .replace(/\//g, '.')
    .replace(/^(payload|input)\./, '');
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').sort()
    : [];
}

function fieldSource(change: SchemaFieldChange): DraftSchemaImpact['source'] {
  return { schemaKind: change.schemaKind, nodeId: change.nodeId, fieldId: change.fieldId };
}

function groupAffectedNodes(records: Map<string, MutableImpactNode>): DraftImpactNodeGroups {
  const groups: DraftImpactNodeGroups = {
    stories: [], roles: [], uiSurfaces: [], triggers: [], processors: [], commands: [], events: [], viewModels: [], other: [],
  };
  for (const record of records.values()) {
    groups[nodeGroup(record.kind)].push(finalizeAffectedNode(record));
  }
  for (const group of Object.values(groups) as DraftImpactNode[][]) {
    group.sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));
  }
  return groups;
}

function nodeGroup(kind: Node['kind']): keyof DraftImpactNodeGroups {
  if (kind.startsWith('story.')) return 'stories';
  if (kind === 'role') return 'roles';
  if (kind.startsWith('ui.')) return 'uiSurfaces';
  if (kind === 'trigger') return 'triggers';
  if (kind === 'proc') return 'processors';
  if (kind === 'cmd') return 'commands';
  if (kind === 'evt') return 'events';
  if (kind === 'viewModel') return 'viewModels';
  return 'other';
}

function finalizeAffectedNode(record: MutableImpactNode): DraftImpactNode {
  return {
    canonicalId: record.canonicalId,
    kind: record.kind,
    reasons: [...record.reasons].sort(),
    changeIds: [...record.changeIds].sort(),
    traversalDepth: record.traversalDepth,
    paths: [...record.paths.values()].sort(comparePaths),
  };
}

function finalizeAffectedEdge(record: MutableImpactEdge): DraftImpactEdge {
  return {
    id: record.id,
    types: [...record.types].sort(),
    graphs: [...record.graphs].sort(),
    reasons: [...record.reasons].sort(),
    changeIds: [...record.changeIds].sort(),
    paths: [...record.paths.values()].sort(comparePaths),
  };
}

function finalizeSchemaImpact(record: MutableSchemaImpact): DraftSchemaImpact {
  return {
    id: record.id,
    relationship: record.relationship,
    source: record.source,
    target: record.target,
    certainty: record.certainty,
    graphs: [...record.graphs].sort(),
    reasons: [...record.reasons].sort(),
    changeIds: [...record.changeIds].sort(),
  };
}

function comparePaths(left: DraftImpactPath, right: DraftImpactPath): number {
  return left.graph.localeCompare(right.graph)
    || left.direction.localeCompare(right.direction)
    || left.depth - right.depth
    || stableJson(left.path).localeCompare(stableJson(right.path));
}

function pathKey(path: DraftImpactPath): string {
  return `${path.graph}:${path.direction}:${stableJson(path.path)}`;
}

function graphForStatus(status: ImpactStatus): ImpactGraph | 'both' {
  if (status === 'added') return 'after';
  if (status === 'removed') return 'base';
  return 'both';
}

function graphsForStatus(status: ImpactStatus): ImpactGraph[] {
  const graph = graphForStatus(status);
  return graph === 'both' ? ['base', 'after'] : [graph];
}

function graphsForSeed(seed: DraftImpactSeed): ImpactGraph[] {
  return seed.graph === 'both' ? ['base', 'after'] : [seed.graph];
}

function fieldSeedFor(change: SchemaFieldChange): DraftImpactSeed | undefined {
  return {
    id: fieldSeedId(change),
    entityType: 'field',
    status: change.status,
    graph: graphForStatus(change.status),
    nodeId: change.nodeId,
    schemaKind: change.schemaKind,
    fieldId: change.fieldId,
    changedFields: change.changedFields,
  };
}

function fieldSeedId(change: SchemaFieldChange): string {
  return `field:${change.status}:${change.schemaKind}:${change.nodeId}:${change.fieldId}`;
}

function schemaFieldKey(schemaKind: ImpactSchemaKind, nodeId: string, fieldId: string): string {
  return `${schemaKind}:${nodeId}:${fieldId}`;
}
