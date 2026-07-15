import type { Node } from '@xyflow/react';
import type { Node as DomainNode } from '@em/domain/types';
import type { Occurrence, SwimlaneRect } from '@em/layout/types';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import {
  createLaneDescriptors,
  getSnapshotLaneDescriptors,
  getVisibleLaneLabel,
  toVisibleLane,
} from './lanePolicy';
import type { FrontierHandleData, ReactFlowNodeData, SwimlaneNodeData } from './types';

type InteractionMode = 'full' | 'patch';

export function toReactFlowNodes(
  snapshot: VisualizationSnapshot,
  options: { includeFrontierHandles?: boolean } = {},
): Node[] {
  const laneDescriptors = getSnapshotLaneDescriptors(snapshot);
  const laneNodes = toReactFlowLaneNodes(snapshot.swimlaneRects, laneDescriptors);
  const occurrenceNodes = snapshot.occurrences.map((occurrence) => toReactFlowOccurrenceNode({
    occurrence,
    swimlaneRects: snapshot.swimlaneRects,
    domainNodes: snapshot.domainNodes,
    interactionMode: 'full',
  }));
  const frontierNodes = options.includeFrontierHandles ? toFrontierHandleNodes(snapshot) : [];

  return [...laneNodes, ...occurrenceNodes, ...frontierNodes];
}

export function toReactFlowLaneNodes(
  swimlaneRects: SwimlaneRect[],
  laneDescriptors = createLaneDescriptors({ lanes: swimlaneRects.map((rect) => rect.lane) }),
): Node<SwimlaneNodeData>[] {
  const rectByLane = new Map(swimlaneRects.map((rect) => [toVisibleLane(rect.lane), rect]));
  return laneDescriptors.flatMap((descriptor) => {
    const rect = rectByLane.get(descriptor.id);
    if (!rect) return [];
    return [toReactFlowLaneNode(rect, descriptor.label)];
  });
}

export function toReactFlowLaneNode(
  rect: SwimlaneRect,
  label = getVisibleLaneLabel(rect.lane),
): Node<SwimlaneNodeData> {
  const lane = toVisibleLane(rect.lane);
  return {
    id: `lane:${lane}`,
    type: 'swimlaneGroup',
    position: { x: rect.x, y: rect.y },
    data: { lane, label },
    draggable: false,
    selectable: false,
    connectable: false,
    zIndex: 0,
    style: { width: rect.width, height: rect.height },
  };
}

export function toReactFlowOccurrenceNode(args: {
  occurrence: Occurrence;
  swimlaneRects: SwimlaneRect[];
  domainNodes: Record<string, DomainNode | undefined>;
  interactionMode?: InteractionMode;
}): Node<ReactFlowNodeData> {
  const visibleLane = toVisibleLane(args.occurrence.lane);
  const laneRect = args.swimlaneRects.find((rect) => toVisibleLane(rect.lane) === visibleLane);
  const lockLevel = normalizeLockLevel(args.occurrence.lockLevel);
  const baseNode: Node<ReactFlowNodeData> = {
    id: args.occurrence.occurrenceId,
    type: toOccurrenceNodeType(args.occurrence),
    parentId: `lane:${visibleLane}`,
    extent: 'parent',
    position: {
      x: args.occurrence.x - (laneRect?.x ?? 0),
      y: args.occurrence.y - (laneRect?.y ?? 0),
    },
    data: {
      canonicalNodeId: args.occurrence.canonicalNodeId,
      label: getDomainNodeLabel(
        args.domainNodes[args.occurrence.canonicalNodeId],
        args.occurrence.canonicalNodeId,
      ),
      visibleLane,
      lockLevel,
    },
  };

  if (args.interactionMode === 'patch') {
    return baseNode;
  }

  return {
    ...baseNode,
    draggable: lockLevel !== 'hard',
    selectable: true,
    connectable: false,
  };
}

function toOccurrenceNodeType(occurrence: Occurrence): string {
  if (occurrence.nodeKind === 'role' || occurrence.displayRole === 'role') return 'em.role';
  if (occurrence.nodeKind === 'cmd') return 'em.cmd';
  if (occurrence.nodeKind === 'evt') return 'em.evt';
  if (occurrence.nodeKind === 'viewModel') return 'em.viewModel';
  if (occurrence.displayRole === 'trigger') return 'em.trigger';
  if (occurrence.displayRole === 'processor') return 'em.proc';
  if (occurrence.displayRole === 'ui') return 'em.ui';
  return 'em.shared';
}

function getDomainNodeLabel(node: DomainNode | undefined, canonicalNodeId: string): string {
  const fixtureName = (node as unknown as { name?: string } | undefined)?.name;
  return node?.displayName ?? fixtureName ?? fallbackCanonicalLabel(canonicalNodeId);
}

function normalizeLockLevel(lockLevel: string): string {
  return lockLevel === 'free' ? 'none' : lockLevel;
}

function fallbackCanonicalLabel(canonicalNodeId: string): string {
  if (canonicalNodeId.startsWith('role.')) {
    return titleize(canonicalNodeId.slice('role.'.length));
  }
  return canonicalNodeId;
}

function titleize(value: string): string {
  const words = value.split(/[._-]+/).filter(Boolean);
  if (words.length === 0) return value;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function toFrontierHandleNodes(snapshot: VisualizationSnapshot): Node<FrontierHandleData>[] {
  if (snapshot.occurrences.length === 0) return [];
  const minX = Math.min(...snapshot.occurrences.map((occurrence) => occurrence.x));
  const maxX = Math.max(...snapshot.occurrences.map((occurrence) => occurrence.x + occurrence.width));
  const midY = swimlaneMidpoint(snapshot.swimlaneRects);

  return [
    {
      id: 'frontier:left',
      type: 'frontierHandle',
      position: { x: minX - 96, y: midY },
      data: { direction: 'left', label: 'Explore left' },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 4,
    },
    {
      id: 'frontier:right',
      type: 'frontierHandle',
      position: { x: maxX + 52, y: midY },
      data: { direction: 'right', label: 'Explore right' },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: 4,
    },
  ];
}

function swimlaneMidpoint(swimlaneRects: SwimlaneRect[]): number {
  if (swimlaneRects.length === 0) return 0;
  const minY = Math.min(...swimlaneRects.map((rect) => rect.y));
  const maxY = Math.max(...swimlaneRects.map((rect) => rect.y + rect.height));
  return minY + (maxY - minY) / 2 - 22;
}
