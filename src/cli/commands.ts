import { Workspace } from '../workspace/workspace';
import { WorkspaceLayoutError } from '../workspace/layout';
import {
  CLIResult, okResult, errResult, Node, Draft, Proposal, EdgeType,
  CommandSchema, EventSchema, CommandField, EventField,
} from '../domain/types';
import { toEventModelingEdges } from '../domain/event-modeling-edges';
import { createRoleNode } from '../domain/roles';
import { buildGraph, getNeighbors, walkGraph, tracePath, toMermaid, NeighborResult, resolveNodeId, findRoots } from '../graph/graph-builder';
import { lintCanonicalId } from '../validation/lint';
import { validate } from '../validation/validate';
import { buildVisualizationSnapshot, VisualizationSnapshotError } from '../viewer-contract';
import type { SnapshotDirection } from '../viewer-contract';
import { renderLayoutAscii, renderLayoutTable } from '../terminal-viewer';
import { MutationRunner, requireMutationRunner } from '../drafts/mutation-runner';
import { buildSemanticDiff } from '../drafts/diff';
import { buildDraftImpactAnalysis } from '../drafts/impact';
import {
  compareModelSnapshots,
  currentModelFingerprint,
  currentModelSnapshot,
  modelSnapshotFingerprint,
  projectDraftSnapshot,
  snapshot,
} from '../drafts/projection';

function requireProject(ws: Workspace): { manifest: ReturnType<Workspace['getManifest']>; dir: string } | CLIResult {
  const resolutionError = ws.getResolutionError();
  if (resolutionError) return workspaceLayoutErrorResult('', resolutionError);
  const manifest = ws.getManifest();
  if (!manifest) return errResult('', 'NO_PROJECT', 'No active project. Run em project init or em project open.');
  return { manifest, dir: ws.getProjectDir()! };
}

function workspaceLayoutErrorResult(command: string, error: WorkspaceLayoutError): CLIResult {
  return errResult(command, error.code, error.message, {
    details: error.targetPath ? { path: error.targetPath } : undefined,
  });
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

function mutationRunnerOrResult(ws: Workspace, commandName: string): MutationRunner | CLIResult {
  return requireMutationRunner(ws, commandName);
}

function resolveNodeArg(ws: Workspace, idOrCanonical: string): string | null {
  const node = ws.getNode(idOrCanonical);
  return node?.canonicalId ?? null;
}

function requireNodeKind(ws: Workspace, commandName: string, idOrCanonical: string, kind: Node['kind'], label: string): Node | CLIResult {
  const node = ws.getNode(idOrCanonical);
  if (!node) return errResult(commandName, 'NOT_FOUND', `${label} "${idOrCanonical}" not found`);
  if (node.kind !== kind) {
    return errResult(commandName, 'INVALID_NODE_KIND', `${label} "${idOrCanonical}" must be a ${kind} node`, {
      details: {
        nodeId: node.canonicalId,
        actualKind: node.kind,
        expectedKind: kind,
      },
    });
  }
  return node;
}

function validateFieldInput(commandName: string, fieldId: string, name: string, type: string): CLIResult | null {
  if (!fieldId || !name || !type) {
    return errResult(commandName, 'INVALID_ARGUMENT', 'Schema fields require --field-id, --name, and --type');
  }
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(fieldId)) {
    return errResult(commandName, 'INVALID_ARGUMENT', `Invalid field id "${fieldId}"`, { details: { fieldId } });
  }
  if (name.length > 120 || type.length > 120) {
    return errResult(commandName, 'INVALID_ARGUMENT', 'Field name and type must be 120 characters or fewer');
  }
  return null;
}

function requiredFromFlags(commandName: string, flags: Record<string, unknown>, defaultValue: boolean): boolean | CLIResult {
  const hasRequired = Object.prototype.hasOwnProperty.call(flags, 'required');
  const hasOptional = Object.prototype.hasOwnProperty.call(flags, 'optional');
  if (hasRequired && hasOptional) {
    return errResult(commandName, 'INVALID_ARGUMENT', 'Use either --required or --optional, not both');
  }
  if (hasOptional) return false;
  if (hasRequired) {
    const value = flags.required;
    return value === false || value === 'false' || value === '0' ? false : true;
  }
  return defaultValue;
}

function isCliResult(value: unknown): value is CLIResult {
  return Boolean(value && typeof value === 'object' && 'ok' in value);
}

function withWarnings(result: CLIResult, warnings: string[]): CLIResult {
  result.warnings.push(...warnings);
  return result;
}

function requireNewNodeCanonicalId(ws: Workspace, commandName: string, canonicalId: string, kind: Node['kind']): { warnings: string[] } | CLIResult {
  const existingIds = new Set(ws.listNodes().map(n => n.canonicalId));
  const lintErrors = lintCanonicalId(canonicalId, kind, existingIds);
  const blocking = lintErrors.filter(e => ['LINT-001', 'LINT-004'].includes(e.code));
  if (blocking.length > 0) {
    return errResult(commandName, 'INVALID_CANONICAL_ID', blocking.map(e => e.message).join('; '), {
      projectId: ws.getManifest()?.id,
      details: { errors: blocking },
    });
  }
  return { warnings: lintErrors.map(e => e.message) };
}

function currentHeadBaseRevisionId(manifest: { headRevisionId: string | null }): string {
  return manifest.headRevisionId ?? 'rev_000';
}

function parentRevisionIdFromDraftBase(baseRevisionId: string): string | null {
  return baseRevisionId === 'rev_000' ? null : baseRevisionId;
}

