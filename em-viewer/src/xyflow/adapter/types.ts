import type { Node as DomainNode } from '@em/domain/types';
import type { DiffMarker, VisualizationSnapshot } from '@em/viewer-contract/types';

export type ReactFlowNodeData = {
  canonicalNodeId: string;
  label: string;
  visibleLane: string;
  lockLevel: string;
  diff?: DiffMarker;
};

export type SwimlaneNodeData = {
  lane: string;
  label: string;
};

export type OrthogonalEdgeData = {
  kind: string;
  diff?: DiffMarker;
};

export type FrontierHandleData = {
  direction: 'left' | 'right';
  label: string;
};

export type SnapshotContext = Pick<VisualizationSnapshot, 'domainNodes' | 'laneMap'> & {
  domainNodes: Record<string, DomainNode | undefined>;
};
