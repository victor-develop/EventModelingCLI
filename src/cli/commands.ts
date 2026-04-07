import { Workspace } from '../workspace/workspace';
import { CLIResult, okResult, errResult, Node, Draft, Proposal, DraftOp } from '../domain/types';
import { buildGraph, getNeighbors, walkGraph, tracePath, toMermaid, NeighborResult, resolveNodeId } from '../graph/graph-builder';
import { lintCanonicalId } from '../validation/lint';
import { validate } from '../validation/validate';

function requireProject(ws: Workspace): { manifest: ReturnType<Workspace['getManifest']>; dir: string } | CLIResult {
  const manifest = ws.getManifest();
  if (!manifest) return errResult('', 'NO_PROJECT', 'No active project. Run em project init or em project open.');
  return { manifest, dir: ws.getProjectDir()! };
}

function requireDraft(ws: Workspace): { draft: Draft } | { error: CLIResult } {
  const ctx = ws.getContext();
  if (!ctx?.draft || ctx.draft.status !== 'open') {
    return { error: errResult('', 'NO_DRAFT', 'No active draft. Run em draft start.') };
  }
  return { draft: ctx.draft };
}

function isDraftResult(r: ReturnType<typeof requireDraft>): r is { draft: Draft } {
  return 'draft' in r;
}

function addDraftOp(ws: Workspace, op: string, entityType: 'node' | 'edge' | 'schema', entityId: string, details?: Record<string, unknown>): void {
  const ctx = ws.getContext();
  if (!ctx?.draft || ctx.draft.status !== 'open') return;
  const draft = ctx.draft;
  draft.ops.push({
    op,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    details,
  });
  ws.saveDraft(draft);
}

function resolveNodeArg(ws: Workspace, idOrCanonical: string): string | null {
  const node = ws.getNode(idOrCanonical);
  return node?.canonicalId ?? null;
}

export function projectInit(ws: Workspace, name: string): CLIResult {
  const { projectDir, manifest } = ws.initProject(name);
  return okResult('em project init', {
    project: {
      id: manifest.id,
      name: manifest.name,
      headRevisionId: manifest.headRevisionId,
    },
  }, { projectId: manifest.id });
}

export function projectOpen(ws: Workspace, idOrName: string): CLIResult {
  const manifest = ws.openProject(idOrName);
  if (!manifest) return errResult('em project open', 'NOT_FOUND', `Project "${idOrName}" not found`);
  const revision = manifest.headRevisionId ? ws.getRevision(manifest.headRevisionId) : null;
  return okResult('em project open', {
    project: {
      id: manifest.id,
      name: manifest.name,
      headRevisionId: manifest.headRevisionId,
    },
    currentRevision: revision ? { id: revision.id, message: revision.message } : null,
  }, { projectId: manifest.id, revisionId: manifest.headRevisionId ?? undefined });
}

export function ctx(ws: Workspace): CLIResult {
  const c = ws.getContext();
  if (!c) return errResult('em ctx', 'NO_PROJECT', 'No active project');
  const result: Record<string, unknown> = {
    project: { id: c.project.id, name: c.project.name },
    headRevision: c.project.headRevisionId ? { id: c.project.headRevisionId } : null,
    draft: null,
  };
  if (c.draft) {
    result.draft = { id: c.draft.id, status: c.draft.status };
  }
  if (c.revision) {
    result.headRevision = { id: c.revision.id, message: c.revision.message };
  }
  return okResult('em ctx', result, {
    projectId: c.project.id,
    draftId: c.draft?.id,
    revisionId: c.revision?.id,
  });
}

export function draftStart(ws: Workspace, message: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const draftId = ws.generateDraftId();
  const draft: Draft = {
    id: draftId,
    projectId: manifest.id,
    baseRevisionId: manifest.headRevisionId ?? 'rev_000',
    status: 'open',
    message,
    ops: [],
    proposals: [],
  };
  ws.saveDraft(draft);
  ws.setActiveDraft(draftId);
  return okResult('em draft start', {
    draft: {
      id: draft.id,
      baseRevisionId: draft.baseRevisionId,
      status: draft.status,
      message: draft.message,
    },
  }, { projectId: manifest.id, draftId, revisionId: manifest.headRevisionId ?? undefined });
}

