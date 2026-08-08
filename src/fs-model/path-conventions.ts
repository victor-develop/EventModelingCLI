import * as path from 'node:path';
import * as fs from 'node:fs';

export class UnsafeProjectPathError extends Error {
  constructor(filename: string) {
    super(`Unsafe project path segment: ${filename}`);
    this.name = 'UnsafeProjectPathError';
  }
}

export function manifestPath(projectDir: string): string {
  return projectRootFilePath(projectDir, 'mp.yaml');
}

export function nodePath(projectDir: string, canonicalId: string): string {
  return projectFilePath(projectDir, 'nodes', `${canonicalId}.yaml`);
}

export function edgePath(projectDir: string, edgeId: string): string {
  return projectFilePath(projectDir, 'edges', `${edgeId}.yaml`);
}

export function schemaPath(projectDir: string, canonicalId: string): string {
  return projectFilePath(projectDir, 'schemas', `${canonicalId}.schema.yaml`);
}

export function viewModelSchemaPath(projectDir: string, canonicalId: string): string {
  return projectFilePath(projectDir, 'view-model-schemas', `${canonicalId}.schema.yaml`);
}

export function revisionPath(projectDir: string, revisionId: string): string {
  return projectFilePath(projectDir, 'revisions', `${revisionId}.yaml`);
}

export function draftPath(projectDir: string, draftId: string): string {
  return projectFilePath(projectDir, 'drafts', `${draftId}.yaml`);
}

export function proposalPath(projectDir: string, proposalId: string): string {
  return projectFilePath(projectDir, 'proposals', `${proposalId}.yaml`);
}

export function contextPath(baseDir: string): string {
  return path.join(baseDir, '.mp-cache', 'context.yaml');
}

/** The pre-embedded-workspace context location, kept readable for migration. */
export function legacyContextPath(baseDir: string): string {
  return path.join(baseDir, 'context.yaml');
}

export function ensureProjectDirs(projectDir: string): void {
  const dirs = ['nodes', 'edges', 'schemas', 'view-model-schemas', 'revisions', 'drafts', 'proposals'];
  for (const d of dirs) {
    const fs = require('node:fs');
    fs.mkdirSync(projectDirectoryPath(projectDir, d), { recursive: true });
  }
}

/** Resolve a persisted artifact directory without permitting symlink escapes. */
export function projectDirectoryPath(projectDir: string, subdir: string): string {
  const projectRoot = path.resolve(projectDir);
  const target = path.resolve(projectRoot, subdir);
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new UnsafeProjectPathError(subdir);
  assertArtifactPathContained(projectRoot, target, subdir);
  return target;
}

function projectFilePath(projectDir: string, subdir: string, filename: string): string {
  const projectRoot = path.resolve(projectDir);
  const base = projectDirectoryPath(projectRoot, subdir);
  const target = path.resolve(base, filename);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UnsafeProjectPathError(filename);
  }
  assertArtifactPathContained(projectRoot, target, filename);
  return target;
}

function projectRootFilePath(projectDir: string, filename: string): string {
  const projectRoot = path.resolve(projectDir);
  const target = path.resolve(projectRoot, filename);
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new UnsafeProjectPathError(filename);
  if (fs.existsSync(projectRoot)) assertArtifactPathContained(projectRoot, target, filename);
  return target;
}

function assertArtifactPathContained(projectRoot: string, target: string, label: string): void {
  if (!fs.existsSync(projectRoot)) return;
  assertNoArtifactSymlink(projectRoot, target, label);
  const realProjectRoot = fs.realpathSync.native(projectRoot);
  const realAnchor = realExistingAncestor(target);
  const anchorRelative = path.relative(realProjectRoot, realAnchor);
  if (anchorRelative.startsWith(`..${path.sep}`) || anchorRelative === '..' || path.isAbsolute(anchorRelative)) {
    throw new UnsafeProjectPathError(label);
  }
}

function assertNoArtifactSymlink(projectRoot: string, target: string, label: string): void {
  if (lstatIfPresent(projectRoot)?.isSymbolicLink()) throw new UnsafeProjectPathError(label);
  const relative = path.relative(projectRoot, target);
  if (!relative) return;
  let current = projectRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if (lstatIfPresent(current)?.isSymbolicLink()) {
      throw new UnsafeProjectPathError(label);
    }
  }
}

function lstatIfPresent(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
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
