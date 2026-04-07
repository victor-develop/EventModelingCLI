import * as path from 'node:path';

export function manifestPath(projectDir: string): string {
  return path.join(projectDir, 'mp.yaml');
}

export function nodePath(projectDir: string, canonicalId: string): string {
  return path.join(projectDir, 'nodes', `${canonicalId}.yaml`);
}

export function edgePath(projectDir: string, edgeId: string): string {
  return path.join(projectDir, 'edges', `${edgeId}.yaml`);
}

export function schemaPath(projectDir: string, canonicalId: string): string {
  return path.join(projectDir, 'schemas', `${canonicalId}.schema.yaml`);
}

export function viewModelSchemaPath(projectDir: string, canonicalId: string): string {
  return path.join(projectDir, 'view-model-schemas', `${canonicalId}.schema.yaml`);
}

export function revisionPath(projectDir: string, revisionId: string): string {
  return path.join(projectDir, 'revisions', `${revisionId}.yaml`);
}

export function draftPath(projectDir: string, draftId: string): string {
  return path.join(projectDir, 'drafts', `${draftId}.yaml`);
}

export function proposalPath(projectDir: string, proposalId: string): string {
  return path.join(projectDir, 'proposals', `${proposalId}.yaml`);
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