export function draftStatus(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const dr = requireDraft(ws);
  if (!isDraftResult(dr)) return dr.error;
  const draft = dr.draft;
  const nodesAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'node').length;
  const nodesUpdated = draft.ops.filter((o: DraftOp) => o.op === 'update' && o.entityType === 'node').length;
  const edgesAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'edge').length;
  const fieldsAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'schema').length;
  return okResult('em draft status', {
    draft: { id: draft.id, status: draft.status, baseRevisionId: draft.baseRevisionId },
    summary: { nodesAdded, nodesUpdated, edgesAdded, fieldsAdded },
  }, { projectId: ws.getManifest()!.id, draftId: draft.id });
}

export function draftDiff(ws: Workspace, format: string = 'json'): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const dr = requireDraft(ws);
  if (!isDraftResult(dr)) return dr.error;
  const draft = dr.draft;
  const nodesAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'node').map((o: DraftOp) => o.entityId);
  const nodesUpdated = draft.ops.filter((o: DraftOp) => o.op === 'update' && o.entityType === 'node').map((o: DraftOp) => o.entityId);
  const edgesAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'edge').map((o: DraftOp) => o.entityId);
  const fieldsAdded = draft.ops.filter((o: DraftOp) => o.op === 'add' && o.entityType === 'schema').map((o: DraftOp) => o.entityId);
  const diffData: Record<string, unknown> = { nodesAdded, nodesUpdated, edgesAdded, fieldsAdded };
  if (format === 'mermaid') {
    const nodes = ws.listNodes();
    const edges = ws.listEdges();
    const graph = buildGraph(nodes, edges);
    diffData.mermaid = toMermaid(graph);
  }
  return okResult('em draft diff', { format, diff: diffData }, {
    projectId: ws.getManifest()!.id,
    draftId: draft.id,
  });
}

export function submit(ws: Workspace, message: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const dr = requireDraft(ws);
  if (!isDraftResult(dr)) return dr.error;
  const draft = dr.draft;
  const manifest = ws.getManifest()!;
  draft.status = 'submitted';
  ws.saveDraft(draft);
  const revId = ws.generateRevisionId();
  const revision = {
    id: revId,
    projectId: manifest.id,
    parentRevisionId: manifest.headRevisionId,
    message,
    createdAt: new Date().toISOString(),
    author: 'user',
  };
  ws.saveRevision(revision);
  ws.updateManifest({ headRevisionId: revId });
  ws.setActiveDraft('');
  ws.setCheckedOutRevision(revId);
  return okResult('em submit', {
    submittedDraftId: draft.id,
    newRevision: { id: revId, message },
  }, { projectId: manifest.id, draftId: draft.id, revisionId: revId });
}

export function versions(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const revisions = ws.listRevisions();
  return okResult('em versions', {
    revisions: revisions.map(r => ({ id: r.id, message: r.message, createdAt: r.createdAt })),
  }, { projectId: ws.getManifest()!.id });
}

export function checkout(ws: Workspace, revId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const rev = ws.getRevision(revId);
  if (!rev) return errResult('em checkout', 'NOT_FOUND', `Revision "${revId}" not found`);
  ws.setCheckedOutRevision(revId);
  return okResult('em checkout', {
    revision: { id: rev.id, message: rev.message },
    project: { id: ws.getManifest()!.id, name: ws.getManifest()!.name },
  }, { projectId: ws.getManifest()!.id, revisionId: revId });
}

