import { getVisibleLaneLabel, toVisibleLane, type VisibleLane } from '@em/viewer-contract/lanePolicy';

export const NODE_COLORS: Record<string, string> = {
  cmd: '#2f6f73',
  evt: '#b86b4b',
  viewModel: '#705c8f',
  shared: '#8c6f3d',
};

export const EDGE_COLORS: Record<string, string> = {
  'shared-to-cmd': '#8c6f3d',
  'cmd-to-evt': '#2f6f73',
  'evt-to-viewModel': '#b86b4b',
  'viewModel-to-shared': '#705c8f',
  'evt-to-shared': '#64706c',
};

export const LANE_BG: Record<VisibleLane, string> = {
  shared: 'rgba(140,111,61,0.03)',
  commandViewModel: 'rgba(74,144,217,0.03)',
  event: 'rgba(123,104,238,0.03)',
};

export function getLaneBg(lane: string): string {
  return LANE_BG[toVisibleLane(lane)];
}

export function getLaneLabel(lane: string): string {
  return getVisibleLaneLabel(lane);
}

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface RootNodeInfo {
  canonicalId: string;
  kind: string;
  displayName: string;
}

export interface WalkInfo {
  canWalkLeft: boolean;
  canWalkRight: boolean;
  walkCount: number;
}
