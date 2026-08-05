import type { Node, Edge } from '../domain/types';
import type {
  LayoutState,
  Occurrence,
  RenderedEdge,
  SwimlaneRect,
} from '../layout/types';

export type SnapshotDirection = 'forward' | 'backward' | 'both';
export type SnapshotGraphMode = 'current' | 'base' | 'after' | 'compare';
export type SnapshotDiffMode = 'off' | 'overlay';
export type DiffStatus = 'added' | 'changed' | 'removed';
export type ViewerDiffEntityType = 'node' | 'edge' | 'schema' | 'proposal';

export type DiffMarker = {
  status: DiffStatus;
  changeIds: string[];
};

export type ViewerDiffFieldChange = {
  path: string;
  status: DiffStatus;
  before?: unknown;
  after?: unknown;
};

export type ViewerDiffChange = {
  id: string;
  entityType: ViewerDiffEntityType;
  status: DiffStatus;
  title: string;
  targetNodeId?: string;
  targetEdgeId?: string;
  changedFields?: string[];
  fieldChanges?: ViewerDiffFieldChange[];
  before?: unknown;
  after?: unknown;
};

export type DraftContext = {
  id: string;
  status: string;
  baseRevisionId: string;
  message: string;
  graph: SnapshotGraphMode;
  diff: SnapshotDiffMode;
};

export type FocusResolution = {
  requestedFocus: string;
  resolvedFocus?: string;
  availability: 'current' | 'baseOnly' | 'afterOnly' | 'both' | 'missing';
};

export type DiffOverlay = {
  nodesByCanonicalId: Record<string, DiffMarker>;
  edgesById: Record<string, DiffMarker>;
  visibleChanges: ViewerDiffChange[];
  hiddenChanges: ViewerDiffChange[];
  summary: Record<string, number>;
};

export type LaneDescriptor = {
  id: string;
  label: string;
  kind: 'role' | 'shared' | 'commandViewModel' | 'event';
  sourceNodeId?: string;
};

export type VisualizationSnapshot = {
  focusNodeId: string;
  projectName: string;
  draft?: DraftContext;
  focusResolution?: FocusResolution;
  diffOverlay?: DiffOverlay;
  truncation: {
    includeTruncatedPaths: boolean;
    hiddenPathCount: number;
  };
  layoutState: LayoutState;
  occurrences: Occurrence[];
  renderedEdges: RenderedEdge[];
  swimlaneRects: SwimlaneRect[];
  laneDescriptors: LaneDescriptor[];
  domainNodes: Record<string, Node>;
  domainEdges: Record<string, Edge>;
  laneMap: Record<string, string>;
};

export class VisualizationSnapshotError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status = 400, details?: Record<string, unknown>) {
    super(message);
    this.name = 'VisualizationSnapshotError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