export function cmdNew(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em cmd new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const lintErrors = lintCanonicalId(canonicalId, 'cmd', new Set(ws.listNodes().map(n => n.canonicalId)));
  const warnings = lintErrors.map(e => e.message);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'cmd',
    canonicalId,
    displayName: displayName ?? canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
  };
  ws.saveNode(node);
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em cmd new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function evtNew(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em evt new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const lintErrors = lintCanonicalId(canonicalId, 'evt', new Set(ws.listNodes().map(n => n.canonicalId)));
  const warnings = lintErrors.map(e => e.message);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'evt',
    canonicalId,
    displayName: displayName ?? canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
  };
  ws.saveNode(node);
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em evt new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function viewNew(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em view new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const lintErrors = lintCanonicalId(canonicalId, 'viewModel', new Set(ws.listNodes().map(n => n.canonicalId)));
  const warnings = lintErrors.map(e => e.message);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'viewModel',
    canonicalId,
    displayName: displayName ?? canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
  };
  ws.saveNode(node);
  ws.saveViewModelSchema({ viewModelNodeId: canonicalId, fields: [] });
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em view new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function procNew(ws: Workspace, canonicalId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em proc new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'proc',
    canonicalId,
    displayName: canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
  };
  ws.saveNode(node);
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em proc new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function triggerNew(ws: Workspace, canonicalId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em trigger new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'trigger',
    canonicalId,
    displayName: canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
  };
  ws.saveNode(node);
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em trigger new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function storyAdd(ws: Workspace, level: string, title: string, parentId?: string, roleId?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const kind = `story.${level}` as Node['kind'];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalId = `story.${slug}`;
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind,
    canonicalId,
    displayName: title,
    tags: [],
    domains: [],
    role: roleId,
  };
  ws.saveNode(node);
  if (parentId) {
    const edgeId = ws.generateEdgeId();
    ws.saveEdge({
      id: edgeId,
      projectId: manifest.id,
      type: 'parentOf',
      fromNodeId: parentId,
      toNodeId: canonicalId,
    });
    addDraftOp(ws, 'add', 'edge', edgeId);
  }
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em story add', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function storyTree(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes().filter(n => n.kind.startsWith('story.'));
  const edges = ws.listEdges().filter(e => e.type === 'parentOf');
  const childSet = new Set(edges.map(e => e.toNodeId));
  const roots = nodes.filter(n => !childSet.has(n.canonicalId) && !childSet.has(n.id));
  const buildTree = (parentId: string): any[] => {
    const children = edges
      .filter(e => e.fromNodeId === parentId || e.fromNodeId === (ws.getNode(parentId)?.canonicalId ?? parentId))
      .map(e => {
        const child = ws.getNode(e.toNodeId);
        return child ? { id: child.id, kind: child.kind, displayName: child.displayName, children: buildTree(child.canonicalId) } : null;
      })
      .filter(Boolean);
    return children;
  };
  const tree = roots.map(r => ({
    id: r.id,
    kind: r.kind,
    displayName: r.displayName,
    children: buildTree(r.canonicalId),
  }));
  return okResult('em story tree', { tree }, { projectId: ws.getManifest()!.id });
}

