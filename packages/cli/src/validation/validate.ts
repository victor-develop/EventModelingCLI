import { EDGE_TYPE_SET, Node, Edge, ViewModelSchema, CommandSchema, EventSchema } from '../domain/types';
import { Graph, buildGraph } from '../graph/graph-builder';

export interface ValidationError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export function validate(
  nodes: Node[],
  edges: Edge[],
  vmSchemas: ViewModelSchema[],
  commandSchemas: CommandSchema[] = [],
  eventSchemas: EventSchema[] = [],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = buildGraph(nodes, edges);
  const eventSchemasByNodeId = indexEventSchemas(graph, eventSchemas);

  for (const schema of commandSchemas) {
    const envelope = validateDataSchemaEnvelope(errors, graph, schema, 'command');
    if (envelope) validateRequiredSchemaFields(errors, envelope.schemaNodeId, envelope.fields, 'command');
  }

  for (const schema of eventSchemas) {
    const envelope = validateDataSchemaEnvelope(errors, graph, schema, 'event');
    if (envelope) validateRequiredSchemaFields(errors, envelope.schemaNodeId, envelope.fields, 'event');
  }

  for (const node of nodes) {
    if (node.kind === 'story.story' || node.kind === 'story.scenario') {
      const ownsCmd = edges.some(e => e.type === 'storyOwnsCommand' && e.fromNodeId === node.id);
      if (!ownsCmd) {
        const ownsCmd2 = edges.some(e => e.type === 'storyOwnsCommand' && e.fromNodeId === node.canonicalId);
        if (!ownsCmd2) {
          errors.push({
            code: 'EMV-001',
            message: `Story "${node.displayName || node.canonicalId}" must bind at least one command`,
            details: { storyId: node.id },
          });
        }
      }
    }
  }

  const storyBoundCmds = new Set<string>();
  for (const e of edges) {
    if (e.type === 'storyOwnsCommand') {
      storyBoundCmds.add(e.toNodeId);
    }
  }

  for (const cmdId of storyBoundCmds) {
    const cmdNode = graph.nodes.get(cmdId);
    const resolved = cmdNode ? [cmdNode.id, cmdNode.canonicalId] : [cmdId];
    const hasLoop = checkEndToEndLoop(graph, resolved, edges);
    if (!hasLoop) {
      errors.push({
        code: 'EMV-010',
        message: `Story-bound command "${cmdId}" has no end-to-end loop`,
        details: { commandId: cmdId },
      });
    }
  }

  for (const node of nodes) {
    if (node.kind === 'cmd') {
      const causesEvent = edges.some(e => e.type === 'commandCausesEvent' && (e.fromNodeId === node.id || e.fromNodeId === node.canonicalId));
      if (!causesEvent) {
        errors.push({
          code: 'EMV-020',
          message: `Command "${node.canonicalId}" produces no event`,
          details: { commandId: node.canonicalId },
        });
      }
    }
  }

  for (const schema of vmSchemas) {
    for (const field of schema.fields) {
      if (!field.source.eventNodeId || !field.source.eventFieldPath) {
        errors.push({
          code: 'EMV-030',
          message: `Field "${field.fieldId}" in "${schema.viewModelNodeId}" missing source event`,
          details: { fieldId: field.fieldId, viewModelId: schema.viewModelNodeId },
        });
      }
    }
  }

  for (const schema of vmSchemas) {
    for (const field of schema.fields) {
      if (field.source.eventNodeId) {
        const hasRefreshEdge = edges.some(
          e =>
            e.type === 'eventRefreshesViewModel' &&
            (e.fromNodeId === field.source.eventNodeId || e.fromNodeId === graph.nodes.get(field.source.eventNodeId)?.canonicalId) &&
            (e.toNodeId === schema.viewModelNodeId || e.toNodeId === graph.nodes.get(schema.viewModelNodeId)?.canonicalId),
        );
        if (!hasRefreshEdge) {
          errors.push({
            code: 'EMV-031',
            message: `Field "${field.fieldId}" source event "${field.source.eventNodeId}" does not refresh view "${schema.viewModelNodeId}"`,
            details: { fieldId: field.fieldId, eventNodeId: field.source.eventNodeId, viewModelId: schema.viewModelNodeId },
          });
        }

        const eventSchema = eventSchemasByNodeId.get(field.source.eventNodeId);
        if (eventSchema && !eventSchemaHasPayloadPath(eventSchema, field.source.eventFieldPath)) {
          errors.push({
            code: 'EMV-032',
            message: `Field "${field.fieldId}" source path "${field.source.eventFieldPath}" is missing from event schema "${eventSchema.eventNodeId}"`,
            details: {
              fieldId: field.fieldId,
              eventNodeId: eventSchema.eventNodeId,
              eventFieldPath: field.source.eventFieldPath,
              viewModelId: schema.viewModelNodeId,
            },
          });
        }
      }
    }
  }

  for (const edge of edges) {
    if (!EDGE_TYPE_SET.has(edge.type as string)) {
      errors.push({
        code: 'EMV-000',
        message: `Unknown edge type "${edge.type}" in edge "${edge.id}"`,
        details: { edgeId: edge.id, edgeType: edge.type },
      });
      continue;
    }

    if (edge.type === 'viewModelConsumedByUiOrProcessor') {
      const viewModel = graph.nodes.get(edge.fromNodeId);
      const consumer = graph.nodes.get(edge.toNodeId);
      if (viewModel?.kind !== 'viewModel' || !consumer || (!consumer.kind.startsWith('ui.') && consumer.kind !== 'proc')) {
        errors.push({
          code: 'EMV-041',
          message: `View model consumption edge "${edge.id}" must point from a viewModel to a UI or processor`,
          details: {
            edgeId: edge.id,
            fromNodeId: edge.fromNodeId,
            fromNodeKind: viewModel?.kind,
            toNodeId: edge.toNodeId,
            toNodeKind: consumer?.kind,
          },
        });
      }
    }

    if (edge.type === 'viewModelConsumedByUiOrProcessor' && edge.meta?.fieldRefs) {
      const fieldRefs = edge.meta.fieldRefs as string[];
      const vmSchema = vmSchemas.find(s => s.viewModelNodeId === edge.fromNodeId);
      if (vmSchema) {
        for (const ref of fieldRefs) {
          if (!vmSchema.fields.some(f => f.fieldId === ref)) {
            errors.push({
              code: 'EMV-040',
              message: `Invalid fieldRef "${ref}" in consumes edge "${edge.id}"`,
              details: { edgeId: edge.id, fieldRef: ref },
            });
          }
        }
      }
    }
  }

  for (const node of nodes) {
    if (node.kind === 'proc') {
      const isRoleIssueSurface = edges.some(
        e =>
          e.type === 'roleIssuesCommand' &&
          (e.viaNodeId === node.id || e.viaNodeId === node.canonicalId),
      );
      if (isRoleIssueSurface) continue;

      const hasUpdate = edges.some(
        e =>
          e.type === 'eventUpdatesProcessor' &&
          (e.toNodeId === node.id || e.toNodeId === node.canonicalId),
      );
      if (!hasUpdate) {
        errors.push({
          code: 'EMV-050',
          message: `Processor "${node.canonicalId}" has no update source event`,
          details: { processorId: node.canonicalId },
        });
      }
    }
  }

  return errors;
}

