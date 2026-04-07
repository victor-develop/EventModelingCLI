import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  Node, Edge, ProjectManifest, Revision, Draft, Proposal,
  CommandSchema, EventSchema, ViewModelSchema, ContextState,
} from '../domain/types';
import { readYamlFile, writeYamlFile, listYamlFiles, deleteFile } from '../fs-model/storage';
import {
  manifestPath, nodePath, edgePath, schemaPath, viewModelSchemaPath,
  revisionPath, draftPath, proposalPath, contextPath, ensureProjectDirs,
} from '../fs-model/path-conventions';

export class Workspace {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? process.cwd();
  }

  private getCtxPath(): string {
    return contextPath(this.baseDir);
  }

  private readContext(): ContextState {
    return readYamlFile<ContextState>(this.getCtxPath()) ?? {};
  }

  private writeContext(ctx: ContextState): void {
    writeYamlFile(this.getCtxPath(), ctx);
  }

  initProject(name: string): { projectDir: string; manifest: ProjectManifest } {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const projectId = `proj_${slug}`;
    const projectDir = path.join(this.baseDir, 'projects', slug);
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

    const ctx = this.readContext();
    ctx.activeProjectId = projectId;
    ctx.activeProjectDir = projectDir;
    ctx.activeDraftId = undefined;
    ctx.checkedOutRevisionId = undefined;
    this.writeContext(ctx);

    return { projectDir, manifest };
  }

  openProject(idOrName: string): ProjectManifest | null {
    const projectsDir = path.join(this.baseDir, 'projects');
    if (!fs.existsSync(projectsDir)) return null;

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const mPath = manifestPath(path.join(projectsDir, entry.name));
      const m = readYamlFile<ProjectManifest>(mPath);
      if (m && (m.id === idOrName || m.name === idOrName)) {
        const ctx = this.readContext();
        const projectDir = path.join(projectsDir, entry.name);
        ctx.activeProjectId = m.id;
        ctx.activeProjectDir = projectDir;
        ctx.activeDraftId = undefined;
        this.writeContext(ctx);
        return m;
      }
    }
    return null;
  }

  getProjectDir(): string | null {
    const ctx = this.readContext();
    return ctx.activeProjectDir ?? null;
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
    const direct = readYamlFile<Node>(nodePath(dir, idOrCanonicalId));
    if (direct) return direct;
    for (const f of listYamlFiles(path.join(dir, 'nodes'))) {
      const n = readYamlFile<Node>(f);
      if (n && n.id === idOrCanonicalId) return n;
    }
    return null;
  }

  listNodes(): Node[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(path.join(dir, 'nodes'))
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
    return readYamlFile<Edge>(edgePath(dir, id));
  }

  listEdges(): Edge[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(path.join(dir, 'edges'))
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
    return readYamlFile<CommandSchema>(schemaPath(dir, cmdNodeId));
  }

  saveEventSchema(schema: EventSchema): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(schemaPath(dir, schema.eventNodeId), schema);
  }

  getEventSchema(evtNodeId: string): EventSchema | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return readYamlFile<EventSchema>(schemaPath(dir, evtNodeId));
  }

  saveViewModelSchema(schema: ViewModelSchema): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(viewModelSchemaPath(dir, schema.viewModelNodeId), schema);
  }

  getViewModelSchema(viewNodeId: string): ViewModelSchema | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return readYamlFile<ViewModelSchema>(viewModelSchemaPath(dir, viewNodeId));
  }

  saveRevision(rev: Revision): void {
    const dir = this.getProjectDir();
    if (!dir) throw new Error('No active project');
    writeYamlFile(revisionPath(dir, rev.id), rev);
  }

  getRevision(id: string): Revision | null {
    const dir = this.getProjectDir();
    if (!dir) return null;
    return readYamlFile<Revision>(revisionPath(dir, id));
  }

  listRevisions(): Revision[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(path.join(dir, 'revisions'))
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
    return readYamlFile<Draft>(draftPath(dir, id));
  }

  listDrafts(): Draft[] {
    const dir = this.getProjectDir();
    if (!dir) return [];
    return listYamlFiles(path.join(dir, 'drafts'))
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
    return readYamlFile<Proposal>(proposalPath(dir, id));
  }
}