export function uiAdd(ws: Workspace, uiKind: string, name: string, parentId?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const kind = `ui.${uiKind}` as Node['kind'];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalId = `ui.${uiKind}.${slug}`;
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind,
    canonicalId,
    displayName: name,
    tags: [],
    domains: [],
  };
  ws.saveNode(node);
  if (parentId) {
    const edgeId = ws.generateEdgeId();
    ws.saveEdge({
      id: edgeId,
      projectId: manifest.id,
      type: 'parentOf',
      fromNodeId: parentId,
      toNodeId: canonicalId,
    });
    addDraftOp(ws, 'add', 'edge', edgeId);
  }
  addDraftOp(ws, 'add', 'node', canonicalId);
  const ctx = ws.getContext();
  return okResult('em ui add', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function uiTree(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes().filter(n => n.kind.startsWith('ui.'));
  const edges = ws.listEdges().filter(e => e.type === 'parentOf');
  const childSet = new Set(edges.map(e => e.toNodeId));
  const roots = nodes.filter(n => !childSet.has(n.canonicalId) && !childSet.has(n.id));
  const buildTree = (parentId: string): any[] => {
    const children = edges
      .filter(e => e.fromNodeId === parentId || e.fromNodeId === (ws.getNode(parentId)?.canonicalId ?? parentId))
      .map(e => {
        const child = ws.getNode(e.toNodeId);
        return child ? { id: child.id, kind: child.kind, displayName: child.displayName, children: buildTree(child.canonicalId) } : null;
      })
      .filter(Boolean);
    return children;
  };
  const tree = roots.map(r => ({
    id: r.id,
    kind: r.kind,
    displayName: r.displayName,
    children: buildTree(r.canonicalId),
  }));
  return okResult('em ui tree', { tree }, { projectId: ws.getManifest()!.id });
}

export function linkCmdEvt(ws: Workspace, cmdId: string, evtId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const cmd = ws.getNode(cmdId);
  if (!cmd) return errResult('em link cmd->evt', 'NOT_FOUND', `Command "${cmdId}" not found`);
  const evt = ws.getNode(evtId);
  if (!evt) return errResult('em link cmd->evt', 'NOT_FOUND', `Event "${evtId}" not found`);
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'commandCausesEvent' as const,
    fromNodeId: cmd.canonicalId,
    toNodeId: evt.canonicalId,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em link cmd->evt', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function linkEvtView(ws: Workspace, evtId: string, viewModelId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const evt = ws.getNode(evtId);
  if (!evt) return errResult('em link evt->view', 'NOT_FOUND', `Event "${evtId}" not found`);
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em link evt->view', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'eventRefreshesViewModel' as const,
    fromNodeId: evt.canonicalId,
    toNodeId: view.canonicalId,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em link evt->view', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function uiBindView(ws: Workspace, uiId: string, viewModelId: string, fields?: string[]): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const ui = ws.getNode(uiId);
  if (!ui) return errResult('em ui bind-view', 'NOT_FOUND', `UI "${uiId}" not found`);
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em ui bind-view', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const edgeId = ws.generateEdgeId();
  const meta: Record<string, unknown> = {};
  if (fields && fields.length > 0) {
    meta.fieldRefs = fields;
  }
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'uiOrProcessorConsumesViewModel' as const,
    fromNodeId: ui.canonicalId,
    toNodeId: view.canonicalId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em ui bind-view', {
    edge: {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      meta: edge.meta ?? {},
    },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function uiExposeCmd(ws: Workspace, roleId: string, uiId: string, cmdId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const role = ws.getNode(roleId);
  const ui = ws.getNode(uiId);
  const cmd = ws.getNode(cmdId);
  if (!cmd) return errResult('em ui expose-cmd', 'NOT_FOUND', `Command "${cmdId}" not found`);
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'roleUsesUIToIssueCommand' as const,
    fromNodeId: role?.canonicalId ?? roleId,
    toNodeId: cmd.canonicalId,
    viaNodeId: ui?.canonicalId ?? uiId,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em ui expose-cmd', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, viaNodeId: edge.viaNodeId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function procBindView(ws: Workspace, procId: string, viewModelId: string, fields?: string[]): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const proc = ws.getNode(procId);
  if (!proc) return errResult('em proc bind-view', 'NOT_FOUND', `Processor "${procId}" not found`);
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em proc bind-view', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const edgeId = ws.generateEdgeId();
  const meta: Record<string, unknown> = {};
  if (fields && fields.length > 0) {
    meta.fieldRefs = fields;
  }
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'uiOrProcessorConsumesViewModel' as const,
    fromNodeId: proc.canonicalId,
    toNodeId: view.canonicalId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em proc bind-view', {
    edge: {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      meta: edge.meta ?? {},
    },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function triggerIssuesCmd(ws: Workspace, triggerId: string, cmdId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const trigger = ws.getNode(triggerId);
  if (!trigger) return errResult('em trigger issues-cmd', 'NOT_FOUND', `Trigger "${triggerId}" not found`);
  const cmd = ws.getNode(cmdId);
  if (!cmd) return errResult('em trigger issues-cmd', 'NOT_FOUND', `Command "${cmdId}" not found`);
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'processorOrTriggerIssuesCommand' as const,
    fromNodeId: trigger.canonicalId,
    toNodeId: cmd.canonicalId,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em trigger issues-cmd', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function storyBind(ws: Workspace, storyId: string, cmdId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const manifest = ws.getManifest()!;
  const story = ws.getNode(storyId);
  if (!story) return errResult('em story bind', 'NOT_FOUND', `Story "${storyId}" not found`);
  const cmd = ws.getNode(cmdId);
  if (!cmd) return errResult('em story bind', 'NOT_FOUND', `Command "${cmdId}" not found`);
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'storyOwnsCommand' as const,
    fromNodeId: story.canonicalId,
    toNodeId: cmd.canonicalId,
  };
  ws.saveEdge(edge);
  addDraftOp(ws, 'add', 'edge', edgeId);
  const ctx = ws.getContext();
  return okResult('em story bind', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

export function viewFieldAdd(
  ws: Workspace, viewModelId: string, fieldId: string, name: string,
  type: string, fromEvent: string, path: string, nullable: boolean = false,
): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em view field add', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const schema = ws.getViewModelSchema(view.canonicalId) ?? { viewModelNodeId: view.canonicalId, fields: [] };
  const field = {
    fieldId,
    name,
    type,
    nullable,
    source: { eventNodeId: fromEvent, eventFieldPath: path },
  };
  schema.fields.push(field);
  ws.saveViewModelSchema(schema);
  addDraftOp(ws, 'add', 'schema', fieldId, { viewModelId: view.canonicalId });
  const ctx = ws.getContext();
  return okResult('em view field add', { field }, { projectId: ws.getManifest()!.id, draftId: ctx?.draft?.id });
}

export function viewFieldEdit(ws: Workspace, viewModelId: string, fieldId: string, updates: Record<string, unknown>): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em view field edit', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const schema = ws.getViewModelSchema(view.canonicalId);
  if (!schema) return errResult('em view field edit', 'NOT_FOUND', `Schema for "${viewModelId}" not found`);
  const field = schema.fields.find(f => f.fieldId === fieldId);
  if (!field) return errResult('em view field edit', 'NOT_FOUND', `Field "${fieldId}" not found`);
  if (updates['name']) field.name = updates['name'] as string;
  if (updates['type']) field.type = updates['type'] as string;
  if ('nullable' in updates) field.nullable = updates['nullable'] as boolean;
  ws.saveViewModelSchema(schema);
  const ctx = ws.getContext();
  return okResult('em view field edit', { field: { fieldId: field.fieldId, name: field.name, type: field.type, nullable: field.nullable } }, { projectId: ws.getManifest()!.id, draftId: ctx?.draft?.id });
}

export function viewFieldRm(ws: Workspace, viewModelId: string, fieldId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em view field rm', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const schema = ws.getViewModelSchema(view.canonicalId);
  if (!schema) return errResult('em view field rm', 'NOT_FOUND', `Schema for "${viewModelId}" not found`);
  schema.fields = schema.fields.filter(f => f.fieldId !== fieldId);
  ws.saveViewModelSchema(schema);
  const ctx = ws.getContext();
  return okResult('em view field rm', { removedFieldId: fieldId, viewModelId: view.canonicalId }, { projectId: ws.getManifest()!.id, draftId: ctx?.draft?.id });
}

export function viewSchemaShow(ws: Workspace, viewModelId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em view schema show', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const schema = ws.getViewModelSchema(view.canonicalId);
  return okResult('em view schema show', {
    viewModelId: view.canonicalId,
    fields: (schema?.fields ?? []).map(f => ({ fieldId: f.fieldId, name: f.name, type: f.type, nullable: f.nullable, source: f.source })),
  }, { projectId: ws.getManifest()!.id });
}

export function show(ws: Workspace, idOrCanonical: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const node = ws.getNode(idOrCanonical);
  if (!node) return errResult('em show', 'NOT_FOUND', `Node "${idOrCanonical}" not found`);
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const resolved = resolveNodeId(graph, node.canonicalId);
  const incoming: string[] = [];
  const outgoing: string[] = [];
  if (resolved) {
    for (const e of graph.incoming.get(resolved) ?? []) { incoming.push(e.id); }
    for (const e of graph.outgoing.get(resolved) ?? []) { outgoing.push(e.id); }
  }
  return okResult('em show', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
    relations: { incoming, outgoing },
  }, { projectId: ws.getManifest()!.id });
}

export function neighbors(ws: Workspace, nodeId: string, direction: string = 'both', edgeTypes?: string[], limit?: number): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const results = getNeighbors(graph, nodeId, direction as 'in' | 'out' | 'both', edgeTypes as any[], limit);
  return okResult('em neighbors', {
    center: nodeId,
    direction,
    neighbors: results,
    hasMore: false,
  }, { projectId: ws.getManifest()!.id });
}

