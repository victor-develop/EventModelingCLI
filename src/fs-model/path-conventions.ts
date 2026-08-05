import * as path from 'node:path';

export class UnsafeProjectPathError extends Error {
  constructor(filename: string) {
    super(`Unsafe project path segment: ${filename}`);
    this.name = 'UnsafeProjectPathError';
  }
}

export function manifestPath(projectDir: string): string {
  return path.join(projectDir, 'mp.yaml');
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
  return path.join(baseDir, 'context.yaml');
}

export function ensureProjectDirs(projectDir: string): void {
  const dirs = ['nodes', 'edges', 'schemas', 'view-model-schemas', 'revisions', 'drafts', 'proposals'];
  for (const d of dirs) {
    const fs = require('node:fs');
    fs.mkdirSync(path.join(projectDir, d), { recursive: true });
  }
}

function projectFilePath(projectDir: string, subdir: string, filename: string): string {
  const base = path.resolve(projectDir, subdir);
  const target = path.resolve(base, filename);
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UnsafeProjectPathError(filename);
  }
  return target;
}
