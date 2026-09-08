import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Draft, Edge, Node, Proposal, Revision } from '../src/domain/types';
import { routeCommand } from '../src/cli/router';
import { createServerApp } from '../src/cli/serve';
import { Workspace } from '../src/workspace/workspace';
import { writeYamlFile } from '../src/fs-model/storage';

describe('embedded workspace layout', () => {
  let repositoryRoot: string;

  beforeEach(() => {
    repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-workspace-layout-'));
    fs.writeFileSync(path.join(repositoryRoot, '.git'), 'gitdir: test\n');
  });

  afterEach(() => {
    fs.rmSync(repositoryRoot, { recursive: true, force: true });
  });

  test('initializes a version-controlled model under .event-modeling and writes runtime context to .mp-cache', () => {
    const ws = new Workspace(repositoryRoot);
    const result = routeCommand(ws, ['project', 'init', 'Order Management', '--path', '.event-modeling']);

    expect(result.ok).toBe(true);
    expect(ws.getProjectDir()).toBe(path.join(repositoryRoot, '.event-modeling'));
    expect(fs.existsSync(path.join(repositoryRoot, '.event-modeling', 'mp.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(repositoryRoot, '.mp-cache', 'context.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(repositoryRoot, 'context.yaml'))).toBe(false);
    expect(fs.readFileSync(path.join(repositoryRoot, '.gitignore'), 'utf8')).toContain('.mp-cache/');
    expect((routeCommand(ws, ['ctx']).data.workspace as any)).toEqual({
      repositoryRoot,
      projectPath: path.join(repositoryRoot, '.event-modeling'),
      cachePath: path.join(repositoryRoot, '.mp-cache'),
      contextPath: path.join(repositoryRoot, '.mp-cache', 'context.yaml'),
    });
  });

  test('initializes under docs/event-modeling and resolves the same project from a nested directory and serve', () => {
    const rootWorkspace = new Workspace(repositoryRoot);
    routeCommand(rootWorkspace, ['project', 'init', 'Order Management', '--path', 'docs/event-modeling']);
    const nestedDir = path.join(repositoryRoot, 'services', 'orders', 'src');
    fs.mkdirSync(nestedDir, { recursive: true });
    const nestedWorkspace = new Workspace(nestedDir);

    expect(routeCommand(nestedWorkspace, ['draft', 'start', '--n', 'nested change']).ok).toBe(true);
    expect(routeCommand(nestedWorkspace, ['cmd', 'new', 'order.cmd.nested-change']).ok).toBe(true);
    expect(rootWorkspace.getNode('order.cmd.nested-change')).not.toBeNull();
    expect(createServerApp(new Workspace(nestedDir)).manifest?.id).toBe('proj_order-management');
  });

  test('explicit --path overrides the locally active workspace', () => {
    const ws = new Workspace(repositoryRoot);
    routeCommand(ws, ['project', 'init', 'Primary', '--path', '.event-modeling']);
    routeCommand(ws, ['project', 'init', 'Documentation', '--path', 'docs/event-modeling']);

    const result = routeCommand(new Workspace(repositoryRoot), ['project', 'open', '--path', '.event-modeling']);

    expect(result.ok).toBe(true);
    expect((result.data.project as any).name).toBe('Primary');
    expect((result.data.project as any).projectPath).toBe(path.join(repositoryRoot, '.event-modeling'));
  });

  test('prefers the nearest discoverable workspace over an ancestor cache selection', () => {
    const ws = new Workspace(repositoryRoot);
    routeCommand(ws, ['project', 'init', 'Repository Model', '--path', '.event-modeling']);
    routeCommand(ws, ['project', 'init', 'Orders Model', '--path', 'services/orders/.event-modeling']);
    routeCommand(ws, ['project', 'open', '--path', '.event-modeling']);
    const nestedDir = path.join(repositoryRoot, 'services', 'orders', 'src');
    fs.mkdirSync(nestedDir, { recursive: true });

    const nested = new Workspace(nestedDir);

    expect(nested.getManifest()?.name).toBe('Orders Model');
    expect(nested.getProjectDir()).toBe(path.join(repositoryRoot, 'services', 'orders', '.event-modeling'));
  });

  test('rejects traversal and absolute workspace paths before writing', () => {
    const ws = new Workspace(repositoryRoot);
    const traversal = routeCommand(ws, ['project', 'init', 'Unsafe', '--path', '../outside']);
    const absolute = routeCommand(ws, ['project', 'open', '--path', path.join(repositoryRoot, 'absolute')]);

    expect(traversal).toMatchObject({ ok: false, error: { code: 'WORKSPACE_PATH_OUTSIDE_ROOT' } });
    expect(absolute).toMatchObject({ ok: false, error: { code: 'WORKSPACE_PATH_ABSOLUTE_UNSUPPORTED' } });
    expect(fs.existsSync(path.join(path.dirname(repositoryRoot), 'outside'))).toBe(false);
  });

  test('rejects a repository-relative path that escapes through an existing symlink', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-workspace-outside-'));
    try {
      fs.symlinkSync(outsideRoot, path.join(repositoryRoot, 'linked-outside'));

      const result = routeCommand(new Workspace(repositoryRoot), ['project', 'init', 'Unsafe', '--path', 'linked-outside/model']);

      expect(result).toMatchObject({ ok: false, error: { code: 'WORKSPACE_PATH_OUTSIDE_ROOT' } });
      expect(fs.existsSync(path.join(outsideRoot, 'model'))).toBe(false);
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('does not read or write an external context through a symlinked .mp-cache', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-cache-outside-'));
    try {
      const ws = new Workspace(repositoryRoot);
      routeCommand(ws, ['project', 'init', 'Safe', '--path', '.event-modeling']);
      fs.rmSync(path.join(repositoryRoot, '.mp-cache'), { recursive: true, force: true });
      fs.symlinkSync(outsideRoot, path.join(repositoryRoot, '.mp-cache'));
      fs.writeFileSync(path.join(outsideRoot, 'context.yaml'), 'activeProjectDir: .event-modeling\n');

      const result = routeCommand(new Workspace(repositoryRoot), ['ctx']);

      expect(result).toMatchObject({ ok: false, error: { code: 'WORKSPACE_CONTEXT_INVALID' } });
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('does not write artifacts through symlinked model directories or manifest files', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-artifact-outside-'));
    try {
      const ws = new Workspace(repositoryRoot);
      routeCommand(ws, ['project', 'init', 'Safe', '--path', '.event-modeling']);
      routeCommand(ws, ['draft', 'start', '--n', 'safe draft']);
      const projectDir = ws.getProjectDir()!;
      fs.rmSync(path.join(projectDir, 'nodes'), { recursive: true, force: true });
      fs.symlinkSync(outsideRoot, path.join(projectDir, 'nodes'));
      fs.writeFileSync(path.join(outsideRoot, 'external.yaml'), 'id: external\ncanonicalId: external\n');

      const readResult = routeCommand(ws, ['show', 'external']);
      expect(readResult).toMatchObject({ ok: false, error: { code: 'UNSAFE_PROJECT_PATH' } });

      const nodeResult = routeCommand(ws, ['cmd', 'new', 'safe.cmd.should-not-write']);

      expect(nodeResult).toMatchObject({ ok: false, error: { code: 'UNSAFE_PROJECT_PATH' } });
      expect(fs.existsSync(path.join(outsideRoot, 'safe.cmd.should-not-write.yaml'))).toBe(false);

      fs.rmSync(path.join(projectDir, 'nodes'), { recursive: true, force: true });
      fs.mkdirSync(path.join(projectDir, 'nodes'));
      fs.rmSync(path.join(projectDir, 'nodes'), { recursive: true, force: true });
      fs.symlinkSync(path.join(projectDir, 'edges'), path.join(projectDir, 'nodes'));
      const internalLinkResult = routeCommand(ws, ['cmd', 'new', 'safe.cmd.internal-link']);
      expect(internalLinkResult).toMatchObject({ ok: false, error: { code: 'UNSAFE_PROJECT_PATH' } });
      expect(fs.existsSync(path.join(projectDir, 'edges', 'safe.cmd.internal-link.yaml'))).toBe(false);

      fs.rmSync(path.join(projectDir, 'nodes'), { recursive: true, force: true });
      fs.mkdirSync(path.join(projectDir, 'nodes'));
      const manifest = path.join(projectDir, 'mp.yaml');
      const externalManifest = path.join(outsideRoot, 'mp.yaml');
      fs.renameSync(manifest, externalManifest);
      fs.symlinkSync(externalManifest, manifest);

      const manifestResult = routeCommand(new Workspace(repositoryRoot), ['draft', 'status']);

      expect(manifestResult).toMatchObject({ ok: false, error: { code: 'WORKSPACE_PATH_OUTSIDE_ROOT' } });
      expect(fs.readFileSync(externalManifest, 'utf8')).toContain('name: Safe');
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('does not follow a symlinked YAML artifact during model enumeration', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-artifact-file-outside-'));
    try {
      const ws = new Workspace(repositoryRoot);
      routeCommand(ws, ['project', 'init', 'Safe', '--path', '.event-modeling']);
      fs.writeFileSync(path.join(outsideRoot, 'external.yaml'), 'id: external\ncanonicalId: external\n');
      fs.symlinkSync(path.join(outsideRoot, 'external.yaml'), path.join(ws.getProjectDir()!, 'nodes', 'external.yaml'));

      const result = routeCommand(ws, ['validate']);

      expect(result).toMatchObject({ ok: false, error: { code: 'UNSAFE_PROJECT_PATH' } });
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('reports multiple standard workspaces as ambiguous when no explicit cache selection exists', () => {
    const ws = new Workspace(repositoryRoot);
    routeCommand(ws, ['project', 'init', 'Primary', '--path', '.event-modeling']);
    routeCommand(ws, ['project', 'init', 'Documentation', '--path', 'docs/event-modeling']);
    fs.rmSync(path.join(repositoryRoot, '.mp-cache'), { recursive: true, force: true });

    const result = routeCommand(new Workspace(repositoryRoot), ['ctx']);

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'WORKSPACE_AMBIGUOUS' },
    });
  });

  test('reads a legacy projects/<slug> workspace and root context.yaml', () => {
    const legacy = new Workspace(repositoryRoot);
    routeCommand(legacy, ['project', 'init', 'Legacy Project']);
    const cacheContext = path.join(repositoryRoot, '.mp-cache', 'context.yaml');
    const legacyContext = path.join(repositoryRoot, 'context.yaml');
    fs.renameSync(cacheContext, legacyContext);
    fs.rmdirSync(path.join(repositoryRoot, '.mp-cache'));

    const nestedDir = path.join(repositoryRoot, 'nested');
    fs.mkdirSync(nestedDir);
    const reopened = new Workspace(nestedDir);

    expect(reopened.getManifest()?.name).toBe('Legacy Project');
    expect(reopened.getProjectDir()).toBe(path.join(repositoryRoot, 'projects', 'legacy-project'));
    expect(routeCommand(reopened, ['ctx']).ok).toBe(true);
  });

  test('migrates without deleting source data and refuses a destination conflict', () => {
    const ws = new Workspace(repositoryRoot);
    routeCommand(ws, ['project', 'init', 'Legacy Project']);
    saveEveryArtifact(ws);
    const sourceDir = ws.getProjectDir()!;

    const migrated = routeCommand(ws, ['project', 'migrate', '--path', '.event-modeling']);

    expect(migrated.ok).toBe(true);
    expect(fs.existsSync(sourceDir)).toBe(true);
    expect(ws.getProjectDir()).toBe(path.join(repositoryRoot, '.event-modeling'));
    expect(ws.listNodes()).toHaveLength(3);
    expect(ws.listEdges()).toHaveLength(1);
    expect(ws.listCommandSchemas()).toHaveLength(1);
    expect(ws.listEventSchemas()).toHaveLength(1);
    expect(ws.listViewModelSchemas()).toHaveLength(1);
    expect(ws.listRevisions()).toHaveLength(1);
    expect(ws.listDrafts()).toHaveLength(1);
    expect(ws.listProposals()).toHaveLength(1);

    const conflict = routeCommand(ws, ['project', 'migrate', '--path', '.event-modeling']);
    expect(conflict).toMatchObject({ ok: false, error: { code: 'WORKSPACE_MIGRATION_CONFLICT' } });
    expect(fs.existsSync(path.join(sourceDir, 'mp.yaml'))).toBe(true);
  });

  test('refuses to migrate a source workspace containing a symbolic link', () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'em-migration-outside-'));
    try {
      const ws = new Workspace(repositoryRoot);
      routeCommand(ws, ['project', 'init', 'Legacy Project']);
      fs.rmSync(path.join(ws.getProjectDir()!, 'nodes'), { recursive: true, force: true });
      fs.symlinkSync(outsideRoot, path.join(ws.getProjectDir()!, 'nodes'));

      const result = routeCommand(ws, ['project', 'migrate', '--path', '.event-modeling']);

      expect(result).toMatchObject({ ok: false, error: { code: 'WORKSPACE_PATH_OUTSIDE_ROOT' } });
      expect(fs.existsSync(path.join(repositoryRoot, '.event-modeling'))).toBe(false);
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  test('refuses a migration when the source project directory itself is a symbolic link', () => {
    const ws = new Workspace(repositoryRoot);
    routeCommand(ws, ['project', 'init', 'Legacy Project']);
    const sourceDir = ws.getProjectDir()!;
    const sourceTarget = path.join(repositoryRoot, 'projects', 'legacy-project-target');
    fs.renameSync(sourceDir, sourceTarget);
    fs.symlinkSync(sourceTarget, sourceDir);

    const result = routeCommand(new Workspace(repositoryRoot), ['project', 'migrate', '--path', '.event-modeling']);

    expect(result).toMatchObject({ ok: false, error: { code: 'WORKSPACE_CONTEXT_INVALID' } });
    expect(fs.existsSync(path.join(repositoryRoot, '.event-modeling'))).toBe(false);
  });
});

function saveEveryArtifact(ws: Workspace): void {
  const projectId = ws.getManifest()!.id;
  const command = node(projectId, 'cmd.legacy-workflow', 'cmd');
  const event = node(projectId, 'evt.legacy-workflow-completed', 'evt');
  const view = node(projectId, 'vm.legacy-workflow', 'viewModel');
  ws.saveNode(command);
  ws.saveNode(event);
  ws.saveNode(view);
  ws.saveEdge({ id: 'edge_legacy', projectId, type: 'commandCausesEvent', fromNodeId: command.canonicalId, toNodeId: event.canonicalId });
  ws.saveCommandSchema({ commandNodeId: command.canonicalId, version: 1, input: { fields: [] } });
  ws.saveEventSchema({ eventNodeId: event.canonicalId, version: 1, payload: { fields: [] } });
  ws.saveViewModelSchema({ viewModelNodeId: view.canonicalId, fields: [] });
  ws.saveRevision(revision(projectId));
  ws.saveDraft(draft(projectId));
  ws.saveProposal(proposal());
}

function node(projectId: string, canonicalId: string, kind: Node['kind']): Node {
  return { id: canonicalId, projectId, kind, canonicalId, displayName: canonicalId, tags: [], domains: [] };
}

function revision(projectId: string): Revision {
  return { id: 'rev_001', projectId, parentRevisionId: null, message: 'legacy', createdAt: '2026-08-08T00:00:00.000Z', author: 'test' };
}

function draft(projectId: string): Draft {
  return {
    id: 'draft_001', projectId, baseRevisionId: 'rev_001', status: 'open', message: 'legacy', ops: [], proposals: [],
  };
}

function proposal(): Proposal {
  return {
    id: 'proposal_001', storyId: 'story.legacy', mode: 'core', candidateRootCommandIds: [],
    resolvedSubgraph: { coreNodes: [], interfaceNodes: [], boundaryNodes: [] }, overrides: [],
  };
}
