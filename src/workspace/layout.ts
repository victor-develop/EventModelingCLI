import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ContextState } from '../domain/types';
import { contextPath, legacyContextPath, manifestPath, UnsafeProjectPathError } from '../fs-model/path-conventions';
import { readYamlFile } from '../fs-model/storage';

export type WorkspaceLayoutErrorCode =
  | 'WORKSPACE_PATH_INVALID'
  | 'WORKSPACE_PATH_OUTSIDE_ROOT'
  | 'WORKSPACE_PATH_ABSOLUTE_UNSUPPORTED'
  | 'WORKSPACE_AMBIGUOUS'
  | 'WORKSPACE_CONTEXT_INVALID'
  | 'WORKSPACE_CACHE_UNAVAILABLE'
  | 'WORKSPACE_ALREADY_EXISTS'
  | 'WORKSPACE_MIGRATION_CONFLICT';

export class WorkspaceLayoutError extends Error {
  constructor(
    public readonly code: WorkspaceLayoutErrorCode,
    message: string,
    public readonly targetPath?: string,
  ) {
    super(message);
    this.name = 'WorkspaceLayoutError';
  }
}

/**
 * Resolve the repository boundary once. A Git worktree/repository wins; when
 * Git metadata is unavailable, a persisted Event Modeling context is a local
 * boundary. Otherwise discovery deliberately stays inside the invocation dir.
 */
export function resolveRepositoryRoot(invocationDir: string): string {
  const start = path.resolve(invocationDir);
  let current = start;
  let contextRoot: string | undefined;
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    if (!contextRoot && (fs.existsSync(contextPath(current)) || fs.existsSync(legacyContextPath(current)))) {
      contextRoot = current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return contextRoot ?? start;
}

/** Resolve only repository-relative user input, rejecting absolute and traversal paths. */
export function resolveRepositoryRelativePath(repositoryRoot: string, requestedPath: string): string {
  if (!requestedPath || requestedPath.trim() === '') {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_INVALID', 'Workspace path must not be empty');
  }
  if (path.isAbsolute(requestedPath)) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_ABSOLUTE_UNSUPPORTED', `Absolute workspace paths are not supported: ${requestedPath}`, requestedPath);
  }
  if (requestedPath.includes('\0') || requestedPath.split(/[\\/]+/).some(segment => segment === '..')) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path must not traverse outside the repository: ${requestedPath}`, requestedPath);
  }
  const target = path.resolve(repositoryRoot, path.normalize(requestedPath));
  assertPathWithinRoot(repositoryRoot, target, requestedPath);
  return target;
}

/** Validate lexical and existing real-path containment to avoid symlink escapes. */
export function assertPathWithinRoot(repositoryRoot: string, targetPath: string, displayPath: string = targetPath): void {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(targetPath);
  if (!isPathWithin(root, target)) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path is outside the repository root: ${displayPath}`, displayPath);
  }

  const realRoot = fs.realpathSync.native(root);
  const realAnchor = realExistingAncestor(target);
  if (!isPathWithin(realRoot, realAnchor)) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path resolves outside the repository root: ${displayPath}`, displayPath);
  }
}

/** Fixed layout locations must never cross a symlink, even one pointing back inside the repository. */
export function assertNoSymlinkPathComponents(repositoryRoot: string, targetPath: string, displayPath: string = targetPath): void {
  const root = path.resolve(repositoryRoot);
  const target = path.resolve(targetPath);
  if (!isPathWithin(root, target)) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path is outside the repository root: ${displayPath}`, displayPath);
  }
  const relative = path.relative(root, target);
  let current = root;
  if (lstatIfPresent(current)?.isSymbolicLink()) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path contains a symbolic link: ${displayPath}`, displayPath);
  }
  if (!relative) return;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (lstatIfPresent(current)?.isSymbolicLink()) {
      throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace path contains a symbolic link: ${displayPath}`, displayPath);
    }
  }
}