function validateDraftMatchesModel(ws: Workspace, draft: Draft): CLIResult | null {
  if (!draft.baseSnapshot) {
    return errResult('em submit', 'DRAFT_BASE_SNAPSHOT_MISSING', 'Draft cannot be safely submitted because it has no base model snapshot', {
      projectId: ws.getManifest()?.id,
      draftId: draft.id,
    });
  }

  const expected = projectDraftSnapshot(draft.baseSnapshot, draft.ops);
  const actual = currentModelSnapshot(ws);
  const mismatches = compareModelSnapshots(expected, actual);
  if (mismatches.length === 0) return null;
  return errResult('em submit', 'DRAFT_MODEL_MISMATCH', 'Draft ops plus base snapshot no longer match the current model files', {
    projectId: ws.getManifest()?.id,
    draftId: draft.id,
    details: {
      expectedFingerprint: modelSnapshotFingerprint(expected),
      actualFingerprint: modelSnapshotFingerprint(actual),
      mismatches: mismatches.slice(0, 50),
    },
  });
}

export function projectInit(ws: Workspace, name: string, requestedPath?: string): CLIResult {
  try {
    const { projectDir, manifest } = ws.initProject(name, requestedPath);
    return okResult('em project init', {
      project: {
        id: manifest.id,
        name: manifest.name,
        headRevisionId: manifest.headRevisionId,
        projectPath: projectDir,
      },
    }, { projectId: manifest.id });
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) return workspaceLayoutErrorResult('em project init', error);
    throw error;
  }
}

export function projectOpen(ws: Workspace, idOrName: string, requestedPath?: string): CLIResult {
  try {
    const manifest = ws.openProject(idOrName, requestedPath);
    if (!manifest) return errResult('em project open', 'NOT_FOUND', requestedPath
      ? `Project not found at path "${requestedPath}"`
      : `Project "${idOrName}" not found`);
    const revision = manifest.headRevisionId ? ws.getRevision(manifest.headRevisionId) : null;
    return okResult('em project open', {
      project: {
        id: manifest.id,
        name: manifest.name,
        headRevisionId: manifest.headRevisionId,
        projectPath: ws.getProjectDir(),
      },
      currentRevision: revision ? { id: revision.id, message: revision.message } : null,
    }, { projectId: manifest.id, revisionId: manifest.headRevisionId ?? undefined });
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) return workspaceLayoutErrorResult('em project open', error);
    throw error;
  }
}

export function projectMigrate(ws: Workspace, requestedPath: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  try {
    const result = ws.migrateProject(requestedPath);
    return okResult('em project migrate', {
      project: { id: result.manifest.id, name: result.manifest.name },
      sourcePath: result.sourceDir,
      projectPath: result.projectDir,
      copied: true,
    }, { projectId: result.manifest.id });
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) return workspaceLayoutErrorResult('em project migrate', error);
    throw error;
  }
}

