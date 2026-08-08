import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  Node, Edge, ProjectManifest, Revision, Draft, Proposal,
  CommandSchema, EventSchema, ViewModelSchema, ContextState,
} from '../domain/types';
import { readYamlFile, writeYamlFile, listYamlFiles, deleteFile } from '../fs-model/storage';
import {
  manifestPath, nodePath, edgePath, schemaPath, viewModelSchemaPath,
  revisionPath, draftPath, proposalPath, contextPath, legacyContextPath, ensureProjectDirs,
  projectDirectoryPath, UnsafeProjectPathError,
} from '../fs-model/path-conventions';
import {
  assertPathWithinRoot,
  assertProjectTreeHasNoSymlinks,
  assertNoSymlinkPathComponents,
  discoverProjectDirectory,
  ensureCacheIgnored,
  isProjectDirectory,
  projectCandidatesAt,
  resolveRepositoryRelativePath,
  resolveRepositoryRoot,
  toContextProjectDirectory,
  WorkspaceLayoutError,
} from './layout';

function hasStringProperty(value: unknown, key: string): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string');
}

export class Workspace {
  private readonly baseDir: string;
  private readonly repositoryRoot: string;
  private resolvedProjectDir: string | null | undefined;
  private resolutionError: WorkspaceLayoutError | null = null;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir ?? process.cwd());
    this.repositoryRoot = resolveRepositoryRoot(this.baseDir);
  }

  private getCtxPath(): string {
    return contextPath(this.repositoryRoot);
  }

  private readContext(): ContextState {
    return this.readContextFile(this.getCtxPath())
      ?? this.readContextFile(legacyContextPath(this.repositoryRoot))
      ?? {};
  }

  private writeContext(ctx: ContextState): void {
    const target = this.getCtxPath();
    try {
      assertPathWithinRoot(this.repositoryRoot, target, target);
      assertNoSymlinkPathComponents(this.repositoryRoot, target, target);
      writeYamlFile(target, ctx);
    } catch (error) {
      if (error instanceof WorkspaceLayoutError) throw error;
      const detail = error instanceof Error ? error.message : 'unknown filesystem error';
      throw new WorkspaceLayoutError('WORKSPACE_CACHE_UNAVAILABLE', `Unable to write local workspace context at ${target}: ${detail}`, target);
    }
  }

  private readContextFile(filePath: string): ContextState | null {
    try {
      assertPathWithinRoot(this.repositoryRoot, filePath, filePath);
      assertNoSymlinkPathComponents(this.repositoryRoot, filePath, filePath);
      if (!fs.existsSync(filePath)) return null;
      return readYamlFile<ContextState>(filePath);
    } catch (error) {
      if (error instanceof WorkspaceLayoutError) throw error;
      const detail = error instanceof Error ? error.message : 'unknown filesystem error';
      throw new WorkspaceLayoutError('WORKSPACE_CONTEXT_INVALID', `Unable to read workspace context at ${filePath}: ${detail}`, filePath);
    }
  }

  getRepositoryRoot(): string {
    return this.repositoryRoot;
  }

  getContextPath(): string {
    return this.getCtxPath();
  }

  getCacheDir(): string {
    return path.dirname(this.getCtxPath());
  }

  getResolutionError(): WorkspaceLayoutError | null {
    this.getProjectDir();
    return this.resolutionError;
  }

  initProject(name: string, requestedPath?: string): { projectDir: string; manifest: ProjectManifest } {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const projectId = `proj_${slug}`;
    const projectDir = requestedPath
      ? resolveRepositoryRelativePath(this.repositoryRoot, requestedPath)
      : path.join(this.repositoryRoot, 'projects', slug);
    assertPathWithinRoot(this.repositoryRoot, projectDir, requestedPath ?? projectDir);
    assertNoSymlinkPathComponents(this.repositoryRoot, projectDir, requestedPath ?? projectDir);
    if (fs.existsSync(projectDir)) {
      throw new WorkspaceLayoutError('WORKSPACE_ALREADY_EXISTS', `Workspace path already exists: ${requestedPath ?? projectDir}`, requestedPath ?? projectDir);
    }
    ensureCacheIgnored(this.repositoryRoot);
    fs.mkdirSync(projectDir, { recursive: true });
    ensureProjectDirs(projectDir);

    const manifest: ProjectManifest = {
      id: projectId,
      name,
      headRevisionId: null,
      nodeCounter: 0,
      edgeCounter: 0,
      revisionCounter: 0,
      draftCounter: 0,
      proposalCounter: 0,
    };
    writeYamlFile(manifestPath(projectDir), manifest);

    this.activateProject(manifest, projectDir, undefined);

    return { projectDir, manifest };
  }

  openProject(idOrName: string, requestedPath?: string): ProjectManifest | null {
    let projectDir: string | null = null;
    if (requestedPath) {
      projectDir = resolveRepositoryRelativePath(this.repositoryRoot, requestedPath);
      if (!isProjectDirectory(projectDir)) return null;
    } else {
      const active = this.getProjectDir();
      const candidates = [...new Set([
        ...(active ? [active] : []),
        ...projectCandidatesAt(this.repositoryRoot, this.repositoryRoot),
      ])];
      projectDir = candidates.find(candidate => {
        const manifest = readYamlFile<ProjectManifest>(manifestPath(candidate));
        return Boolean(manifest && (manifest.id === idOrName || manifest.name === idOrName));
      }) ?? null;
    }
    if (!projectDir) return null;
    const manifest = readYamlFile<ProjectManifest>(manifestPath(projectDir));
    if (!manifest || (idOrName && manifest.id !== idOrName && manifest.name !== idOrName)) return null;
    this.activateProject(manifest, projectDir, findOpenDraftId(projectDir));
    return manifest;
  }

  getProjectDir(): string | null {
    if (this.resolvedProjectDir !== undefined) return this.resolvedProjectDir;
    try {
      this.resolvedProjectDir = discoverProjectDirectory(this.baseDir, this.repositoryRoot);
    } catch (error) {
      if (error instanceof WorkspaceLayoutError) {
        this.resolutionError = error;
        this.resolvedProjectDir = null;
      } else {
        throw error;
      }
    }
    return this.resolvedProjectDir;
  }

  /** Copy a legacy/current workspace into a new repository-relative model directory without deleting the source. */
  migrateProject(requestedPath: string): { sourceDir: string; projectDir: string; manifest: ProjectManifest } {
    const sourceDir = this.getProjectDir();
    const manifest = this.getManifest();
    if (!sourceDir || !manifest) throw new Error('No active project');
    const projectDir = resolveRepositoryRelativePath(this.repositoryRoot, requestedPath);
    assertPathWithinRoot(this.repositoryRoot, projectDir, requestedPath);
    assertNoSymlinkPathComponents(this.repositoryRoot, projectDir, requestedPath);
    if (path.resolve(sourceDir) === path.resolve(projectDir)) {
      throw new WorkspaceLayoutError('WORKSPACE_MIGRATION_CONFLICT', `Migration target is already the active workspace: ${requestedPath}`, requestedPath);
    }
    if (fs.existsSync(projectDir)) {
      throw new WorkspaceLayoutError('WORKSPACE_MIGRATION_CONFLICT', `Migration target already exists and will not be overwritten: ${requestedPath}`, requestedPath);
    }
    assertProjectTreeHasNoSymlinks(sourceDir);
    ensureCacheIgnored(this.repositoryRoot);
    fs.cpSync(sourceDir, projectDir, { recursive: true, errorOnExist: true, force: false });
    this.activateProject(manifest, projectDir, findOpenDraftId(projectDir));
    return { sourceDir, projectDir, manifest };
  }

  private activateProject(manifest: ProjectManifest, projectDir: string, activeDraftId: string | undefined): void {
    assertPathWithinRoot(this.repositoryRoot, projectDir);
    assertNoSymlinkPathComponents(this.repositoryRoot, projectDir);
    const ctx = this.readContext();
    ctx.activeProjectId = manifest.id;
    ctx.activeProjectDir = toContextProjectDirectory(this.repositoryRoot, projectDir);
    ctx.activeDraftId = activeDraftId;
    ctx.checkedOutRevisionId = undefined;
    this.writeContext(ctx);
    this.resolvedProjectDir = projectDir;
    this.resolutionError = null;
  }

  getManifest(): ProjectManifest | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return readYamlFile<ProjectManifest>(manifestPath(dir));
  }

  updateManifest(updates: Partial<ProjectManifest>): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    const m = this.getManifest()!;
    writeYamlFile(manifestPath(dir), { ...m, ...updates });
  }

  getContext(): { project: ProjectManifest; draft?: Draft; revision?: Revision } | null {
    const ctx = this.readContext();
    const project = this.getManifest();
    if (!project) return null;
    const result: { project: ProjectManifest; draft?: Draft; revision?: Revision } = { project };
    if (ctx.activeDraftId) {
      result.draft = this.getDraft(ctx.activeDraftId) ?? undefined;
    }
    if (ctx.checkedOutRevisionId) {
      result.revision = this.getRevision(ctx.checkedOutRevisionId) ?? undefined;
    }
    return result;
  }

  setActiveDraft(draftId: string): void {
    const ctx = this.readContext();
    ctx.activeDraftId = draftId;
    this.writeContext(ctx);
  }

  setCheckedOutRevision(revisionId: string | null): void {
    const ctx = this.readContext();
    ctx.checkedOutRevisionId = revisionId ?? undefined;
    this.writeContext(ctx);
  }

  generateNodeId(): string {
    const m = this.getManifest()!;
    const n = m.nodeCounter + 1;
    this.updateManifest({ nodeCounter: n });
    return `node_${n}`;
  }

  generateEdgeId(): string {
    const m = this.getManifest()!;
    const n = m.edgeCounter + 1;
    this.updateManifest({ edgeCounter: n });
    return `edge_${n}`;
  }

  generateRevisionId(): string {
    const m = this.getManifest()!;
    const n = m.revisionCounter + 1;
    this.updateManifest({ revisionCounter: n });
    return `rev_${String(n).padStart(3, '0')}`;
  }

  generateDraftId(): string {
    const m = this.getManifest()!;
    const n = m.draftCounter + 1;
    this.updateManifest({ draftCounter: n });
    return `draft_${String(n).padStart(3, '0')}`;
  }

  generateProposalId(): string {
    const m = this.getManifest()!;
    const n = m.proposalCounter + 1;
    this.updateManifest({ proposalCounter: n });
    return `proposal_${String(n).padStart(3, '0')}`;
  }

  saveNode(node: Node): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(nodePath(dir, node.canonicalId), node);
  }

  getNode(idOrCanonicalId: string): Node | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    const direct = safeReadYamlFile<Node>(() => nodePath(dir, idOrCanonicalId));
    if (direct) return direct;
    for (const f of listYamlFiles(projectDirectoryPath(dir, 'nodes'))) {
      const n = readYamlFile<Node>(f);
      if (n && n.id === idOrCanonicalId) return n;
    }
    return null;
  }

  listNodes(): Node[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'nodes'))
      .map(f => readYamlFile<Node>(f))
      .filter((n): n is Node => n !== null);
  }

  deleteNode(canonicalId: string): void {
    const dir = this.getProjectDir();
    if (!dir) return;
    deleteFile(nodePath(dir, canonicalId));
  }

  saveEdge(edge: Edge): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(edgePath(dir, edge.id), edge);
  }

  getEdge(id: string): Edge | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<Edge>(() => edgePath(dir, id));
  }

  listEdges(): Edge[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'edges'))
      .map(f => readYamlFile<Edge>(f))
      .filter((e): e is Edge => e !== null);
  }

  deleteEdge(id: string): void {
    const dir = this.getProjectDir();
    if (!dir) return;
    deleteFile(edgePath(dir, id));
  }

  saveCommandSchema(schema: CommandSchema): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(schemaPath(dir, schema.commandNodeId), schema);
  }

  getCommandSchema(cmdNodeId: string): CommandSchema | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<CommandSchema>(() => schemaPath(dir, cmdNodeId));
  }

  listCommandSchemas(): CommandSchema[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'schemas'))
      .map(f => readYamlFile<unknown>(f))
      .filter((schema): schema is CommandSchema => hasStringProperty(schema, 'commandNodeId'));
  }

  saveEventSchema(schema: EventSchema): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(schemaPath(dir, schema.eventNodeId), schema);
  }

  getEventSchema(evtNodeId: string): EventSchema | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<EventSchema>(() => schemaPath(dir, evtNodeId));
  }

  listEventSchemas(): EventSchema[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'schemas'))
      .map(f => readYamlFile<unknown>(f))
      .filter((schema): schema is EventSchema => hasStringProperty(schema, 'eventNodeId'));
  }

  saveViewModelSchema(schema: ViewModelSchema): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(viewModelSchemaPath(dir, schema.viewModelNodeId), schema);
  }

  getViewModelSchema(viewNodeId: string): ViewModelSchema | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<ViewModelSchema>(() => viewModelSchemaPath(dir, viewNodeId));
  }

  listViewModelSchemas(): ViewModelSchema[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'view-model-schemas'))
      .map(f => readYamlFile<unknown>(f))
      .filter((schema): schema is ViewModelSchema => hasStringProperty(schema, 'viewModelNodeId'));
  }

  saveRevision(rev: Revision): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(revisionPath(dir, rev.id), rev);
  }

  getRevision(id: string): Revision | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<Revision>(() => revisionPath(dir, id));
  }

  listRevisions(): Revision[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'revisions'))
      .map(f => readYamlFile<Revision>(f))
      .filter((r): r is Revision => r !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  saveDraft(draft: Draft): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(draftPath(dir, draft.id), draft);
  }

  getDraft(id: string): Draft | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<Draft>(() => draftPath(dir, id));
  }

  listDrafts(): Draft[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'drafts'))
      .map(f => readYamlFile<Draft>(f))
      .filter((d): d is Draft => d !== null);
  }

  saveProposal(proposal: Proposal): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(proposalPath(dir, proposal.id), proposal);
  }

  getProposal(id: string): Proposal | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return safeReadYamlFile<Proposal>(() => proposalPath(dir, id));
  }

  listProposals(): Proposal[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(projectDirectoryPath(dir, 'proposals'))
      .map(f => readYamlFile<Proposal>(f))
      .filter((proposal): proposal is Proposal => proposal !== null);
  }
}

function safeReadYamlFile<T>(pathFactory: () => string): T | null {
  try {
    return readYamlFile<T>(pathFactory());
  } catch (error) {
    if (error instanceof UnsafeProjectPathError) return null;
    throw error;
  }
}

function findOpenDraftId(projectDir: string): string | undefined {
  return listYamlFiles(projectDirectoryPath(projectDir, 'drafts'))
    .map(f => readYamlFile<Draft>(f))
    .find((draft): draft is Draft => draft?.status === 'open')
    ?.id;
}
