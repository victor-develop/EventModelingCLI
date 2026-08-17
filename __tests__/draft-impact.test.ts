import type { Draft, Edge, ModelSnapshot, Node } from '../src/domain/types';
import { buildDraftImpactAnalysis } from '../src/drafts/impact';

const projectId = 'proj_impact';

describe('draft-wide semantic impact analysis', () => {
  test('walks the event-modeling flow from a changed command and terminates cycles deterministically', () => {
    const draft = createImpactDraft();
    const first = buildDraftImpactAnalysis(draft);
    const second = buildDraftImpactAnalysis(draft);

    expect(second).toEqual(first);
    expect(ids(first.affectedNodes.roles)).toContain('role.buyer');
    expect(ids(first.affectedNodes.uiSurfaces)).toEqual(expect.arrayContaining(['ui.checkout', 'ui.result']));
    expect(ids(first.affectedNodes.triggers)).toContain('trigger.webhook');
    expect(ids(first.affectedNodes.processors)).toEqual(expect.arrayContaining(['proc.command-handler', 'proc.result-handler']));
    expect(ids(first.affectedNodes.events)).toContain('evt.order-submitted');
    expect(first.affectedNodes.commands.find(node => node.canonicalId === 'cmd.submit-order')?.traversalDepth).toBe(0);
    expect(first.affectedEdges.every(edge => edge.types.every(type => type !== 'parentOf'))).toBe(true);
  });

  test('uses the net base/after snapshots for additions and removals, not raw operation counts', () => {
    const impact = buildDraftImpactAnalysis(createImpactDraft());

    expect(impact.seeds.map(seed => seed.id)).toContain('node:removed:ui.legacy-result');
    expect(impact.seeds.map(seed => seed.id)).toContain('node:added:ui.added-result');
    expect(impact.seeds.map(seed => seed.id)).toContain('edge:removed:edge-vm-legacy');
    expect(impact.seeds.map(seed => seed.id)).toContain('edge:added:edge-vm-added');
    expect(impact.seeds.map(seed => seed.id).join('\n')).not.toContain('ui.transient');
    expect(ids(impact.affectedNodes.uiSurfaces)).toEqual(expect.arrayContaining(['ui.legacy-result', 'ui.added-result']));
    expect(impact.affectedEdges.find(edge => edge.id === 'edge-vm-legacy')?.graphs).toEqual(['base']);
    expect(impact.affectedEdges.find(edge => edge.id === 'edge-vm-added')?.graphs).toEqual(['after']);
  });

  test('does not report structural-only edge changes as semantic impact', () => {
    const impact = buildDraftImpactAnalysis(createImpactDraft());

    expect(impact.seeds.map(seed => seed.id)).not.toContain('edge:changed:edge-ui-parent');
    expect(impact.affectedEdges.map(edge => edge.id)).not.toContain('edge-ui-parent');
  });

  test('keeps the base impact when an event-modeling edge is changed into a structural edge', () => {
    const impact = buildDraftImpactAnalysis(createSemanticToStructuralEdgeDraft());
    const edgeSeed = 'edge:changed:edge-command-event';

    expect(impact.seeds).toEqual([
      expect.objectContaining({
        id: edgeSeed,
        entityType: 'edge',
        status: 'changed',
        graph: 'both',
        edgeId: 'edge-command-event',
      }),
    ]);
    expect(impact.affectedNodes.commands.find(node => node.canonicalId === 'cmd.submit-order')?.changeIds).toContain(edgeSeed);
    expect(impact.affectedNodes.events.find(node => node.canonicalId === 'evt.order-submitted')?.changeIds).toContain(edgeSeed);
    expect(impact.affectedEdges.find(edge => edge.id === 'edge-command-event')?.graphs).toEqual(['base']);
    expect(impact.affectedEdges.find(edge => edge.id === 'edge-command-event')?.types).toEqual(['commandCausesEvent']);
  });

  test('uses changed event-modeling edge endpoints as flow seeds', () => {
    const impact = buildDraftImpactAnalysis(createImpactDraft());
    const edgeSeed = 'edge:changed:edge-command-event';

    expect(impact.seeds.map(seed => seed.id)).toContain(edgeSeed);
    expect(impact.affectedNodes.commands.find(node => node.canonicalId === 'cmd.submit-order')?.changeIds).toContain(edgeSeed);
    expect(impact.affectedNodes.events.find(node => node.canonicalId === 'evt.order-submitted')?.changeIds).toContain(edgeSeed);
    expect(impact.affectedEdges.find(edge => edge.id === 'edge-command-event')?.changeIds).toContain(edgeSeed);
  });

  test('seeds a pure schema-envelope change even without a field delta', () => {
    const baseSnapshot: ModelSnapshot = {
      nodes: [node('cmd.schema-only', 'cmd')], edges: [], proposals: [], eventSchemas: [], viewModelSchemas: [],
      commandSchemas: [{ commandNodeId: 'cmd.schema-only', version: 1, input: { fields: [] } }],
    };
    const draft: Draft = {
      id: 'draft_schema_envelope', projectId, baseRevisionId: 'rev_001', baseSnapshot, status: 'open', message: '', proposals: [],
      ops: [{
        version: 2, op: 'edit', action: 'edit', entityType: 'schema', entityId: 'cmd.schema-only', timestamp: '2026-08-08T00:00:00.000Z',
        after: { commandNodeId: 'cmd.schema-only', version: 2, input: { fields: [] } },
        target: { filePath: 'schemas/command/cmd.schema-only.yaml', schemaKind: 'command', ownerNodeId: 'cmd.schema-only' },
      }],
    };

    const impact = buildDraftImpactAnalysis(draft);

    expect(impact.seeds).toEqual([expect.objectContaining({
      id: 'schema:changed:command:cmd.schema-only', entityType: 'schema', status: 'changed', schemaKind: 'command',
    })]);
  });

  test('follows explicit event field sources to ViewModel consumers and marks omitted fieldRefs as candidates', () => {
    const impact = buildDraftImpactAnalysis(createImpactDraft());
    const eventSource = impact.schemaImpacts.find(item => (
      item.relationship === 'eventFieldToViewModelField'
      && item.source.nodeId === 'evt.order-submitted'
      && item.source.fieldId === 'orderId'
    ));
    const consumers = impact.schemaImpacts.filter(item => (
      item.relationship === 'viewModelFieldToConsumer'
      && item.source.nodeId === 'vm.order-detail'
      && item.source.fieldId === 'f.order-id'
    ));

    expect(eventSource).toMatchObject({ certainty: 'explicit', target: { nodeId: 'vm.order-detail', fieldId: 'f.order-id' } });
    expect(consumers).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: { nodeId: 'ui.result' }, certainty: 'explicit' }),
      expect.objectContaining({ target: { nodeId: 'proc.result-handler' }, certainty: 'candidate' }),
    ]));
    expect(ids(impact.affectedNodes.uiSurfaces)).toContain('ui.result');
    expect(ids(impact.affectedNodes.processors)).toContain('proc.result-handler');
  });

  test('matches a renamed Event field against the old source path in the base graph', () => {
    const impact = buildDraftImpactAnalysis(createRenamedEventFieldDraft());
    const sourceImpact = impact.schemaImpacts.find(item => item.relationship === 'eventFieldToViewModelField');

    expect(sourceImpact).toMatchObject({
      source: { schemaKind: 'event', nodeId: 'evt.order-submitted', fieldId: 'orderId' },
      target: { schemaKind: 'viewModel', nodeId: 'vm.order-detail', fieldId: 'f.order-id' },
      graphs: ['base'],
      certainty: 'explicit',
    });
    expect(impact.compatibilityWarnings.map(warning => warning.code)).toContain('EVENT_FIELD_RENAMED');
  });

  test('uses the base graph for removed ViewModel fields and preserves multiple seed reasons', () => {
    const impact = buildDraftImpactAnalysis(createImpactDraft());
    const removedFieldConsumer = impact.schemaImpacts.find(item => (
      item.relationship === 'viewModelFieldToConsumer'
      && item.source.fieldId === 'f.legacy'
      && item.target.nodeId === 'ui.legacy-result'
    ));
    const event = impact.affectedNodes.events.find(node => node.canonicalId === 'evt.order-submitted');

    expect(removedFieldConsumer).toMatchObject({ certainty: 'explicit', graphs: ['base'] });
    expect(event?.changeIds.length).toBeGreaterThan(1);
    expect(impact.compatibilityWarnings.map(warning => warning.code)).toEqual(expect.arrayContaining([
      'COMMAND_REQUIRED_FIELD_ADDED',
      'EVENT_FIELD_TYPE_CHANGED',
      'VIEW_MODEL_FIELD_NULLABILITY_CHANGED',
      'VIEW_MODEL_FIELD_REMOVED',
    ]));
    expect(impact.compatibilityWarnings.find(warning => warning.code === 'COMMAND_REQUIRED_FIELD_ADDED')?.affectedNodeIds)
      .toEqual(expect.arrayContaining(['role.buyer', 'ui.checkout', 'trigger.webhook', 'proc.command-handler']));
  });
});

