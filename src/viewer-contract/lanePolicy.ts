export type VisibleLane = 'shared' | 'commandViewModel' | 'event';

export const VISIBLE_LANE_ORDER: VisibleLane[] = ['shared', 'commandViewModel', 'event'];

export const VISIBLE_LANE_LABELS: Record<VisibleLane, string> = {
  shared: 'shared',
  commandViewModel: 'command / viewModel',
  event: 'event',
};

const VISIBLE_LANE_INDEX = new Map(VISIBLE_LANE_ORDER.map((lane, index) => [lane, index]));

export function toVisibleLane(lane: string | undefined): VisibleLane {
  if (lane === 'nonRole') return 'shared';
  if (lane?.startsWith('role:')) return 'shared';
  if (lane === 'commandViewModel') return 'commandViewModel';
  if (lane === 'event') return 'event';
  if (lane === 'shared') return 'shared';
  return 'shared';
}

export function getVisibleLaneLabel(lane: string | undefined): string {
  return VISIBLE_LANE_LABELS[toVisibleLane(lane)];
}

export function getVisibleLaneOrder(lane: string | undefined): number {
  return VISIBLE_LANE_INDEX.get(toVisibleLane(lane)) ?? 0;
}

export function createVisibleLaneMap(): Record<VisibleLane, string> {
  return { ...VISIBLE_LANE_LABELS };
}
