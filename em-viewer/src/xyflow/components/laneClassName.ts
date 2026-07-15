export function laneClassName(lane: string): string {
  return lane.startsWith('role:') ? 'lane-role' : `lane-${lane}`;
}