function createImpactDraft(): Draft {
  const baseSnapshot: ModelSnapshot = {
    nodes: [
      node('role.buyer', 'role'),
      node('ui.checkout', 'ui.screen'),
      node('trigger.webhook', 'trigger'),
      node('proc.command-handler', 'proc'),
      node('cmd.submit-order', 'cmd'),
      node('evt.order-submitted', 'evt'),
      node('vm.order-detail', 'viewModel'),
      node('ui.result', 'ui.screen'),
      node('proc.result-handler', 'proc'),
      node('ui.legacy-result', 'ui.component'),
    ],
    edges: [
      edge('edge-role-command', 'roleIssuesCommand', 'role.buyer', 'cmd.submit-order', 'ui.checkout'),
      edge('edge-trigger-command', 'processorOrTriggerIssuesCommand', 'trigger.webhook', 'cmd.submit-order'),
      edge('edge-proc-command', 'processorOrTriggerIssuesCommand', 'proc.command-handler', 'cmd.submit-order'),
      edge('edge-command-event', 'commandCausesEvent', 'cmd.submit-order', 'evt.order-submitted'),
      edge('edge-event-view', 'eventRefreshesViewModel', 'evt.order-submitted', 'vm.order-detail'),
      edge('edge-event-proc', 'eventUpdatesProcessor', 'evt.order-submitted', 'proc.command-handler'),
      edge('edge-vm-ui', 'viewModelConsumedByUiOrProcessor', 'vm.order-detail', 'ui.result', undefined, { fieldRefs: ['f.order-id'] }),
      edge('edge-vm-proc', 'viewModelConsumedByUiOrProcessor', 'vm.order-detail', 'proc.result-handler'),
      edge('edge-vm-legacy', 'viewModelConsumedByUiOrProcessor', 'vm.order-detail', 'ui.legacy-result', undefined, { fieldRefs: ['f.legacy'] }),
      edge('edge-ui-parent', 'parentOf', 'ui.checkout', 'ui.result'),
    ],
    commandSchemas: [{
      commandNodeId: 'cmd.submit-order', version: 1,
      input: { fields: [{ fieldId: 'orderId', name: 'orderId', type: 'string', required: true }] },
    }],
    eventSchemas: [{
      eventNodeId: 'evt.order-submitted', version: 1,
      payload: { fields: [{ fieldId: 'orderId', name: 'orderId', type: 'string', required: true }] },
    }],
    viewModelSchemas: [{
      viewModelNodeId: 'vm.order-detail',
      fields: [
        { fieldId: 'f.order-id', name: 'orderId', type: 'string', nullable: false, source: { eventNodeId: 'evt.order-submitted', eventFieldPath: 'payload.orderId' } },
        { fieldId: 'f.legacy', name: 'legacy', type: 'string', nullable: true, source: { eventNodeId: 'evt.order-submitted', eventFieldPath: 'payload.legacy' } },
      ],
    }],
    proposals: [],
  };
  const changedCommand = { ...baseSnapshot.nodes.find(item => item.canonicalId === 'cmd.submit-order')!, displayName: 'Submit order now' };
  const removedLegacy = baseSnapshot.nodes.find(item => item.canonicalId === 'ui.legacy-result')!;
  const removedLegacyEdge = baseSnapshot.edges.find(item => item.id === 'edge-vm-legacy')!;
  const addedNode = node('ui.added-result', 'ui.screen');
  const addedEdge = edge('edge-vm-added', 'viewModelConsumedByUiOrProcessor', 'vm.order-detail', 'ui.added-result');
  const changedStructuralEdge = { ...baseSnapshot.edges.find(item => item.id === 'edge-ui-parent')!, meta: { layoutHint: 'changed' } };
  const changedFlowEdge = { ...baseSnapshot.edges.find(item => item.id === 'edge-command-event')!, meta: { contract: 'v2' } };

  return {
    id: 'draft_impact', projectId, baseRevisionId: 'rev_001', baseSnapshot, status: 'open', message: 'impact fixture', proposals: [],
    ops: [
      op('node', 'cmd.submit-order', changedCommand),
      op('node', 'ui.legacy-result', null),
      op('edge', 'edge-vm-legacy', null),
      op('node', 'ui.added-result', addedNode),
      op('edge', 'edge-vm-added', addedEdge),
      op('edge', 'edge-ui-parent', changedStructuralEdge),
      op('edge', 'edge-command-event', changedFlowEdge),
      schemaOp('event', 'evt.order-submitted', 'orderId', { fieldId: 'orderId', name: 'orderId', type: 'uuid', required: true }),
      schemaOp('viewModel', 'vm.order-detail', 'f.order-id', { fieldId: 'f.order-id', name: 'orderId', type: 'string', nullable: true, source: { eventNodeId: 'evt.order-submitted', eventFieldPath: 'payload.orderId' } }),
      schemaOp('viewModel', 'vm.order-detail', 'f.legacy', null),
      schemaOp('command', 'cmd.submit-order', 'customerEmail', { fieldId: 'customerEmail', name: 'customerEmail', type: 'string', required: true }),
      op('node', 'ui.transient', node('ui.transient', 'ui.screen')),
      op('node', 'ui.transient', null),
    ],
  };
}