export function walk(ws: Workspace, fromId: string, direction: string = 'forward', edgeTypes?: string[], maxHops?: number, limit?: number): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const result = walkGraph(graph, fromId, direction as any, edgeTypes as any[], maxHops, limit);
  const data: Record<string, unknown> = {
    from: fromId,
    direction,
    maxHops: maxHops ?? 5,
    subgraph: {
      root: graph.nodes.get(fromId) ? { nodeId: fromId, nodeKind: graph.nodes.get(fromId)!.kind } : null,
    },
    frontier: result.frontier,
  };
  if (direction === 'both') {
    (data.subgraph as any).backwardBranches = result.backwardBranches;
    (data.subgraph as any).forwardBranches = result.forwardBranches;
  } else {
    (data.subgraph as any).branches = result.branches;
  }
  return okResult('em walk', data, { projectId: ws.getManifest()!.id });
}

export function trace(ws: Workspace, fromId: string, toId: string, maxHops?: number): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const paths = tracePath(graph, fromId, toId, maxHops);
  return okResult('em trace', { paths }, { projectId: ws.getManifest()!.id });
}

export function graph(ws: Workspace, focusId?: string, depth?: number, format: string = 'mermaid'): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const g = buildGraph(nodes, edges);
  const mermaidStr = toMermaid(g, focusId, depth);
  return okResult('em graph', { format, graph: mermaidStr }, { projectId: ws.getManifest()!.id });
}

