import type { Edge, Node } from '@xyflow/react';
import type { LayoutPatch, Occurrence, RenderedEdge, SwimlaneRect } from 'event-modeling-spec-cli/layout/types';
import { createLaneDescriptors, toVisibleLane } from './lanePolicy';
import { toReactFlowEdge } from './toReactFlowEdges';
import { toReactFlowLaneNode, toReactFlowOccurrenceNode } from './toReactFlowNodes';
import type { SnapshotContext } from './types';

type FixtureCompatiblePatch = LayoutPatch & {
  addedRenderedEdges?: RenderedEdge[];
  updatedRenderedEdges?: RenderedEdge[];
  type?: string;
};

export function applyLayoutPatchToReactFlow(args: {
  patch: FixtureCompatiblePatch;
  previousNodes: Node[];
  previousEdges: Edge[];
  snapshotContext: SnapshotContext;
}): {
  nodes: Node[];
  edges: Edge[];
} {
  const updatedSwimlaneRects = args.patch.updatedSwimlaneRects ?? [];
  const occurrencePatchIds = new Set([
    ...(args.patch.addedOccurrences ?? []).map((occurrence) => occurrence.occurrenceId),
    ...(args.patch.updatedOccurrences ?? []).map((occurrence) => occurrence.occurrenceId),
  ]);
  const laneUpdate = updateLaneNodes(args.previousNodes, updatedSwimlaneRects, args.snapshotContext);
  const nodes = preserveStableChildAbsolutePositions(laneUpdate.nodes, laneUpdate.laneDeltas, occurrencePatchIds);
  const withAddedOccurrences = upsertOccurrences({
    nodes,
    occurrences: args.patch.addedOccurrences ?? [],
    swimlaneRects: updatedSwimlaneRects,
    snapshotContext: args.snapshotContext,
    forceSelectedDefault: false,
  });
  const nextNodes = upsertOccurrences({
    nodes: withAddedOccurrences,
    occurrences: args.patch.updatedOccurrences ?? [],
    swimlaneRects: updatedSwimlaneRects,
    snapshotContext: args.snapshotContext,
  });

  const addedEdges = args.patch.addedEdges ?? args.patch.addedRenderedEdges ?? [];
  const updatedEdges = args.patch.updatedEdges ?? args.patch.updatedRenderedEdges ?? [];
  const edges = upsertEdges(upsertEdges(args.previousEdges, addedEdges), updatedEdges);

  return { nodes: updateFrontierHandleNodes(nextNodes), edges };
}

function updateLaneNodes(
  previousNodes: Node[],
  updatedSwimlaneRects: SwimlaneRect[],
  snapshotContext: SnapshotContext,
): { nodes: Node[]; laneDeltas: Map<string, { dx: number; dy: number }> } {
  if (updatedSwimlaneRects.length === 0) return { nodes: [...previousNodes], laneDeltas: new Map() };
  const rectByLane = new Map(updatedSwimlaneRects.map((rect) => [toVisibleLane(rect.lane), rect]));
  const labelsByLane = new Map(createLaneDescriptors({
    lanes: updatedSwimlaneRects.map((rect) => rect.lane),
    domainNodes: snapshotContext.domainNodes,
  }).map((descriptor) => [
    descriptor.id,
    snapshotContext.laneMap[descriptor.id] ?? descriptor.label,
  ]));
  const laneDeltas = new Map<string, { dx: number; dy: number }>();
  const seenLaneNodeIds = new Set<string>();

  const nodes = previousNodes.map((node) => {
    if (!node.id.startsWith('lane:')) return node;
    const lane = toVisibleLane(node.id.slice('lane:'.length));
    const rect = rectByLane.get(lane);
    if (!rect) return node;
    seenLaneNodeIds.add(node.id);
    laneDeltas.set(node.id, {
      dx: rect.x - node.position.x,
      dy: rect.y - node.position.y,
    });
    return {
      ...node,
      position: { x: rect.x, y: rect.y },
      style: { ...(node.style ?? {}), width: rect.width, height: rect.height },
      data: { lane, label: labelsByLane.get(lane) ?? lane },
    };
  });

  for (const [lane, rect] of rectByLane) {
    const id = `lane:${lane}`;
    if (seenLaneNodeIds.has(id) || nodes.some((node) => node.id === id)) continue;
    nodes.push(toReactFlowLaneNode(rect, labelsByLane.get(lane)));
  }

  return { nodes, laneDeltas };
}

