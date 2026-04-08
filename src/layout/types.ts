import { NodeKind, EdgeType } from '../domain/types';

// ============================================================
// Display Lane Model
// ============================================================

export type DisplayLane = 'shared' | 'commandViewModel' | 'event';

export type DisplayNodeKind = 'shared' | 'cmd' | 'evt' | 'viewModel';

export type DisplayEdgeKind =
  | 'shared-to-cmd'
  | 'cmd-to-evt'
  | 'evt-to-viewModel'
  | 'viewModel-to-shared'
  | 'evt-to-shared';

export function toDisplayLane(kind: DisplayNodeKind): DisplayLane {
  switch (kind) {
    case 'shared': return 'shared';
    case 'cmd': return 'commandViewModel';
    case 'viewModel': return 'commandViewModel';
    case 'evt': return 'event';
  }
}

export function toDisplayNodeKind(nodeKind: string): DisplayNodeKind {
  if (nodeKind.startsWith('ui.')) return 'shared';
  if (nodeKind === 'trigger') return 'shared';
  if (nodeKind === 'proc') return 'shared';
  if (nodeKind === 'cmd') return 'cmd';
  if (nodeKind === 'evt') return 'evt';
  if (nodeKind === 'viewModel') return 'viewModel';
  return 'shared';
}

// ============================================================
// Normalized Path Envelope (spec section 3)
// ============================================================

export interface PathNode {
  type: 'node';
  nodeId: string;
  nodeKind: string;
  occurrenceId?: string;
}

export interface PathEdge {
  type: 'edge';
  edgeId: string;
  edgeType: EdgeType;
  displayDirection: 'forward' | 'backward';
}

export type PathStep = PathNode | PathEdge;

export interface Branch {
  branchId: string;
  direction: 'forward' | 'backward';
  path: PathStep[];
}

export interface Frontier {
  left?: { hasMore: boolean; cursor?: string };
  right?: { hasMore: boolean; cursor?: string };
}

export interface NormalizedPathEnvelope {
  anchor: {
    nodeId: string;
    occurrenceId?: string;
  };
  branches: Branch[];
  frontier: Frontier;
}

// ============================================================
// Semantic Lift (spec section 5)
// ============================================================

export interface DisplayEdge {
  displayEdgeId: string;
  fromNodeKind: DisplayNodeKind;
  toNodeKind: DisplayNodeKind;
  kind: DisplayEdgeKind;
  originalEdgeType: EdgeType;
  originalEdgeId: string;
}

// ============================================================
// Occurrence Model (spec sections 6-7, 11)
// ============================================================

export type LockLevel = 'hard' | 'soft' | 'free';

export type DisplayRole = 'command' | 'event' | 'projection' | 'trigger' | 'ui' | 'processor';

export interface Occurrence {
  occurrenceId: string;
  canonicalNodeId: string;
  nodeKind: DisplayNodeKind;
  lane: DisplayLane;
  stageIndex: number;
  rowIndex: number;
  displayRole: DisplayRole;
  branchClusterId: string;
  lockLevel: LockLevel;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================
// Rendered Edge (spec section 9)
// ============================================================

export interface RenderedEdge {
  displayEdgeId: string;
  fromOccurrenceId: string;
  toOccurrenceId: string;
  kind: DisplayEdgeKind;
  points: [number, number][];
  meta: Record<string, unknown>;
}

// ============================================================
// Layout State (spec section 11)
// ============================================================

export interface Viewport {
  minStage: number;
  maxStage: number;
  zoom: number;
  centerX: number;
  centerY: number;
}

export interface LayoutState {
  occurrences: Record<string, Occurrence>;
  displayEdges: Record<string, RenderedEdge>;
  stageBuckets: Record<number, string[]>;
  laneRows: Record<string, string[]>;
  locks: Record<string, LockLevel>;
  frontierHandles: Record<string, { direction: 'left' | 'right'; cursor?: string }>;
  viewport: Viewport;
}

// ============================================================
// Layout Patch (spec section 12.3)
// ============================================================

export interface LayoutPatch {
  addedOccurrences: Occurrence[];
  updatedOccurrences: Occurrence[];
  addedEdges: RenderedEdge[];
  updatedEdges: RenderedEdge[];
  updatedStageRange: {
    min: number;
    max: number;
  };
  viewportHint: {
    revealDirection?: 'left' | 'right';
  };
}

// ============================================================
// Layout Config
// ============================================================

export interface LayoutConfig {
  stageGap: number;
  rowGap: number;
  nodeWidth: number;
  nodeHeight: number;
  laneBaseY: Record<DisplayLane, number>;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  stageGap: 400,
  rowGap: 80,
  nodeWidth: 220,
  nodeHeight: 56,
  laneBaseY: {
    shared: 0,
    commandViewModel: 200,
    event: 400,
  },
};

// ============================================================
// Merge Key (spec section 7.4)
// ============================================================

export interface MergeKey {
  canonicalNodeId: string;
  stageIndex: number;
  displayRole: DisplayRole;
  branchClusterId: string;
}
