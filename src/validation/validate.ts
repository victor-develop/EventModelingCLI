import { Node, Edge, ViewModelSchema } from '../domain/types';
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
): ValidationError[] {
  const errors: ValidationError[] = [];
  const graph = buildGraph(nodes, edges);

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
    const resolved = graph.nodes.get(cmdId)?.id ?? cmdId;
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
      }
    }
  }

  for (const edge of edges) {
    if (edge.type === 'uiOrProcessorConsumesViewModel' && edge.meta?.fieldRefs) {
      const fieldRefs = edge.meta.fieldRefs as string[];
      const vmSchema = vmSchemas.find(s => s.viewModelNodeId === edge.toNodeId);
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

function checkEndToEndLoop(graph: Graph, cmdId: string, edges: Edge[]): boolean {
  const cmdEvents = edges.filter(e => e.type === 'commandCausesEvent' && (e.fromNodeId === cmdId));
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
