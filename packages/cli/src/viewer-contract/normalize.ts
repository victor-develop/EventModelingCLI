import type { LayoutPatch, LayoutState, Occurrence, RenderedEdge, SwimlaneRect } from '../layout/types';
import { computePackedSwimlaneRects } from '../layout/lane-geometry';
import { createLaneDescriptorsFromOccurrences, toVisibleLane } from './lanePolicy';

export function normalizeOccurrencesForViewer(occurrences: Occurrence[]): Occurrence[] {
  return occurrences.map((occ) => ({
    ...occ,
    lane: toVisibleLane(occ.lane),
    lockLevel: occ.lockLevel === 'free' ? 'none' : occ.lockLevel,
  }));
}

export function normalizeRenderedEdgesForViewer(edges: RenderedEdge[]): RenderedEdge[] {
  return edges.map((edge) => ({ ...edge, points: edge.points.map((point) => [...point] as [number, number]) }));
}

export function normalizeLayoutPatchForViewer(patch: LayoutPatch, layoutState: LayoutState): LayoutPatch {
  return {
    ...patch,
    addedOccurrences: normalizeOccurrencesForViewer(patch.addedOccurrences),
    updatedOccurrences: normalizeOccurrencesForViewer(patch.updatedOccurrences),
    addedEdges: normalizeRenderedEdgesForViewer(patch.addedEdges),
    updatedEdges: normalizeRenderedEdgesForViewer(patch.updatedEdges),
    updatedSwimlaneRects: computeVisibleSwimlaneRects(Object.values(layoutState.occurrences)),
  };
}

export function computeVisibleSwimlaneRects(occurrences: Occurrence[]): SwimlaneRect[] {
  const normalized = normalizeOccurrencesForViewer(occurrences);
  const laneDescriptors = createLaneDescriptorsFromOccurrences(normalized);
  return computePackedSwimlaneRects({
    occurrences: normalized,
    laneOrder: laneDescriptors.map(({ id }) => id),
    includeEmptyLanes: true,
    useGlobalHorizontalEnvelope: true,
  });
}