export function emValidate(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const vmSchemas: import('../domain/types').ViewModelSchema[] = [];
  for (const n of nodes) {
    if (n.kind === 'viewModel') {
      const schema = ws.getViewModelSchema(n.canonicalId);
      if (schema) vmSchemas.push(schema);
    }
  }
  const errors = validate(nodes, edges, vmSchemas);
  return okResult('em validate', {
    valid: errors.length === 0,
    errors: errors.map(e => ({ code: e.code, message: e.message, details: e.details })),
  }, { projectId: ws.getManifest()!.id, draftId: ws.getContext()?.draft?.id });
}

export function emReview(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const ctx = ws.getContext();
  const draft = ctx?.draft;
  if (!draft) return errResult('em review', 'NO_DRAFT', 'No active draft');
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const cmdCount = nodes.filter(n => n.kind === 'cmd').length;
  const evtCount = nodes.filter(n => n.kind === 'evt').length;
  const viewCount = nodes.filter(n => n.kind === 'viewModel').length;
  const storyCount = nodes.filter(n => n.kind.startsWith('story.')).length;
  const findings: string[] = [];
  if (cmdCount > 0) findings.push(`Project has ${cmdCount} command(s)`);
  if (evtCount > 0) findings.push(`Project has ${evtCount} event(s)`);
  if (viewCount > 0) findings.push(`Project has ${viewCount} view model(s)`);
  const changedNodes = draft.ops.filter(o => o.op === 'add' && o.entityType === 'node').length;
  findings.push(`Draft changes ${changedNodes} node(s)`);
  return okResult('em review', {
    summary: {
      riskLevel: changedNodes > 5 ? 'high' : changedNodes > 2 ? 'medium' : 'low',
      changedStories: storyCount,
      changedCommands: cmdCount,
      changedEvents: evtCount,
      changedViews: viewCount,
    },
    findings,
  }, { projectId: ws.getManifest()!.id, draftId: draft.id });
}

export function reviewImpactEvt(ws: Workspace, evtId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const evt = ws.getNode(evtId);
  if (!evt) return errResult('em review impact evt', 'NOT_FOUND', `Event "${evtId}" not found`);
  const resolved = resolveNodeId(graph, evt.canonicalId);
  const affectedViewModels: string[] = [];
  const affectedProcessors: string[] = [];
  const affectedUiNodes: string[] = [];
  if (resolved) {
    const outEdges = graph.outgoing.get(resolved) ?? [];
    for (const e of outEdges) {
      const target = graph.nodes.get(e.toNodeId);
      if (!target) continue;
      if (e.type === 'eventRefreshesViewModel') affectedViewModels.push(target.canonicalId);
      if (e.type === 'eventUpdatesProcessor') affectedProcessors.push(target.canonicalId);
    }
    for (const vmId of affectedViewModels) {
      const vmResolved = resolveNodeId(graph, vmId);
      if (vmResolved) {
        const consumers = graph.outgoing.get(vmResolved) ?? [];
        for (const c of consumers) {
          if (c.type === 'uiOrProcessorConsumesViewModel') {
            const consumer = graph.nodes.get(c.fromNodeId);
            if (consumer && consumer.kind.startsWith('ui.')) {
              if (!affectedUiNodes.includes(consumer.canonicalId)) {
                affectedUiNodes.push(consumer.canonicalId);
              }
            }
          }
        }
      }
    }
  }
  return okResult('em review impact evt', {
    eventId: evt.canonicalId,
    affectedViewModels,
    affectedProcessors,
    affectedUiNodes,
  }, { projectId: ws.getManifest()!.id, draftId: ws.getContext()?.draft?.id });
}

