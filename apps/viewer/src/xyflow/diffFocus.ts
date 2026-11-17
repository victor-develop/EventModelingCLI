import {
  getViewportForBounds,
  type Rect,
  type Viewport,
} from '@xyflow/react';
import type {
  ViewerDiffChange,
  VisualizationSnapshot,
} from 'event-modeling-spec-cli/viewer-contract/types';

const DIFF_FOCUS_MIN_ZOOM = 0.35;
const DIFF_FOCUS_MAX_ZOOM = 1.15;
const DIFF_FOCUS_PADDING = 0.18;

export interface DiffFocusTargets {
  nodeIds: string[];
  edgeIds: string[];
}

interface ViewportRect {
  left: number;
  right: number;
  width: number;
  height: number;
}

export function resolveDiffFocusTargets(
  snapshot: VisualizationSnapshot,
  changes: ViewerDiffChange[],
): DiffFocusTargets {
  const canonicalNodeIds = new Set<string>();
  const occurrenceIds = new Set<string>();
  const originalEdgeIds = new Set<string>();

  for (const change of changes) {
    if (change.targetNodeId) canonicalNodeIds.add(change.targetNodeId);
    if (change.targetEdgeId) originalEdgeIds.add(change.targetEdgeId);
  }

  const matchingEdges = snapshot.renderedEdges.filter(edge => (
    typeof edge.meta?.originalEdgeId === 'string'
    && originalEdgeIds.has(edge.meta.originalEdgeId)
  ));

  for (const edge of matchingEdges) {
    occurrenceIds.add(edge.fromOccurrenceId);
    occurrenceIds.add(edge.toOccurrenceId);
  }

  return {
    nodeIds: snapshot.occurrences
      .filter(occurrence => (
        canonicalNodeIds.has(occurrence.canonicalNodeId)
        || occurrenceIds.has(occurrence.occurrenceId)
      ))
      .map(occurrence => occurrence.occurrenceId),
    edgeIds: matchingEdges.map(edge => edge.displayEdgeId),
  };
}

export function resolveDiffFocusViewport(
  bounds: Rect,
  canvas: ViewportRect,
  overlay?: ViewportRect,
): Viewport {
  const overlayStartsInsideCanvas = overlay
    && overlay.left > canvas.left
    && overlay.left < canvas.right;
  const visibleRight = overlayStartsInsideCanvas ? overlay.left : canvas.right;
  const visibleWidth = Math.max(1, visibleRight - canvas.left);

  return getViewportForBounds(
    bounds,
    visibleWidth,
    canvas.height,
    DIFF_FOCUS_MIN_ZOOM,
    DIFF_FOCUS_MAX_ZOOM,
    DIFF_FOCUS_PADDING,
  );
}