function preserveStableChildAbsolutePositions(
  nodes: Node[],
  laneDeltas: Map<string, { dx: number; dy: number }>,
  occurrencePatchIds: Set<string>,
): Node[] {
  if (laneDeltas.size === 0) return nodes;

  return nodes.map((node) => {
    if (!node.parentId || occurrencePatchIds.has(node.id)) return node;
    const delta = laneDeltas.get(node.parentId);
    if (!delta || (delta.dx === 0 && delta.dy === 0)) return node;
    return {
      ...node,
      position: {
        x: node.position.x - delta.dx,
        y: node.position.y - delta.dy,
      },
    };
  });
}

function upsertOccurrences(args: {
  nodes: Node[];
  occurrences: Occurrence[];
  swimlaneRects: SwimlaneRect[];
  snapshotContext: SnapshotContext;
  forceSelectedDefault?: boolean;
}): Node[] {
  if (args.occurrences.length === 0) return args.nodes;

  const result = [...args.nodes];
  for (const occurrence of args.occurrences) {
    const existingIndex = result.findIndex((node) => node.id === occurrence.occurrenceId);
    const existing = existingIndex >= 0 ? result[existingIndex] : undefined;
    const next = {
      ...toReactFlowOccurrenceNode({
        occurrence,
        swimlaneRects: args.swimlaneRects,
        domainNodes: args.snapshotContext.domainNodes,
        interactionMode: 'patch',
      }),
      selected: existing?.selected ?? args.forceSelectedDefault ?? false,
    };

    if (existingIndex >= 0) {
      result[existingIndex] = {
        ...existing,
        ...next,
        selected: existing?.selected,
      };
    } else {
      result.push(next);
    }
  }
  return result;
}

function upsertEdges(previousEdges: Edge[], renderedEdges: RenderedEdge[]): Edge[] {
  if (renderedEdges.length === 0) return previousEdges;

  const result = [...previousEdges];
  for (const renderedEdge of renderedEdges) {
    const next = toReactFlowEdge(renderedEdge);
    const existingIndex = result.findIndex((edge) => edge.id === next.id);
    if (existingIndex >= 0) {
      result[existingIndex] = { ...result[existingIndex], ...next };
    } else {
      result.push(next);
    }
  }
  return result;
}

function updateFrontierHandleNodes(nodes: Node[]): Node[] {
  const occurrenceNodes = nodes.filter((node) => node.parentId && !node.id.startsWith('frontier:'));
  if (occurrenceNodes.length === 0) return nodes;

  const laneById = new Map(nodes.filter((node) => node.id.startsWith('lane:')).map((node) => [node.id, node]));
  const absoluteRects = occurrenceNodes.flatMap((node) => {
    const lane = node.parentId ? laneById.get(node.parentId) : undefined;
    if (!lane) return [];
    const width = typeof node.style?.width === 'number' ? node.style.width : 220;
    const height = typeof node.style?.height === 'number' ? node.style.height : 56;
    return [{
      x: lane.position.x + node.position.x,
      y: lane.position.y + node.position.y,
      width,
      height,
    }];
  });
  if (absoluteRects.length === 0) return nodes;

  const minX = Math.min(...absoluteRects.map((rect) => rect.x));
  const maxX = Math.max(...absoluteRects.map((rect) => rect.x + rect.width));
  const minY = Math.min(...absoluteRects.map((rect) => rect.y));
  const maxY = Math.max(...absoluteRects.map((rect) => rect.y + rect.height));
  const midY = minY + (maxY - minY) / 2 - 22;

  return nodes.map((node) => {
    if (node.id === 'frontier:left') {
      return { ...node, position: { x: minX - 96, y: midY } };
    }
    if (node.id === 'frontier:right') {
      return { ...node, position: { x: maxX + 52, y: midY } };
    }
    return node;
  });
}
