export type NodeVisualKind = 'cmd' | 'evt' | 'viewModel' | 'ui' | 'trigger' | 'proc' | 'role' | 'shared';

const NODE_TYPE_VISUAL_KIND: Record<string, NodeVisualKind> = {
  'em.cmd': 'cmd',
  'em.evt': 'evt',
  'em.viewModel': 'viewModel',
  'em.ui': 'ui',
  'em.trigger': 'trigger',
  'em.proc': 'proc',
  'em.role': 'role',
  'em.shared': 'shared',
};

const NODE_VISUAL_KIND_LABEL: Record<NodeVisualKind, string> = {
  cmd: 'cmd',
  evt: 'event',
  viewModel: 'view model',
  ui: 'ui',
  trigger: 'trigger',
  proc: 'proc',
  role: 'role',
  shared: 'shared',
};

export function nodeVisualKindFromType(type: string | undefined): NodeVisualKind {
  return type ? NODE_TYPE_VISUAL_KIND[type] ?? 'shared' : 'shared';
}

export function nodeBadgeLabelFromType(type: string | undefined): string {
  return NODE_VISUAL_KIND_LABEL[nodeVisualKindFromType(type)];
}

export function nodeBadgeClassNameFromType(type: string | undefined): string {
  return `kind-${nodeVisualKindFromType(type)}`;
}
