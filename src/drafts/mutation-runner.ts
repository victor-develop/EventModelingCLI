import {
  CommandSchema,
  Draft,
  DraftOp,
  DraftOpAction,
  DraftOpTarget,
  Edge,
  EventSchema,
  Node,
  Proposal,
  ViewModelSchema,
} from '../domain/types';
import { CLIResult, errResult } from '../domain/types';
import { Workspace } from '../workspace/workspace';

type EntityType = DraftOp['entityType'];

export interface MutationRecordOptions {
  action: DraftOpAction;
  entityType: EntityType;
  entityId: string;
  target: DraftOpTarget;
  before: unknown | null;
  after: unknown | null;
  changedFields?: string[];
  references?: DraftOp['references'];
  details?: Record<string, unknown>;
}

export class MutationRunner {
  private readonly transactionId: string;

  constructor(
    private readonly ws: Workspace,
    private readonly draft: Draft,
    private readonly commandName: string,
  ) {
    this.transactionId = `${draft.id}_tx_${Date.now()}_${draft.ops.length + 1}`;
  }

  get draftId(): string {
    return this.draft.id;
  }

  saveNode(node: Node, action: DraftOpAction = 'add', before: unknown | null = null): void {
    this.record({
      action,
      entityType: 'node',
      entityId: node.canonicalId,
      target: {
        filePath: `nodes/${node.canonicalId}.yaml`,
        nodeKind: node.kind,
      },
      before,
      after: node,
    }, () => this.ws.saveNode(node));
  }

  saveEdge(edge: Edge, action: DraftOpAction = 'add', before: unknown | null = null): void {
    this.record({
      action,
      entityType: 'edge',
      entityId: edge.id,
      target: {
        filePath: `edges/${edge.id}.yaml`,
        edgeType: edge.type,
      },
      before,
      after: edge,
      references: { nodes: [edge.fromNodeId, edge.toNodeId, ...(edge.viaNodeId ? [edge.viaNodeId] : [])] },
    }, () => this.ws.saveEdge(edge));
  }

  saveCommandSchema(
    schema: CommandSchema,
    action: DraftOpAction,
    before: unknown | null,
    after: unknown | null,
    options: { fieldId?: string; jsonPointer?: string; changedFields?: string[] } = {},
  ): void {
    this.recordSchema('command', schema.commandNodeId, action, before, after, options, () => this.ws.saveCommandSchema(schema));
  }

  saveEventSchema(
    schema: EventSchema,
    action: DraftOpAction,
    before: unknown | null,
    after: unknown | null,
    options: { fieldId?: string; jsonPointer?: string; changedFields?: string[] } = {},
  ): void {
    this.recordSchema('event', schema.eventNodeId, action, before, after, options, () => this.ws.saveEventSchema(schema));
  }

  saveViewModelSchema(
    schema: ViewModelSchema,
    action: DraftOpAction,
    before: unknown | null,
    after: unknown | null,
    options: { fieldId?: string; jsonPointer?: string; changedFields?: string[] } = {},
  ): void {
    this.recordSchema('viewModel', schema.viewModelNodeId, action, before, after, options, () => this.ws.saveViewModelSchema(schema));
  }

  saveProposal(proposal: Proposal, action: DraftOpAction = 'add', before: unknown | null = null): void {
    const referencedNodes = new Set<string>([
      proposal.storyId,
      ...proposal.candidateRootCommandIds,
      ...proposal.resolvedSubgraph.coreNodes,
      ...proposal.resolvedSubgraph.interfaceNodes,
      ...proposal.resolvedSubgraph.boundaryNodes,
    ]);
    this.record({
      action,
      entityType: 'proposal',
      entityId: proposal.id,
      target: {
        filePath: `proposals/${proposal.id}.yaml`,
      },
      before,
      after: proposal,
      references: { nodes: [...referencedNodes] },
    }, () => this.ws.saveProposal(proposal));
  }

  private recordSchema(
    schemaKind: 'command' | 'event' | 'viewModel',
    ownerNodeId: string,
    action: DraftOpAction,
    before: unknown | null,
    after: unknown | null,
    options: { fieldId?: string; jsonPointer?: string; changedFields?: string[] },
    applyWrite: () => void,
  ): void {
    const filePath = schemaKind === 'viewModel'
      ? `view-model-schemas/${ownerNodeId}.schema.yaml`
      : `schemas/${ownerNodeId}.schema.yaml`;
    const entityId = options.fieldId ? `${ownerNodeId}#${options.fieldId}` : ownerNodeId;
    this.record({
      action,
      entityType: 'schema',
      entityId,
      target: {
        filePath,
        schemaKind,
        ownerNodeId,
        fieldId: options.fieldId,
        jsonPointer: options.jsonPointer,
      },
      before,
      after,
      changedFields: options.changedFields,
      references: { nodes: [ownerNodeId] },
    }, applyWrite);
  }

  private record(options: MutationRecordOptions, applyWrite: () => void): void {
    const seq = this.draft.ops.length + 1;
    const op: DraftOp = {
      version: 2,
      opId: `${this.draft.id}_op_${String(seq).padStart(4, '0')}`,
      transactionId: this.transactionId,
      seq,
      command: this.commandName,
      op: options.action,
      action: options.action,
      entityType: options.entityType,
      entityId: options.entityId,
      timestamp: new Date().toISOString(),
      target: options.target,
      before: cloneSnapshot(options.before),
      after: cloneSnapshot(options.after),
      changedFields: options.changedFields,
      references: options.references,
      details: options.details,
    };
    const previousLength = this.draft.ops.length;
    this.draft.ops.push(op);
    this.ws.saveDraft(this.draft);
    try {
      applyWrite();
    } catch (error) {
      this.draft.ops.splice(previousLength);
      this.ws.saveDraft(this.draft);
      throw error;
    }
  }
}

export function requireMutationRunner(ws: Workspace, commandName: string): MutationRunner | CLIResult {
  const ctx = ws.getContext();
  if (!ctx?.draft || ctx.draft.status !== 'open') {
    return errResult(commandName, 'NO_DRAFT', 'No active draft. Run em draft start.');
  }
  return new MutationRunner(ws, ctx.draft, commandName);
}

function cloneSnapshot<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
