import type { Node } from './types';

export function roleDisplayName(canonicalId: string): string {
  const labelSource = canonicalId.startsWith('role.')
    ? canonicalId.slice('role.'.length)
    : canonicalId;
  const words = labelSource.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return canonicalId;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function createRoleNode(args: {
  projectId: string;
  canonicalId: string;
  id?: string;
  displayName?: string;
}): Node {
  return {
    id: args.id ?? args.canonicalId,
    projectId: args.projectId,
    kind: 'role',
    canonicalId: args.canonicalId,
    displayName: args.displayName ?? roleDisplayName(args.canonicalId),
    tags: [],
    domains: [],
  };
}