export function reviewImpactField(ws: Workspace, viewModelId: string, fieldId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const view = ws.getNode(viewModelId);
  if (!view) return errResult('em review impact field', 'NOT_FOUND', `ViewModel "${viewModelId}" not found`);
  const resolved = resolveNodeId(graph, view.canonicalId);
  const uiConsumers: string[] = [];
  const procConsumers: string[] = [];
  if (resolved) {
    const inEdges = graph.incoming.get(resolved) ?? [];
    for (const e of inEdges) {
      if (e.type === 'uiOrProcessorConsumesViewModel') {
        const fieldRefs = e.meta?.fieldRefs as string[] | undefined;
        if (!fieldRefs || fieldRefs.includes(fieldId)) {
          const consumer = graph.nodes.get(e.fromNodeId);
          if (consumer) {
            if (consumer.kind.startsWith('ui.')) uiConsumers.push(consumer.canonicalId);
            else if (consumer.kind === 'proc') procConsumers.push(consumer.canonicalId);
          }
        }
      }
    }
  }
  return okResult('em review impact field', {
    viewModelId: view.canonicalId,
    fieldId,
    consumers: { ui: uiConsumers, proc: procConsumers },
  }, { projectId: ws.getManifest()!.id, draftId: ws.getContext()?.draft?.id });
}

export function storySuggestBind(ws: Workspace, storyId: string, cmdIds: string[], mode: 'core' | 'full' = 'full'): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const story = ws.getNode(storyId);
  if (!story) return errResult('em story suggest-bind', 'NOT_FOUND', `Story "${storyId}" not found`);
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const proposalId = ws.generateProposalId();
  const coreNodes = new Set<string>();
  const interfaceNodes = new Set<string>();
  const boundaryNodes = new Set<string>();

  for (const cmdId of cmdIds) {
    coreNodes.add(cmdId);
    const resolved = resolveNodeId(graph, cmdId);
    if (!resolved) continue;
    const outEdges = graph.outgoing.get(resolved) ?? [];
    for (const e of outEdges) {
      if (e.type === 'commandCausesEvent') {
        coreNodes.add(e.toNodeId);
        const evtResolved = resolveNodeId(graph, e.toNodeId);
        if (evtResolved) {
          const evtOut = graph.outgoing.get(evtResolved) ?? [];
          for (const ve of evtOut) {
            if (ve.type === 'eventRefreshesViewModel') coreNodes.add(ve.toNodeId);
            if (ve.type === 'eventUpdatesProcessor') boundaryNodes.add(ve.toNodeId);
          }
        }
      }
    }
    if (mode === 'full') {
      const inEdges = graph.incoming.get(resolved) ?? [];
      for (const e of inEdges) {
        if (e.type === 'roleUsesUIToIssueCommand') {
          interfaceNodes.add(e.fromNodeId);
          if (e.viaNodeId) interfaceNodes.add(e.viaNodeId);
        }
      }
      const vmNodes = [...coreNodes].filter(id => {
        const n = graph.nodes.get(id);
        return n?.kind === 'viewModel';
      });
      for (const vmId of vmNodes) {
        const vmResolved = resolveNodeId(graph, vmId);
        if (vmResolved) {
          const vmIn = graph.incoming.get(vmResolved) ?? [];
          for (const ce of vmIn) {
            if (ce.type === 'uiOrProcessorConsumesViewModel') {
              const consumer = graph.nodes.get(ce.fromNodeId);
              if (consumer && consumer.kind.startsWith('ui.')) interfaceNodes.add(consumer.canonicalId);
              if (consumer && consumer.kind === 'proc') boundaryNodes.add(consumer.canonicalId);
            }
          }
        }
      }
    }
  }

  const proposal: Proposal = {
    id: proposalId,
    storyId: story.canonicalId,
    mode,
    candidateRootCommandIds: cmdIds,
    resolvedSubgraph: {
      coreNodes: [...coreNodes],
      interfaceNodes: [...interfaceNodes],
      boundaryNodes: [...boundaryNodes],
    },
    overrides: [],
  };
  ws.saveProposal(proposal);
  const ctx = ws.getContext();
  return okResult('em story suggest-bind', { proposal }, { projectId: ws.getManifest()!.id, draftId: ctx?.draft?.id });
}

