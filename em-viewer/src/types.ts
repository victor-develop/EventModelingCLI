export const NODE_COLORS: Record<string, string> = {
  cmd: '#4A90D9',
  evt: '#7B68EE',
  viewModel: '#2ECC71',
  shared: '#F39C12',
};

export const EDGE_COLORS: Record<string, string> = {
  'shared-to-cmd': '#F39C12',
  'cmd-to-evt': '#4A90D9',
  'evt-to-viewModel': '#7B68EE',
  'viewModel-to-shared': '#2ECC71',
  'evt-to-shared': '#555',
};

export const LANE_BG: Record<string, string> = {
  nonRole: 'rgba(243,156,18,0.03)',
  commandViewModel: 'rgba(74,144,217,0.03)',
  event: 'rgba(123,104,238,0.03)',
};

export const LANE_LABELS: Record<string, string> = {
  nonRole: 'Trigger / Processor',
  commandViewModel: 'Command / ViewModel',
  event: 'Event',
};

const ROLE_LANE_COLORS = [
  'rgba(46,204,113,0.05)',
  'rgba(52,152,219,0.05)',
  'rgba(155,89,182,0.05)',
  'rgba(241,196,15,0.05)',
  'rgba(230,126,34,0.05)',
  'rgba(231,76,60,0.05)',
  'rgba(26,188,156,0.05)',
  'rgba(243,156,18,0.05)',
];

const roleColorCache = new Map<string, number>();

export function getLaneBg(lane: string): string {
  if (LANE_BG[lane]) return LANE_BG[lane];
  if (lane.startsWith('role:')) {
    const roleName = lane.slice(5);
    let idx = roleColorCache.get(roleName);
    if (idx === undefined) {
      idx = roleColorCache.size % ROLE_LANE_COLORS.length;
      roleColorCache.set(roleName, idx);
    }
    return ROLE_LANE_COLORS[idx];
  }
  return 'transparent';
}

export function getLaneLabel(lane: string): string {
  if (LANE_LABELS[lane]) return LANE_LABELS[lane];
  if (lane.startsWith('role:')) {
    const roleName = lane.slice(5);
    return `Role: ${roleName.charAt(0).toUpperCase() + roleName.slice(1)}`;
  }
  return lane;
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
