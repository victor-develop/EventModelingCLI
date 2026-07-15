import type { LayoutPatch, LayoutState, Occurrence, RenderedEdge, SwimlaneRect } from '../layout/types';
import { createLaneDescriptorsFromOccurrences, toVisibleLane } from './lanePolicy';

const SWIMLANE_PAD_X = 40;
const SWIMLANE_PAD_Y = 40;
const DEFAULT_LANE_HEIGHT = 136;
const DEFAULT_LANE_WIDTH = 900;
const LANE_HEIGHT = 200;

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
  const globalMinX = normalized.length > 0 ? Math.min(...normalized.map((occ) => occ.x)) : 0;
  const globalMaxX = normalized.length > 0
    ? Math.max(...normalized.map((occ) => occ.x + occ.width))
    : DEFAULT_LANE_WIDTH - SWIMLANE_PAD_X;
  const x = globalMinX - SWIMLANE_PAD_X;
  const width = Math.max(DEFAULT_LANE_WIDTH, globalMaxX - globalMinX + 2 * SWIMLANE_PAD_X);

  const laneDescriptors = createLaneDescriptorsFromOccurrences(normalized);

  return laneDescriptors.map(({ id: lane }, index) => {
    const laneOccurrences = normalized.filter((occ) => occ.lane === lane);
    if (laneOccurrences.length === 0) {
      return {
        lane,
        x,
        y: index * LANE_HEIGHT - SWIMLANE_PAD_Y,
        width,
        height: DEFAULT_LANE_HEIGHT,
      };
    }

    const minY = Math.min(...laneOccurrences.map((occ) => occ.y));
    const maxY = Math.max(...laneOccurrences.map((occ) => occ.y + occ.height));

    return {
      lane,
      x,
      y: minY - SWIMLANE_PAD_Y,
      width,
      height: Math.max(DEFAULT_LANE_HEIGHT, maxY - minY + 2 * SWIMLANE_PAD_Y),
    };
  });
}
