import type { Node, Edge } from '../domain/types';
import type {
  LayoutState,
  Occurrence,
  RenderedEdge,
  SwimlaneRect,
} from '../layout/types';

export type SnapshotDirection = 'forward' | 'backward' | 'both';

export type LaneDescriptor = {
  id: string;
  label: string;
  kind: 'role' | 'shared' | 'commandViewModel' | 'event';
  sourceNodeId?: string;
};

export type VisualizationSnapshot = {
  focusNodeId: string;
  projectName: string;
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