export function storyReviseBind(ws: Workspace, proposalId: string, op: string, args: Record<string, unknown>): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const proposal = ws.getProposal(proposalId);
  if (!proposal) return errResult('em story revise-bind', 'NOT_FOUND', `Proposal "${proposalId}" not found`);
  const newId = ws.generateProposalId();
  const revised: Proposal = {
    ...JSON.parse(JSON.stringify(proposal)),
    id: newId,
    previousProposalId: proposalId,
  };

  switch (op) {
    case 'add-root': {
      const cmd = args['cmd'] as string;
      if (cmd && !revised.candidateRootCommandIds.includes(cmd)) {
        revised.candidateRootCommandIds.push(cmd);
      }
      break;
    }
    case 'remove-root': {
      const cmd = args['cmd'] as string;
      revised.candidateRootCommandIds = revised.candidateRootCommandIds.filter(c => c !== cmd);
      break;
    }
    case 'set-mode': {
      revised.mode = args['mode'] as 'core' | 'full';
      break;
    }
    case 'include-boundary': {
      const node = args['node'] as string;
      if (!revised.resolvedSubgraph.interfaceNodes.includes(node)) {
        revised.resolvedSubgraph.interfaceNodes.push(node);
      }
      break;
    }
    case 'exclude-boundary': {
      const node = args['node'] as string;
      revised.resolvedSubgraph.boundaryNodes = revised.resolvedSubgraph.boundaryNodes.filter(n => n !== node);
      break;
    }
    case 'include-path': {
      const path = args['path'] as string[];
      const reason = args['reason'] as string;
      revised.overrides.push({
        type: 'include-path',
        path,
        reason,
        createdBy: 'agent',
        createdAt: new Date().toISOString(),
      });
      for (const p of path) {
        if (!revised.resolvedSubgraph.coreNodes.includes(p) && !revised.resolvedSubgraph.interfaceNodes.includes(p)) {
          revised.resolvedSubgraph.coreNodes.push(p);
        }
      }
      break;
    }
    case 'exclude-path': {
      const path = args['path'] as string[];
      const reason = args['reason'] as string;
      revised.overrides.push({
        type: 'exclude-path',
        path,
        reason,
        createdBy: 'agent',
        createdAt: new Date().toISOString(),
      });
      for (const p of path) {
        revised.resolvedSubgraph.coreNodes = revised.resolvedSubgraph.coreNodes.filter(n => n !== p);
        revised.resolvedSubgraph.interfaceNodes = revised.resolvedSubgraph.interfaceNodes.filter(n => n !== p);
      }
      break;
    }
    case 'expand-downstream-from':
    case 'collapse-downstream-from': {
      break;
    }
  }

  ws.saveProposal(revised);
  const ctx = ws.getContext();
  return okResult('em story revise-bind', { proposal: revised }, { projectId: ws.getManifest()!.id, draftId: ctx?.draft?.id });
}

export function storyConfirmBind(ws: Workspace, storyId: string, proposalId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const proposal = ws.getProposal(proposalId);
  if (!proposal) return errResult('em story confirm-bind', 'NOT_FOUND', `Proposal "${proposalId}" not found`);
  const manifest = ws.getManifest()!;
  const createdEdges: any[] = [];
  for (const cmdId of proposal.candidateRootCommandIds) {
    const edgeId = ws.generateEdgeId();
    const edge = {
      id: edgeId,
      projectId: manifest.id,
      type: 'storyOwnsCommand' as const,
      fromNodeId: proposal.storyId,
      toNodeId: cmdId,
    };
    ws.saveEdge(edge);
    createdEdges.push(edge);
    addDraftOp(ws, 'add', 'edge', edgeId);
  }
  const ctx = ws.getContext();
  return okResult('em story confirm-bind', {
    confirmedProposalId: proposalId,
    createdEdges: createdEdges.map(e => ({ id: e.id, type: e.type, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
  }, { projectId: manifest.id, draftId: ctx?.draft?.id });
}

function extractDomains(canonicalId: string): string[] {
  const parts = canonicalId.split('.');
  const idx = parts.findIndex(p => ['cmd', 'evt', 'view', 'proc', 'trigger'].includes(p));
  if (idx > 0) return [parts.slice(0, idx).join('.')];
  if (parts.length > 2) return [parts.slice(0, 2).join('.')];
  return [canonicalId];
}
