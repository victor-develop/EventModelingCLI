import { getVisibleLaneLabel, toVisibleLane, type VisibleLane } from '@em/viewer-contract/lanePolicy';

export const NODE_COLORS: Record<string, string> = {
  cmd: '#2f6f73',
  evt: '#b86b4b',
  viewModel: '#705c8f',
  ui: '#8c6f3d',
  trigger: '#8c6f3d',
  proc: '#8c6f3d',
  role: '#566096',
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
  role: 'rgba(86,96,150,0.04)',
  commandViewModel: 'rgba(74,144,217,0.03)',
  event: 'rgba(123,104,238,0.03)',
};

export function getLaneBg(lane: string): string {
  const visibleLane = toVisibleLane(lane);
  return LANE_BG[visibleLane.startsWith('role:') ? 'role' : visibleLane];
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