function createSemanticToStructuralEdgeDraft(): Draft {
  const base = createImpactDraft().baseSnapshot!;
  const original = base.edges.find(item => item.id === 'edge-command-event')!;
  return {
    id: 'draft_edge_type_transition',
    projectId,
    baseRevisionId: 'rev_001',
    baseSnapshot: base,
    status: 'open',
    message: 'semantic edge became structural',
    proposals: [],
    ops: [op('edge', original.id, { ...original, type: 'parentOf' })],
  };
}

function createRenamedEventFieldDraft(): Draft {
  const source = createImpactDraft().baseSnapshot!;
  const originalSchema = source.eventSchemas[0]!;
  const originalField = originalSchema.payload.fields[0]!;
  const base: ModelSnapshot = {
    ...source,
    eventSchemas: [{
      ...originalSchema,
      payload: { fields: [{ ...originalField, name: 'legacyOrderId' }] },
    }],
    viewModelSchemas: source.viewModelSchemas.map(schema => schema.viewModelNodeId === 'vm.order-detail'
      ? {
        ...schema,
        fields: schema.fields.map(field => field.fieldId === 'f.order-id'
          ? { ...field, source: { ...field.source, eventFieldPath: 'payload.legacyOrderId' } }
          : field),
      }
      : schema),
  };
  return {
    id: 'draft_event_field_rename',
    projectId,
    baseRevisionId: 'rev_001',
    baseSnapshot: base,
    status: 'open',
    message: 'event field renamed',
    proposals: [],
    ops: [schemaOp('event', originalSchema.eventNodeId, originalField.fieldId, {
      ...originalField,
      name: 'orderIdentifier',
    })],
  };
}

