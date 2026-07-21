import type { Node } from '../domain/types';
import { roleDisplayName } from '../domain/roles';
import type { Occurrence, SwimlaneRect } from '../layout/types';
import type { LaneDescriptor, VisualizationSnapshot } from './types';

export type VisibleLane = string;

export const VISIBLE_LANE_ORDER: VisibleLane[] = ['shared', 'commandViewModel', 'event'];

export const VISIBLE_LANE_LABELS: Record<string, string> = {
  shared: 'shared',
  commandViewModel: 'command / viewModel',
  event: 'event',
};

const CORE_LANE_KIND: Record<string, LaneDescriptor['kind']> = {
  shared: 'shared',
  commandViewModel: 'commandViewModel',
  event: 'event',
};

export function toVisibleLane(lane: string | undefined): VisibleLane {
  if (lane === 'nonRole') return 'shared';
  if (lane?.startsWith('role:')) return lane;
  if (lane === 'commandViewModel') return 'commandViewModel';
  if (lane === 'event') return 'event';
  if (lane === 'shared') return 'shared';
  return 'shared';
}

export function getVisibleLaneLabel(
  lane: string | undefined,
  descriptors?: LaneDescriptor[],
): string {
  const visibleLane = toVisibleLane(lane);
  return descriptors?.find((descriptor) => descriptor.id === visibleLane)?.label
    ?? VISIBLE_LANE_LABELS[visibleLane]
    ?? roleLaneFallbackLabel(visibleLane)
    ?? visibleLane;
}

export function getVisibleLaneOrder(
  lane: string | undefined,
  descriptors?: LaneDescriptor[],
): number {
  const visibleLane = toVisibleLane(lane);
  const descriptorIndex = descriptors?.findIndex((descriptor) => descriptor.id === visibleLane) ?? -1;
  if (descriptorIndex >= 0) return descriptorIndex;
  return createLaneDescriptors({ lanes: [visibleLane] }).findIndex((descriptor) => descriptor.id === visibleLane);
}

export function createVisibleLaneMap(descriptors?: LaneDescriptor[]): Record<string, string> {
  return Object.fromEntries((descriptors ?? createLaneDescriptors({ lanes: VISIBLE_LANE_ORDER }))
    .map((descriptor) => [descriptor.id, descriptor.label]));
}

export function createLaneDescriptors(args: {
  lanes: Iterable<string | undefined>;
  domainNodes?: Record<string, Node | undefined>;
}): LaneDescriptor[] {
  const visibleLanes = new Set<string>();
  for (const lane of args.lanes) {
    visibleLanes.add(toVisibleLane(lane));
  }

  const roleLanes = [...visibleLanes].filter((lane) => lane.startsWith('role:')).sort();
  const roleMode = roleLanes.length > 0;
  const ordered = roleMode
    ? [
      ...roleLanes,
      ...(visibleLanes.has('shared') ? ['shared'] : []),
      ...(visibleLanes.has('commandViewModel') ? ['commandViewModel'] : []),
      ...(visibleLanes.has('event') ? ['event'] : []),
    ]
    : VISIBLE_LANE_ORDER;

  return ordered.map((lane) => descriptorForLane(lane, args.domainNodes));
}

export function createLaneDescriptorsFromOccurrences(
  occurrences: Occurrence[],
  domainNodes?: Record<string, Node | undefined>,
): LaneDescriptor[] {
  return createLaneDescriptors({
    lanes: occurrences.map((occurrence) => occurrence.lane),
    domainNodes,
  });
}

export function getSnapshotLaneDescriptors(snapshot: VisualizationSnapshot): LaneDescriptor[] {
  if (Array.isArray(snapshot.laneDescriptors) && snapshot.laneDescriptors.length > 0) {
    return snapshot.laneDescriptors;
  }
  return createLaneDescriptors({
    lanes: [
      ...(snapshot.swimlaneRects ?? []).map((rect: SwimlaneRect) => rect.lane),
      ...(snapshot.occurrences ?? []).map((occurrence: Occurrence) => occurrence.lane),
    ],
    domainNodes: snapshot.domainNodes,
  });
}

function descriptorForLane(
  lane: string,
  domainNodes: Record<string, Node | undefined> | undefined,
): LaneDescriptor {
  if (lane.startsWith('role:')) {
    const sourceNodeId = lane.slice('role:'.length);
    const roleNode = domainNodes?.[sourceNodeId];
    const displayName = roleNode?.displayName;
    return {
      id: lane,
      kind: 'role',
      label: displayName && displayName !== sourceNodeId ? displayName : roleDisplayName(sourceNodeId),
      sourceNodeId,
    };
  }

  return {
    id: lane,
    kind: CORE_LANE_KIND[lane] ?? 'shared',
    label: VISIBLE_LANE_LABELS[lane] ?? lane,
  };
}

function roleLaneFallbackLabel(lane: string): string | undefined {
  return lane.startsWith('role:') ? roleDisplayName(lane.slice('role:'.length)) : undefined;
}