export function ctx(ws: Workspace): CLIResult {
  const resolutionError = ws.getResolutionError();
  if (resolutionError) return workspaceLayoutErrorResult('em ctx', resolutionError);
  const c = ws.getContext();
  if (!c) return errResult('em ctx', 'NO_PROJECT', 'No active project');
  const result: Record<string, unknown> = {
    project: { id: c.project.id, name: c.project.name },
    workspace: {
      repositoryRoot: ws.getRepositoryRoot(),
      projectPath: ws.getProjectDir(),
      cachePath: ws.getCacheDir(),
      contextPath: ws.getContextPath(),
    },
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
  const openDraft = ws.listDrafts().find(d => d.status === 'open');
  if (openDraft) {
    return errResult('em draft start', 'DRAFT_ALREADY_OPEN', `Draft "${openDraft.id}" is already open`, {
      projectId: manifest.id,
      draftId: openDraft.id,
    });
  }
  const draftId = ws.generateDraftId();
  const draft: Draft = {
    id: draftId,
    projectId: manifest.id,
    baseRevisionId: currentHeadBaseRevisionId(manifest),
    baseContentFingerprint: currentModelFingerprint(ws),
    baseSnapshot: currentModelSnapshot(ws),
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
  const diff = buildSemanticDiff(draft);
  return okResult('em draft status', {
    draft: { id: draft.id, status: draft.status, baseRevisionId: draft.baseRevisionId },
    summary: diff.summary,
  }, { projectId: ws.getManifest()!.id, draftId: draft.id });
}

export function draftDiff(ws: Workspace, format: string = 'json'): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const dr = requireDraft(ws);
  if (!isDraftResult(dr)) return dr.error;
  const draft = dr.draft;
  const semanticDiff = buildSemanticDiff(draft);
  const diffData: Record<string, unknown> = { ...semanticDiff };
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
  const currentBaseRevisionId = currentHeadBaseRevisionId(manifest);
  if (currentBaseRevisionId !== draft.baseRevisionId) {
    return errResult('em submit', 'DRAFT_BASE_MISMATCH', `Draft "${draft.id}" was based on ${draft.baseRevisionId}, but current head is ${currentBaseRevisionId}`, {
      projectId: manifest.id,
      draftId: draft.id,
      details: { draftBaseRevisionId: draft.baseRevisionId, currentHeadRevisionId: currentBaseRevisionId },
    });
  }
  const consistencyError = validateDraftMatchesModel(ws, draft);
  if (consistencyError) return consistencyError;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const vmSchemas = nodes
    .filter(n => n.kind === 'viewModel')
    .map(n => ws.getViewModelSchema(n.canonicalId))
    .filter((schema): schema is import('../domain/types').ViewModelSchema => schema !== null);
  const validationErrors = validate(nodes, edges, vmSchemas, ws.listCommandSchemas(), ws.listEventSchemas());
  if (validationErrors.length > 0) {
    return errResult('em submit', 'VALIDATION_FAILED', 'Draft cannot be submitted until validation passes', {
      projectId: manifest.id,
      draftId: draft.id,
      details: { errors: validationErrors.map(e => ({ code: e.code, message: e.message, details: e.details })) },
    });
  }
  const semanticDiff = buildSemanticDiff(draft);
  const revId = ws.generateRevisionId();
  const revision = {
    id: revId,
    projectId: manifest.id,
    parentRevisionId: parentRevisionIdFromDraftBase(draft.baseRevisionId),
    message,
    createdAt: new Date().toISOString(),
    author: 'user',
    submittedDraftId: draft.id,
    validation: { valid: true, errorCount: 0 },
    diffSummary: semanticDiff.summary,
    contentFingerprint: currentModelFingerprint(ws),
  };
  ws.saveRevision(revision);
  ws.updateManifest({ headRevisionId: revId });
  draft.status = 'submitted';
  ws.saveDraft(draft);
  ws.setActiveDraft('');
  ws.setCheckedOutRevision(revId);
  return okResult('em submit', {
    submittedDraftId: draft.id,
    newRevision: { id: revId, message },
    diff: { summary: semanticDiff.summary },
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
  const mutation = mutationRunnerOrResult(ws, 'em cmd new');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em cmd new', canonicalId, 'cmd');
  if (isCliResult(idCheck)) return idCheck;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em cmd new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
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
  mutation.saveNode(node);
  return withWarnings(okResult('em cmd new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

export function evtNew(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em evt new');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em evt new', canonicalId, 'evt');
  if (isCliResult(idCheck)) return idCheck;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em evt new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
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
  mutation.saveNode(node);
  return withWarnings(okResult('em evt new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

export function viewNew(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em view new');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em view new', canonicalId, 'viewModel');
  if (isCliResult(idCheck)) return idCheck;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em view new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
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
  mutation.saveNode(node);
  mutation.saveViewModelSchema({ viewModelNodeId: canonicalId, fields: [] }, 'add', null, { viewModelNodeId: canonicalId, fields: [] });
  return withWarnings(okResult('em view new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

function resolveOwnerRole(ws: Workspace, ownerRole: string | undefined): string | undefined {
  if (!ownerRole) return undefined;
  return ws.getNode(ownerRole)?.canonicalId ?? ownerRole;
}

export function roleAdd(ws: Workspace, canonicalId: string, displayName?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em role add');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em role add', canonicalId, 'role');
  if (isCliResult(idCheck)) return idCheck;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em role add', 'DUPLICATE', `Node "${canonicalId}" already exists`);

  const node = createRoleNode({
    id: ws.generateNodeId(),
    projectId: manifest.id,
    canonicalId,
    displayName,
  });
  mutation.saveNode(node);
  return withWarnings(okResult('em role add', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

function ensureRoleNode(ws: Workspace, mutation: MutationRunner, roleId: string, commandName: string): Node | CLIResult {
  if (!roleId) {
    return errResult(commandName, 'MISSING_ROLE', 'Role id is required');
  }

  const existing = ws.getNode(roleId);
  if (existing) {
    if (existing.kind !== 'role') {
      return errResult(commandName, 'INVALID_ROLE_NODE', `Role "${roleId}" resolves to a ${existing.kind} node`, {
        projectId: ws.getManifest()?.id,
        details: { roleId, kind: existing.kind },
      });
    }
    return existing;
  }

  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, commandName, roleId, 'role');
  if (isCliResult(idCheck)) return idCheck;

  const roleNode = createRoleNode({
    id: ws.generateNodeId(),
    projectId: manifest.id,
    canonicalId: roleId,
  });
  mutation.saveNode(roleNode);
  return roleNode;
}

export function procNew(ws: Workspace, canonicalId: string, ownerRole?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em proc new');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em proc new', canonicalId, 'proc');
  if (isCliResult(idCheck)) return idCheck;
  const existing = ws.getNode(canonicalId);
  if (existing) return errResult('em proc new', 'DUPLICATE', `Node "${canonicalId}" already exists`);
  const resolvedOwnerRole = resolveOwnerRole(ws, ownerRole);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind: 'proc',
    canonicalId,
    displayName: canonicalId.split('.').pop() ?? canonicalId,
    tags: [],
    domains: extractDomains(canonicalId),
    ...(resolvedOwnerRole ? { ownerRole: resolvedOwnerRole } : {}),
  };
  mutation.saveNode(node);
  return withWarnings(okResult('em proc new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, ownerRole: node.ownerRole },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

export function triggerNew(ws: Workspace, canonicalId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em trigger new');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const idCheck = requireNewNodeCanonicalId(ws, 'em trigger new', canonicalId, 'trigger');
  if (isCliResult(idCheck)) return idCheck;
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
  mutation.saveNode(node);
  return withWarnings(okResult('em trigger new', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
}

export function storyAdd(ws: Workspace, level: string, title: string, parentId?: string, roleId?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em story add');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const kind = `story.${level}` as Node['kind'];
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalId = `story.${slug}`;
  const idCheck = requireNewNodeCanonicalId(ws, 'em story add', canonicalId, kind);
  if (isCliResult(idCheck)) return idCheck;
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
  mutation.saveNode(node);
  if (parentId) {
    const edgeId = ws.generateEdgeId();
    mutation.saveEdge({
      id: edgeId,
      projectId: manifest.id,
      type: 'parentOf',
      fromNodeId: parentId,
      toNodeId: canonicalId,
    });
  }
  return withWarnings(okResult('em story add', {
    node: { id: node.id, kind: node.kind, canonicalId: node.canonicalId, displayName: node.displayName },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
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

export function uiAdd(ws: Workspace, uiKind: string, name: string, parentId?: string, ownerRole?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em ui add');
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const kind = `ui.${uiKind}` as Node['kind'];
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const canonicalId = `ui.${uiKind}.${slug}`;
  const idCheck = requireNewNodeCanonicalId(ws, 'em ui add', canonicalId, kind);
  if (isCliResult(idCheck)) return idCheck;
  const resolvedOwnerRole = resolveOwnerRole(ws, ownerRole);
  const id = ws.generateNodeId();
  const node: Node = {
    id,
    projectId: manifest.id,
    kind,
    canonicalId,
    displayName: name,
    tags: [],
    domains: [],
    ...(resolvedOwnerRole ? { ownerRole: resolvedOwnerRole } : {}),
  };
  mutation.saveNode(node);
  if (parentId) {
    const edgeId = ws.generateEdgeId();
    mutation.saveEdge({
      id: edgeId,
      projectId: manifest.id,
      type: 'parentOf',
      fromNodeId: parentId,
      toNodeId: canonicalId,
    });
  }
  return withWarnings(okResult('em ui add', {
    node: {
      id: node.id,
      kind: node.kind,
      canonicalId: node.canonicalId,
      displayName: node.displayName,
      ownerRole: node.ownerRole,
    },
  }, { projectId: manifest.id, draftId: mutation.draftId }), idCheck.warnings);
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
  const mutation = mutationRunnerOrResult(ws, 'em link cmd->evt');
  if (isCliResult(mutation)) return mutation;
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
  mutation.saveEdge(edge);
  return okResult('em link cmd->evt', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function linkEvtView(ws: Workspace, evtId: string, viewModelId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em link evt->view');
  if (isCliResult(mutation)) return mutation;
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
  mutation.saveEdge(edge);
  return okResult('em link evt->view', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function uiBindView(ws: Workspace, uiId: string, viewModelId: string, fields?: string[]): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em ui bind-view');
  if (isCliResult(mutation)) return mutation;
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
    type: 'viewModelConsumedByUiOrProcessor' as const,
    fromNodeId: view.canonicalId,
    toNodeId: ui.canonicalId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
  mutation.saveEdge(edge);
  return okResult('em ui bind-view', {
    edge: {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      meta: edge.meta ?? {},
    },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

function createRoleIssuesCommand(
  ws: Workspace,
  roleId: string,
  viaId: string,
  cmdId: string,
  commandName: string,
): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, commandName);
  if (isCliResult(mutation)) return mutation;
  const manifest = ws.getManifest()!;
  const via = ws.getNode(viaId);
  const cmd = ws.getNode(cmdId);
  if (!cmd) return errResult(commandName, 'NOT_FOUND', `Command "${cmdId}" not found`);
  if (!via) return errResult(commandName, 'NOT_FOUND', `Via node "${viaId}" not found`);
  if (!via.kind.startsWith('ui.') && via.kind !== 'proc') {
    return errResult(commandName, 'INVALID_VIA_NODE', `Via node "${viaId}" must be a UI node or processor`);
  }
  const role = ensureRoleNode(ws, mutation, roleId, commandName);
  if (isCliResult(role)) return role;
  const edgeId = ws.generateEdgeId();
  const edge = {
    id: edgeId,
    projectId: manifest.id,
    type: 'roleIssuesCommand' as const,
    fromNodeId: role.canonicalId,
    toNodeId: cmd.canonicalId,
    viaNodeId: via.canonicalId,
  };
  mutation.saveEdge(edge);
  return okResult(commandName, {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId, viaNodeId: edge.viaNodeId },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function roleIssuesCmd(ws: Workspace, roleId: string, viaId: string, cmdId: string): CLIResult {
  return createRoleIssuesCommand(ws, roleId, viaId, cmdId, 'em role issues-cmd');
}

export function procBindView(ws: Workspace, procId: string, viewModelId: string, fields?: string[]): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em proc bind-view');
  if (isCliResult(mutation)) return mutation;
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
    type: 'viewModelConsumedByUiOrProcessor' as const,
    fromNodeId: view.canonicalId,
    toNodeId: proc.canonicalId,
    meta: Object.keys(meta).length > 0 ? meta : undefined,
  };
  mutation.saveEdge(edge);
  return okResult('em proc bind-view', {
    edge: {
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      meta: edge.meta ?? {},
    },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function triggerIssuesCmd(ws: Workspace, triggerId: string, cmdId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em trigger issues-cmd');
  if (isCliResult(mutation)) return mutation;
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
  mutation.saveEdge(edge);
  return okResult('em trigger issues-cmd', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function storyBind(ws: Workspace, storyId: string, cmdId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em story bind');
  if (isCliResult(mutation)) return mutation;
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
  mutation.saveEdge(edge);
  return okResult('em story bind', {
    edge: { id: edge.id, type: edge.type, fromNodeId: edge.fromNodeId, toNodeId: edge.toNodeId },
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

type DataSchemaKind = 'command' | 'event';
type DataSchema = CommandSchema | EventSchema;
type DataSchemaField = CommandField | EventField;

function dataSchemaGroup(kind: DataSchemaKind): 'cmd' | 'evt' {
  return kind === 'command' ? 'cmd' : 'evt';
}

function dataSchemaNodeKind(kind: DataSchemaKind): Node['kind'] {
  return dataSchemaGroup(kind);
}

function dataSchemaLabel(kind: DataSchemaKind): 'Command' | 'Event' {
  return kind === 'command' ? 'Command' : 'Event';
}

function dataSchemaOwnerKey(kind: DataSchemaKind): 'commandId' | 'eventId' {
  return kind === 'command' ? 'commandId' : 'eventId';
}

function dataSchemaCommand(kind: DataSchemaKind, noun: 'field' | 'schema', action: string): string {
  return `em ${dataSchemaGroup(kind)} ${noun} ${action}`;
}

function readDataSchema(ws: Workspace, kind: DataSchemaKind, canonicalId: string): DataSchema | null {
  return kind === 'command' ? ws.getCommandSchema(canonicalId) : ws.getEventSchema(canonicalId);
}

function emptyDataSchema(kind: DataSchemaKind, canonicalId: string): DataSchema {
  return kind === 'command'
    ? { commandNodeId: canonicalId, version: 1, input: { fields: [] } }
    : { eventNodeId: canonicalId, version: 1, payload: { fields: [] } };
}

function dataSchemaFor(kind: DataSchemaKind, canonicalId: string, existing: DataSchema | null): DataSchema {
  return existing ?? emptyDataSchema(kind, canonicalId);
}

function dataSchemaFields(schema: DataSchema, kind: DataSchemaKind): DataSchemaField[] {
  return kind === 'command'
    ? (schema as CommandSchema).input.fields
    : (schema as EventSchema).payload.fields;
}

function replaceDataSchemaFields(schema: DataSchema, kind: DataSchemaKind, fields: DataSchemaField[]): void {
  if (kind === 'command') {
    (schema as CommandSchema).input.fields = fields as CommandField[];
  } else {
    (schema as EventSchema).payload.fields = fields as EventField[];
  }
}

function schemaFieldPointer(kind: DataSchemaKind, fieldIndex: number): string {
  return kind === 'command' ? `/input/fields/${fieldIndex}` : `/payload/fields/${fieldIndex}`;
}

function changedKeys(before: unknown, after: unknown): string[] {
  const beforeRecord = before && typeof before === 'object' ? before as Record<string, unknown> : {};
  const afterRecord = after && typeof after === 'object' ? after as Record<string, unknown> : {};
  const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  return [...keys].filter(key => JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]));
}

function saveDataSchemaWithMutation(
  mutation: MutationRunner,
  kind: DataSchemaKind,
  schema: DataSchema,
  action: 'add' | 'edit' | 'remove',
  before: unknown | null,
  after: unknown | null,
  options: { fieldId?: string; jsonPointer?: string; changedFields?: string[] } = {},
): void {
  if (kind === 'command') {
    mutation.saveCommandSchema(schema as CommandSchema, action, before, after, options);
  } else {
    mutation.saveEventSchema(schema as EventSchema, action, before, after, options);
  }
}

function dataSchemaOutput(kind: DataSchemaKind, canonicalId: string, schema: DataSchema): Record<string, unknown> {
  const base = {
    [dataSchemaOwnerKey(kind)]: canonicalId,
    version: schema.version,
  };
  if (kind === 'command') {
    return { ...base, input: { fields: dataSchemaFields(schema, kind) } };
  }
  return { ...base, payload: { fields: dataSchemaFields(schema, kind) } };
}

function dataSchemaInit(ws: Workspace, kind: DataSchemaKind, nodeId: string): CLIResult {
  const commandName = dataSchemaCommand(kind, 'schema', 'init');
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, commandName);
  if (isCliResult(mutation)) return mutation;
  const node = requireNodeKind(ws, commandName, nodeId, dataSchemaNodeKind(kind), dataSchemaLabel(kind));
  if (isCliResult(node)) return node;

  const existing = readDataSchema(ws, kind, node.canonicalId);
  const schema = dataSchemaFor(kind, node.canonicalId, existing);
  if (!existing) {
    saveDataSchemaWithMutation(mutation, kind, schema, 'add', null, schema);
  }

  return okResult(commandName, {
    created: !existing,
    ...dataSchemaOutput(kind, node.canonicalId, schema),
  }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

function dataFieldAdd(
  ws: Workspace, kind: DataSchemaKind, nodeId: string, fieldId: string, name: string,
  type: string, flags: Record<string, unknown> = {},
): CLIResult {
  const commandName = dataSchemaCommand(kind, 'field', 'add');
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, commandName);
  if (isCliResult(mutation)) return mutation;
  const inputError = validateFieldInput(commandName, fieldId, name, type);
  if (inputError) return inputError;
  const node = requireNodeKind(ws, commandName, nodeId, dataSchemaNodeKind(kind), dataSchemaLabel(kind));
  if (isCliResult(node)) return node;
  const required = requiredFromFlags(commandName, flags, true);
  if (isCliResult(required)) return required;

  const schema = dataSchemaFor(kind, node.canonicalId, readDataSchema(ws, kind, node.canonicalId));
  const fields = dataSchemaFields(schema, kind);
  if (fields.some(f => f.fieldId === fieldId)) {
    return errResult(commandName, 'DUPLICATE', `Field "${fieldId}" already exists in "${node.canonicalId}"`);
  }

  const field: DataSchemaField = { fieldId, name, type, required };
  if (typeof flags.description === 'string' && flags.description) field.description = flags.description;
  fields.push(field);
  saveDataSchemaWithMutation(mutation, kind, schema, 'add', null, field, {
    fieldId,
    jsonPointer: schemaFieldPointer(kind, fields.length - 1),
  });

  return okResult(commandName, {
    [dataSchemaOwnerKey(kind)]: node.canonicalId,
    field,
  }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

function dataFieldEdit(ws: Workspace, kind: DataSchemaKind, nodeId: string, fieldId: string, updates: Record<string, unknown>): CLIResult {
  const commandName = dataSchemaCommand(kind, 'field', 'edit');
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, commandName);
  if (isCliResult(mutation)) return mutation;
  const node = requireNodeKind(ws, commandName, nodeId, dataSchemaNodeKind(kind), dataSchemaLabel(kind));
  if (isCliResult(node)) return node;
  const schema = readDataSchema(ws, kind, node.canonicalId);
  if (!schema) return errResult(commandName, 'NOT_FOUND', `Schema for "${nodeId}" not found`);
  const fields = dataSchemaFields(schema, kind);
  const fieldIndex = fields.findIndex(f => f.fieldId === fieldId);
  const field = fields[fieldIndex];
  if (!field) return errResult(commandName, 'NOT_FOUND', `Field "${fieldId}" not found`);
  const before = snapshot(field);

  const name = typeof updates.name === 'string' && updates.name ? updates.name : field.name;
  const type = typeof updates.type === 'string' && updates.type ? updates.type : field.type;
  const inputError = validateFieldInput(commandName, field.fieldId, name, type);
  if (inputError) return inputError;
  field.name = name;
  field.type = type;
  const required = requiredFromFlags(commandName, updates, field.required);
  if (isCliResult(required)) return required;
  field.required = required;
  if (typeof updates.description === 'string') field.description = updates.description;

  saveDataSchemaWithMutation(mutation, kind, schema, 'edit', before, field, {
    fieldId,
    jsonPointer: schemaFieldPointer(kind, fieldIndex),
    changedFields: changedKeys(before, field),
  });
  return okResult(commandName, { [dataSchemaOwnerKey(kind)]: node.canonicalId, field }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

function dataFieldRm(ws: Workspace, kind: DataSchemaKind, nodeId: string, fieldId: string): CLIResult {
  const commandName = dataSchemaCommand(kind, 'field', 'rm');
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, commandName);
  if (isCliResult(mutation)) return mutation;
  const node = requireNodeKind(ws, commandName, nodeId, dataSchemaNodeKind(kind), dataSchemaLabel(kind));
  if (isCliResult(node)) return node;
  const schema = readDataSchema(ws, kind, node.canonicalId);
  if (!schema) return errResult(commandName, 'NOT_FOUND', `Schema for "${nodeId}" not found`);
  const fields = dataSchemaFields(schema, kind);
  const fieldIndex = fields.findIndex(f => f.fieldId === fieldId);
  if (fieldIndex === -1) return errResult(commandName, 'NOT_FOUND', `Field "${fieldId}" not found`);
  const before = snapshot(fields[fieldIndex]);
  const nextFields = fields.filter(f => f.fieldId !== fieldId);
  replaceDataSchemaFields(schema, kind, nextFields);
  saveDataSchemaWithMutation(mutation, kind, schema, 'remove', before, null, {
    fieldId,
    jsonPointer: schemaFieldPointer(kind, fieldIndex),
  });
  return okResult(commandName, {
    removedFieldId: fieldId,
    [dataSchemaOwnerKey(kind)]: node.canonicalId,
  }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

function dataSchemaShow(ws: Workspace, kind: DataSchemaKind, nodeId: string): CLIResult {
  const commandName = dataSchemaCommand(kind, 'schema', 'show');
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const node = requireNodeKind(ws, commandName, nodeId, dataSchemaNodeKind(kind), dataSchemaLabel(kind));
  if (isCliResult(node)) return node;
  const schema = dataSchemaFor(kind, node.canonicalId, readDataSchema(ws, kind, node.canonicalId));
  return okResult(commandName, dataSchemaOutput(kind, node.canonicalId, schema), { projectId: ws.getManifest()!.id });
}

export function cmdSchemaInit(ws: Workspace, commandId: string): CLIResult {
  return dataSchemaInit(ws, 'command', commandId);
}

export function evtSchemaInit(ws: Workspace, eventId: string): CLIResult {
  return dataSchemaInit(ws, 'event', eventId);
}

export function cmdFieldAdd(ws: Workspace, commandId: string, fieldId: string, name: string, type: string, flags: Record<string, unknown> = {}): CLIResult {
  return dataFieldAdd(ws, 'command', commandId, fieldId, name, type, flags);
}

export function evtFieldAdd(ws: Workspace, eventId: string, fieldId: string, name: string, type: string, flags: Record<string, unknown> = {}): CLIResult {
  return dataFieldAdd(ws, 'event', eventId, fieldId, name, type, flags);
}

export function cmdFieldEdit(ws: Workspace, commandId: string, fieldId: string, updates: Record<string, unknown>): CLIResult {
  return dataFieldEdit(ws, 'command', commandId, fieldId, updates);
}

export function evtFieldEdit(ws: Workspace, eventId: string, fieldId: string, updates: Record<string, unknown>): CLIResult {
  return dataFieldEdit(ws, 'event', eventId, fieldId, updates);
}

export function cmdFieldRm(ws: Workspace, commandId: string, fieldId: string): CLIResult {
  return dataFieldRm(ws, 'command', commandId, fieldId);
}

export function evtFieldRm(ws: Workspace, eventId: string, fieldId: string): CLIResult {
  return dataFieldRm(ws, 'event', eventId, fieldId);
}

export function cmdSchemaShow(ws: Workspace, commandId: string): CLIResult {
  return dataSchemaShow(ws, 'command', commandId);
}

export function evtSchemaShow(ws: Workspace, eventId: string): CLIResult {
  return dataSchemaShow(ws, 'event', eventId);
}

export function viewFieldAdd(
  ws: Workspace, viewModelId: string, fieldId: string, name: string,
  type: string, fromEvent: string, path: string, nullable: boolean = false,
): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em view field add');
  if (isCliResult(mutation)) return mutation;
  const inputError = validateFieldInput('em view field add', fieldId, name, type);
  if (inputError) return inputError;
  const view = requireNodeKind(ws, 'em view field add', viewModelId, 'viewModel', 'ViewModel');
  if (isCliResult(view)) return view;
  if (!fromEvent || !path) return errResult('em view field add', 'INVALID_ARGUMENT', 'View fields require --from-event and --path');
  const schema = ws.getViewModelSchema(view.canonicalId) ?? { viewModelNodeId: view.canonicalId, fields: [] };
  if (schema.fields.some(f => f.fieldId === fieldId)) {
    return errResult('em view field add', 'DUPLICATE', `Field "${fieldId}" already exists in "${view.canonicalId}"`);
  }
  const field = {
    fieldId,
    name,
    type,
    nullable,
    source: { eventNodeId: fromEvent, eventFieldPath: path },
  };
  schema.fields.push(field);
  mutation.saveViewModelSchema(schema, 'add', null, field, {
    fieldId,
    jsonPointer: `/fields/${schema.fields.length - 1}`,
  });
  return okResult('em view field add', { field }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

export function viewFieldEdit(ws: Workspace, viewModelId: string, fieldId: string, updates: Record<string, unknown>): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em view field edit');
  if (isCliResult(mutation)) return mutation;
  const view = requireNodeKind(ws, 'em view field edit', viewModelId, 'viewModel', 'ViewModel');
  if (isCliResult(view)) return view;
  const schema = ws.getViewModelSchema(view.canonicalId);
  if (!schema) return errResult('em view field edit', 'NOT_FOUND', `Schema for "${viewModelId}" not found`);
  const fieldIndex = schema.fields.findIndex(f => f.fieldId === fieldId);
  const field = schema.fields[fieldIndex];
  if (!field) return errResult('em view field edit', 'NOT_FOUND', `Field "${fieldId}" not found`);
  const before = snapshot(field);
  const name = typeof updates.name === 'string' && updates.name ? updates.name : field.name;
  const type = typeof updates.type === 'string' && updates.type ? updates.type : field.type;
  const inputError = validateFieldInput('em view field edit', field.fieldId, name, type);
  if (inputError) return inputError;
  field.name = name;
  field.type = type;
  if ('nullable' in updates) field.nullable = updates['nullable'] as boolean;
  mutation.saveViewModelSchema(schema, 'edit', before, field, {
    fieldId,
    jsonPointer: `/fields/${fieldIndex}`,
    changedFields: changedKeys(before, field),
  });
  return okResult('em view field edit', { field: { fieldId: field.fieldId, name: field.name, type: field.type, nullable: field.nullable } }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

export function viewFieldRm(ws: Workspace, viewModelId: string, fieldId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em view field rm');
  if (isCliResult(mutation)) return mutation;
  const view = requireNodeKind(ws, 'em view field rm', viewModelId, 'viewModel', 'ViewModel');
  if (isCliResult(view)) return view;
  const schema = ws.getViewModelSchema(view.canonicalId);
  if (!schema) return errResult('em view field rm', 'NOT_FOUND', `Schema for "${viewModelId}" not found`);
  const fieldIndex = schema.fields.findIndex(f => f.fieldId === fieldId);
  if (fieldIndex === -1) return errResult('em view field rm', 'NOT_FOUND', `Field "${fieldId}" not found`);
  const before = snapshot(schema.fields[fieldIndex]);
  schema.fields = schema.fields.filter(f => f.fieldId !== fieldId);
  mutation.saveViewModelSchema(schema, 'remove', before, null, {
    fieldId,
    jsonPointer: `/fields/${fieldIndex}`,
  });
  return okResult('em view field rm', { removedFieldId: fieldId, viewModelId: view.canonicalId }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

export function viewSchemaShow(ws: Workspace, viewModelId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const view = requireNodeKind(ws, 'em view schema show', viewModelId, 'viewModel', 'ViewModel');
  if (isCliResult(view)) return view;
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
  const graph = buildGraph(nodes, toEventModelingEdges(edges));
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
  const graph = buildGraph(nodes, toEventModelingEdges(edges));
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
  const graph = buildGraph(nodes, toEventModelingEdges(edges));
  const paths = tracePath(graph, fromId, toId, maxHops);
  return okResult('em trace', { paths }, { projectId: ws.getManifest()!.id });
}

export function graph(ws: Workspace, focusId?: string, depth?: number, format: string = 'mermaid'): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const g = buildGraph(nodes, toEventModelingEdges(edges));
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
  const errors = validate(nodes, edges, vmSchemas, ws.listCommandSchemas(), ws.listEventSchemas());
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
  const diff = buildSemanticDiff(draft);
  const totalChanges = diff.summary.totalChanges ?? diff.changes.length;
  const changedNodes = diff.changes
    .filter(change => change.entityType === 'node')
    .map(change => (change.after ?? change.before) as Partial<Node>)
    .filter(node => typeof node.kind === 'string');
  const cmdCount = changedNodes.filter(n => n.kind === 'cmd').length;
  const evtCount = changedNodes.filter(n => n.kind === 'evt').length;
  const viewCount = changedNodes.filter(n => n.kind === 'viewModel').length;
  const storyCount = changedNodes.filter(n => n.kind?.startsWith('story.')).length;
  const edgeCount = (diff.summary.edgesAdded ?? 0) + (diff.summary.edgesUpdated ?? 0) + (diff.summary.edgesRemoved ?? 0);
  const schemaCount = (diff.summary.schemasAdded ?? 0) + (diff.summary.schemasUpdated ?? 0) + (diff.summary.schemasRemoved ?? 0);
  const fieldCount = (diff.summary.fieldsAdded ?? 0) + (diff.summary.fieldsUpdated ?? 0) + (diff.summary.fieldsRemoved ?? 0);
  const proposalCount = (diff.summary.proposalsAdded ?? 0) + (diff.summary.proposalsUpdated ?? 0) + (diff.summary.proposalsRemoved ?? 0);
  const findings: string[] = [];
  if (cmdCount > 0) findings.push(`Draft changes ${cmdCount} command(s)`);
  if (evtCount > 0) findings.push(`Draft changes ${evtCount} event(s)`);
  if (viewCount > 0) findings.push(`Draft changes ${viewCount} view model(s)`);
  if (edgeCount > 0) findings.push(`Draft changes ${edgeCount} edge(s)`);
  if (schemaCount > 0) findings.push(`Draft changes ${schemaCount} schema envelope(s)`);
  if (fieldCount > 0) findings.push(`Draft changes ${fieldCount} schema field(s)`);
  if (proposalCount > 0) findings.push(`Draft changes ${proposalCount} proposal(s)`);
  findings.push(`Draft has ${totalChanges} semantic change(s)`);
  return okResult('em review', {
    summary: {
      riskLevel: totalChanges > 8 ? 'high' : totalChanges > 3 ? 'medium' : 'low',
      changedStories: storyCount,
      changedCommands: cmdCount,
      changedEvents: evtCount,
      changedViews: viewCount,
      changedEdges: edgeCount,
      changedSchemas: schemaCount,
      changedFields: fieldCount,
      changedProposals: proposalCount,
      totalChanges,
    },
    findings,
  }, { projectId: ws.getManifest()!.id, draftId: draft.id });
}

/**
 * Review the net semantic impact of an entire draft rather than a single
 * event or ViewModel field. The analysis deliberately runs from the draft's
 * persisted base snapshot so it remains valid even when the working model is
 * currently checked out elsewhere.
 */
export function reviewImpactDraft(ws: Workspace, draftId?: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;

  const draft = draftId ? ws.getDraft(draftId) : ws.getContext()?.draft;
  if (!draft) {
    return draftId
      ? errResult('em review impact draft', 'DRAFT_NOT_FOUND', `Draft "${draftId}" not found`, {
        projectId: ws.getManifest()!.id,
        draftId,
      })
      : errResult('em review impact draft', 'NO_DRAFT', 'No active draft. Run em draft start.', {
        projectId: ws.getManifest()!.id,
      });
  }
  if (!draft.baseSnapshot) {
    return errResult('em review impact draft', 'DRAFT_BASE_SNAPSHOT_MISSING', `Draft "${draft.id}" does not have a base model snapshot`, {
      projectId: ws.getManifest()!.id,
      draftId: draft.id,
    });
  }

  return okResult('em review impact draft', {
    impact: buildDraftImpactAnalysis(draft),
  }, { projectId: ws.getManifest()!.id, draftId: draft.id, revisionId: draft.baseRevisionId });
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
          if (c.type === 'viewModelConsumedByUiOrProcessor') {
            const consumer = graph.nodes.get(c.toNodeId);
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
    const outEdges = graph.outgoing.get(resolved) ?? [];
    for (const e of outEdges) {
      if (e.type === 'viewModelConsumedByUiOrProcessor') {
        const fieldRefs = e.meta?.fieldRefs as string[] | undefined;
        if (!fieldRefs || fieldRefs.includes(fieldId)) {
          const consumer = graph.nodes.get(e.toNodeId);
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
  const mutation = mutationRunnerOrResult(ws, 'em story suggest-bind');
  if (isCliResult(mutation)) return mutation;
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
        if (e.type === 'roleIssuesCommand') {
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
          const vmOut = graph.outgoing.get(vmResolved) ?? [];
          for (const ce of vmOut) {
            if (ce.type === 'viewModelConsumedByUiOrProcessor') {
              const consumer = graph.nodes.get(ce.toNodeId);
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
  mutation.saveProposal(proposal);
  return okResult('em story suggest-bind', { proposal }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

export function storyReviseBind(ws: Workspace, proposalId: string, op: string, args: Record<string, unknown>): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em story revise-bind');
  if (isCliResult(mutation)) return mutation;
  const proposal = ws.getProposal(proposalId);
  if (!proposal) return errResult('em story revise-bind', 'NOT_FOUND', `Proposal "${proposalId}" not found`);
  const before = snapshot(proposal);
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

  mutation.saveProposal(revised, 'edit', before);
  return okResult('em story revise-bind', { proposal: revised }, { projectId: ws.getManifest()!.id, draftId: mutation.draftId });
}

export function storyConfirmBind(ws: Workspace, storyId: string, proposalId: string): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const mutation = mutationRunnerOrResult(ws, 'em story confirm-bind');
  if (isCliResult(mutation)) return mutation;
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
    mutation.saveEdge(edge);
    createdEdges.push(edge);
  }
  return okResult('em story confirm-bind', {
    confirmedProposalId: proposalId,
    createdEdges: createdEdges.map(e => ({ id: e.id, type: e.type, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId })),
  }, { projectId: manifest.id, draftId: mutation.draftId });
}

export function roots(ws: Workspace): CLIResult {
  const check = requireProject(ws);
  if ('ok' in check && !check.ok) return check;
  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);
  const rootNodes = findRoots(graph);
  return okResult('em roots', {
    roots: rootNodes.map(r => ({
      canonicalId: r.canonicalId,
      kind: r.kind,
      displayName: r.displayName,
    })),
    count: rootNodes.length,
  }, { projectId: ws.getManifest()!.id });
}

function extractDomains(canonicalId: string): string[] {
  const parts = canonicalId.split('.');
  const idx = parts.findIndex(p => ['cmd', 'evt', 'view', 'proc', 'trigger'].includes(p));
  if (idx > 0) return [parts.slice(0, idx).join('.')];
  if (parts.length > 2) return [parts.slice(0, 2).join('.')];
  return [canonicalId];
}

export function layout(
  ws: Workspace,
  focusNodeId: string,
  direction: string = 'both',
  maxHops?: number,
  format: string = 'json',
  includeTruncatedPaths = false,
): CLIResult {
  try {
    const snapshot = buildVisualizationSnapshot({
      workspace: ws,
      focus: focusNodeId,
      direction: direction as SnapshotDirection,
      hops: maxHops ?? 2,
      includeTruncatedPaths,
    });

    if (format === 'table') {
      return okResult('em layout', {
        format,
        output: renderLayoutTable(snapshot),
      }, { projectId: ws.getManifest()?.id });
    }

    if (format === 'ascii') {
      return okResult('em layout', {
        format,
        output: renderLayoutAscii(snapshot),
      }, { projectId: ws.getManifest()?.id });
    }

    if (format === 'legacy') {
      return okResult('em layout', {
        layout: {
          nodes: snapshot.occurrences,
          edges: snapshot.renderedEdges,
          viewport: snapshot.layoutState.viewport,
        },
      }, { projectId: ws.getManifest()?.id });
    }

    if (format !== 'json') {
      return errResult('em layout', 'INVALID_FORMAT', `Unsupported layout format "${format}". Use json, table, or ascii.`);
    }

    return okResult('em layout', snapshot as unknown as Record<string, unknown>, { projectId: ws.getManifest()?.id });
  } catch (error) {
    if (error instanceof VisualizationSnapshotError) {
      return errResult('em layout', error.code, error.message, { details: error.details });
    }
    throw error;
  }
}