function op(entityType: 'node' | 'edge', entityId: string, after: Node | Edge | null) {
  return { version: 2 as const, op: after ? 'edit' : 'remove', action: after ? 'edit' as const : 'remove' as const, entityType, entityId, timestamp: '2026-08-08T00:00:00.000Z', after };
}

function schemaOp(schemaKind: 'command' | 'event' | 'viewModel', ownerNodeId: string, fieldId: string, after: Record<string, unknown> | null) {
  return {
    version: 2 as const, op: after ? 'edit' : 'remove', action: after ? 'edit' as const : 'remove' as const,
    entityType: 'schema' as const, entityId: `${ownerNodeId}:${fieldId}`, timestamp: '2026-08-08T00:00:00.000Z', after,
    target: { filePath: 'schemas/test.yaml', schemaKind, ownerNodeId, fieldId },
  };
}

function node(canonicalId: string, kind: Node['kind']): Node {
  return { id: canonicalId, projectId, canonicalId, kind, displayName: canonicalId, tags: [], domains: [] };
}

function edge(id: string, type: Edge['type'], fromNodeId: string, toNodeId: string, viaNodeId?: string, meta?: Record<string, unknown>): Edge {
  return { id, projectId, type, fromNodeId, toNodeId, ...(viaNodeId ? { viaNodeId } : {}), ...(meta ? { meta } : {}) };
}

function ids(nodes: Array<{ canonicalId: string }>): string[] {
  return nodes.map(node => node.canonicalId);
}
