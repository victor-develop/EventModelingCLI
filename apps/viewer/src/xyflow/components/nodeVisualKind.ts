import { Cpu, Database, Monitor, Radio, SquareTerminal, UserRound, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NODE_COLORS } from '../../types';

export type NodeVisualKind = 'cmd' | 'evt' | 'viewModel' | 'ui' | 'trigger' | 'proc' | 'role' | 'shared';

export interface NodeVisualMeta {
  color: string;
  Icon: LucideIcon;
  label: string;
  legendLabel: string;
}

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

const NODE_VISUAL_ICON: Record<NodeVisualKind, LucideIcon> = {
  cmd: SquareTerminal,
  evt: Radio,
  viewModel: Database,
  ui: Monitor,
  trigger: Zap,
  proc: Cpu,
  role: UserRound,
  shared: Monitor,
};

const NODE_VISUAL_LEGEND_LABEL: Record<NodeVisualKind, string> = {
  cmd: 'Command',
  evt: 'Event',
  viewModel: 'View Model',
  ui: 'UI',
  trigger: 'Trigger',
  proc: 'Proc',
  role: 'Role',
  shared: 'Shared',
};

export const LEGEND_NODE_VISUAL_KINDS: NodeVisualKind[] = ['cmd', 'evt', 'viewModel', 'ui', 'trigger', 'proc'];

export function nodeVisualKindFromType(type: string | undefined): NodeVisualKind {
  return type ? NODE_TYPE_VISUAL_KIND[type] ?? 'shared' : 'shared';
}

export function nodeBadgeLabelFromType(type: string | undefined): string {
  return NODE_VISUAL_KIND_LABEL[nodeVisualKindFromType(type)];
}

export function nodeBadgeClassNameFromType(type: string | undefined): string {
  return `kind-${nodeVisualKindFromType(type)}`;
}

export function nodeVisualMeta(kind: NodeVisualKind): NodeVisualMeta {
  return {
    color: NODE_COLORS[kind] ?? NODE_COLORS.shared,
    Icon: NODE_VISUAL_ICON[kind],
    label: NODE_VISUAL_KIND_LABEL[kind],
    legendLabel: NODE_VISUAL_LEGEND_LABEL[kind],
  };
}

export function nodeVisualMetaFromType(type: string | undefined): NodeVisualMeta {
  return nodeVisualMeta(nodeVisualKindFromType(type));
}