type DataSchemaKind = 'command' | 'event';

interface DataSchemaSpec {
  ownerKey: 'commandNodeId' | 'eventNodeId';
  containerKey: 'input' | 'payload';
  oppositeContainerKey: 'input' | 'payload';
  expectedKind: Node['kind'];
  label: string;
}

interface ValidDataSchemaEnvelope {
  schemaNodeId: string;
  fields: unknown[];
}

function dataSchemaSpec(schemaKind: DataSchemaKind): DataSchemaSpec {
  return schemaKind === 'command'
    ? { ownerKey: 'commandNodeId', containerKey: 'input', oppositeContainerKey: 'payload', expectedKind: 'cmd', label: 'Command schema' }
    : { ownerKey: 'eventNodeId', containerKey: 'payload', oppositeContainerKey: 'input', expectedKind: 'evt', label: 'Event schema' };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function validateDataSchemaEnvelope(
  errors: ValidationError[],
  graph: Graph,
  schema: unknown,
  schemaKind: DataSchemaKind,
): ValidDataSchemaEnvelope | null {
  const spec = dataSchemaSpec(schemaKind);
  const schemaRecord = asRecord(schema);
  if (!schemaRecord) {
    errors.push({
      code: 'EMV-063',
      message: `${spec.label} must be a YAML object`,
      details: { schemaKind },
    });
    return null;
  }

  const schemaNodeId = schemaRecord[spec.ownerKey];
  if (typeof schemaNodeId !== 'string' || !schemaNodeId) {
    errors.push({
      code: 'EMV-063',
      message: `${spec.label} is missing "${spec.ownerKey}"`,
      details: { schemaKind, ownerKey: spec.ownerKey },
    });
    return null;
  }

  validateSchemaTarget(errors, graph, schemaNodeId, spec.expectedKind, spec.label);

  if (Object.prototype.hasOwnProperty.call(schemaRecord, spec.oppositeContainerKey)) {
    errors.push({
      code: 'EMV-063',
      message: `${spec.label} "${schemaNodeId}" must not contain "${spec.oppositeContainerKey}"`,
      details: { schemaNodeId, schemaKind, invalidContainerKey: spec.oppositeContainerKey },
    });
  }

  const container = asRecord(schemaRecord[spec.containerKey]);
  if (!container || !Array.isArray(container.fields)) {
    errors.push({
      code: 'EMV-063',
      message: `${spec.label} "${schemaNodeId}" must contain "${spec.containerKey}.fields"`,
      details: { schemaNodeId, schemaKind, containerKey: spec.containerKey },
    });
    return null;
  }

  return { schemaNodeId, fields: container.fields };
}

function validateSchemaTarget(
  errors: ValidationError[],
  graph: Graph,
  schemaNodeId: string,
  expectedKind: Node['kind'],
  label: string,
): void {
  const node = graph.nodes.get(schemaNodeId);
  if (node?.kind === expectedKind) return;
  errors.push({
    code: 'EMV-060',
    message: `${label} "${schemaNodeId}" must target a ${expectedKind} node`,
    details: {
      schemaNodeId,
      expectedKind,
      actualKind: node?.kind ?? null,
    },
  });
}

function validateRequiredSchemaFields(
  errors: ValidationError[],
  schemaNodeId: string,
  fields: unknown[],
  schemaKind: 'command' | 'event',
): void {
  const seen = new Set<string>();
  for (const field of fields) {
    const fieldRecord = asRecord(field);
    if (
      !fieldRecord ||
      typeof fieldRecord.fieldId !== 'string' ||
      !fieldRecord.fieldId ||
      typeof fieldRecord.name !== 'string' ||
      !fieldRecord.name ||
      typeof fieldRecord.type !== 'string' ||
      !fieldRecord.type ||
      typeof fieldRecord.required !== 'boolean'
    ) {
      errors.push({
        code: 'EMV-061',
        message: `${schemaKind} schema "${schemaNodeId}" has an invalid field definition`,
        details: { schemaNodeId, fieldId: fieldRecord?.fieldId ?? null, schemaKind },
      });
      continue;
    }
    if (seen.has(fieldRecord.fieldId)) {
      errors.push({
        code: 'EMV-062',
        message: `${schemaKind} schema "${schemaNodeId}" has duplicate field "${fieldRecord.fieldId}"`,
        details: { schemaNodeId, fieldId: fieldRecord.fieldId, schemaKind },
      });
    }
    seen.add(fieldRecord.fieldId);
  }
}

function indexEventSchemas(graph: Graph, eventSchemas: EventSchema[]): Map<string, EventSchema> {
  const byNodeId = new Map<string, EventSchema>();
  for (const schema of eventSchemas) {
    const envelope = getEventSchemaEnvelope(schema);
    if (!envelope) continue;
    byNodeId.set(envelope.schemaNodeId, schema);
    const node = graph.nodes.get(envelope.schemaNodeId);
    if (node) {
      byNodeId.set(node.id, schema);
      byNodeId.set(node.canonicalId, schema);
    }
  }
  return byNodeId;
}

function getEventSchemaEnvelope(schema: unknown): ValidDataSchemaEnvelope | null {
  const schemaRecord = asRecord(schema);
  if (!schemaRecord || typeof schemaRecord.eventNodeId !== 'string' || !schemaRecord.eventNodeId) return null;
  const payload = asRecord(schemaRecord.payload);
  if (!payload || !Array.isArray(payload.fields)) return null;
  return { schemaNodeId: schemaRecord.eventNodeId, fields: payload.fields };
}

function eventSchemaHasPayloadPath(schema: EventSchema, path: string): boolean {
  const normalizedPath = path.startsWith('payload.') ? path.slice('payload.'.length) : path;
  const envelope = getEventSchemaEnvelope(schema);
  return (envelope?.fields ?? []).some(rawField => {
    const field = asRecord(rawField);
    if (!field) return false;
    const fieldId = typeof field.fieldId === 'string' ? field.fieldId : '';
    const name = typeof field.name === 'string' ? field.name : '';
    const normalizedFieldIds = new Set([
      fieldId,
      name,
      `payload.${fieldId}`,
      `payload.${name}`,
    ]);
    return normalizedFieldIds.has(path) || fieldId === normalizedPath || name === normalizedPath;
  });
}

function checkEndToEndLoop(graph: Graph, cmdIds: string[], edges: Edge[]): boolean {
  const cmdIdSet = new Set(cmdIds);
  const cmdEvents = edges.filter(e => e.type === 'commandCausesEvent' && cmdIdSet.has(e.fromNodeId));
  if (cmdEvents.length === 0) return false;

  for (const cmdEvt of cmdEvents) {
    const evtId = cmdEvt.toNodeId;
    const hasRefresh = edges.some(e => e.type === 'eventRefreshesViewModel' && e.fromNodeId === evtId);
    if (hasRefresh) return true;
    const hasProcUpdate = edges.some(e => e.type === 'eventUpdatesProcessor' && e.fromNodeId === evtId);
    if (hasProcUpdate) return true;
  }
  return false;
}