export function projectCandidatesAt(directory: string, repositoryRoot: string = directory): string[] {
  const candidates = [
    directory,
    path.join(directory, '.event-modeling'),
    path.join(directory, 'docs', 'event-modeling'),
  ];
  const legacyProjectsDir = path.join(directory, 'projects');
  if (fs.existsSync(legacyProjectsDir) && fs.statSync(legacyProjectsDir).isDirectory()) {
    for (const entry of fs.readdirSync(legacyProjectsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(path.join(legacyProjectsDir, entry.name));
    }
  }
  return [...new Set(candidates.filter(candidate => {
    if (!isProjectDirectory(candidate)) return false;
    assertPathWithinRoot(repositoryRoot, candidate, candidate);
    assertNoSymlinkPathComponents(repositoryRoot, candidate, candidate);
    return true;
  }))].sort();
}

export function isProjectDirectory(candidate: string): boolean {
  try {
    return fs.existsSync(manifestPath(candidate));
  } catch (error) {
    if (error instanceof UnsafeProjectPathError) {
      throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace manifest path is unsafe: ${candidate}`, candidate);
    }
    throw error;
  }
}

/**
 * Resolve the nearest workspace without recursively searching arbitrary
 * project folders. At each ancestor only the documented locations and legacy
 * `projects/*` are considered. A cache context is an explicit local choice.
 */
export function discoverProjectDirectory(invocationDir: string, repositoryRoot: string): string | null {
  let current = path.resolve(invocationDir);
  const boundary = path.resolve(repositoryRoot);
  if (!isPathWithin(boundary, current)) current = boundary;

  while (true) {
    const cached = projectFromContext(current, contextPath(current));
    if (cached) return cached;
    const legacy = projectFromContext(current, legacyContextPath(current));
    if (legacy) return legacy;

    const candidates = projectCandidatesAt(current, boundary);
    if (candidates.length === 1) return candidates[0]!;
    if (candidates.length > 1) {
      throw new WorkspaceLayoutError(
        'WORKSPACE_AMBIGUOUS',
        `Multiple Event Modeling workspaces were found at ${current}. Use --path to select one.`,
        current,
      );
    }
    if (current === boundary) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function contextProjectDirectory(repositoryRoot: string, ctx: ContextState): string | null {
  if (!ctx.activeProjectDir) return null;
  const raw = ctx.activeProjectDir;
  let candidate: string;
  if (path.isAbsolute(raw)) {
    candidate = path.resolve(raw);
  } else {
    if (raw.split(/[\\/]+/).some(segment => segment === '..')) {
      throw new WorkspaceLayoutError('WORKSPACE_CONTEXT_INVALID', `Workspace context contains an unsafe project path: ${raw}`, raw);
    }
    candidate = path.resolve(repositoryRoot, raw);
  }
  try {
    assertPathWithinRoot(repositoryRoot, candidate, raw);
    assertNoSymlinkPathComponents(repositoryRoot, candidate, raw);
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) {
      throw new WorkspaceLayoutError('WORKSPACE_CONTEXT_INVALID', `Workspace context points outside the repository root: ${raw}`, raw);
    }
    throw error;
  }
  return isProjectDirectory(candidate) ? candidate : null;
}

export function toContextProjectDirectory(repositoryRoot: string, projectDir: string): string {
  assertPathWithinRoot(repositoryRoot, projectDir);
  assertNoSymlinkPathComponents(repositoryRoot, projectDir);
  const relative = path.relative(path.resolve(repositoryRoot), path.resolve(projectDir));
  if (!relative || relative === '.') return '.';
  return relative;
}

/**
 * Keep local runtime state out of Git for repositories initialized or migrated
 * by this CLI. The update is append-only and idempotent; a symlinked ignore
 * file is rejected by the same real-path containment check used for projects.
 */
export function ensureCacheIgnored(repositoryRoot: string): void {
  if (!fs.existsSync(path.join(repositoryRoot, '.git'))) return;
  const ignorePath = path.join(repositoryRoot, '.gitignore');
  try {
    assertPathWithinRoot(repositoryRoot, ignorePath, ignorePath);
    assertNoSymlinkPathComponents(repositoryRoot, ignorePath, ignorePath);
    const existing = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
    if (existing.split(/\r?\n/).some(line => ['.mp-cache', '.mp-cache/', '/.mp-cache', '/.mp-cache/'].includes(line.trim()))) {
      return;
    }
    const prefix = existing.length === 0 || existing.endsWith('\n') ? existing : `${existing}\n`;
    fs.writeFileSync(ignorePath, `${prefix}.mp-cache/\n`, 'utf8');
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) throw error;
    const detail = error instanceof Error ? error.message : 'unknown filesystem error';
    throw new WorkspaceLayoutError('WORKSPACE_CACHE_UNAVAILABLE', `Unable to maintain the local cache ignore rule at ${ignorePath}: ${detail}`, ignorePath);
  }
}

/** Migration copies model data, not links that could later escape its project boundary. */
export function assertProjectTreeHasNoSymlinks(projectDir: string): void {
  if (fs.lstatSync(projectDir).isSymbolicLink()) {
    throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace migration refuses symbolic links: ${projectDir}`, projectDir);
  }
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new WorkspaceLayoutError('WORKSPACE_PATH_OUTSIDE_ROOT', `Workspace migration refuses symbolic links: ${target}`, target);
      }
      if (entry.isDirectory()) visit(target);
    }
  };
  visit(projectDir);
}

function projectFromContext(root: string, filePath: string): string | null {
  try {
    assertPathWithinRoot(root, filePath, filePath);
    assertNoSymlinkPathComponents(root, filePath, filePath);
  } catch (error) {
    if (error instanceof WorkspaceLayoutError) {
      throw new WorkspaceLayoutError('WORKSPACE_CONTEXT_INVALID', `Workspace context path is unsafe: ${filePath}`, filePath);
    }
    throw error;
  }
  if (!fs.existsSync(filePath)) return null;
  const context = readYamlFile<ContextState>(filePath);
  if (!context) return null;
  return contextProjectDirectory(root, context);
}

function isPathWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function realExistingAncestor(target: string): string {
  let current = target;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return fs.realpathSync.native(current);
}

function lstatIfPresent(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
