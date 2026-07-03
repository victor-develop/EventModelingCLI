import type { Occurrence, RenderedEdge } from '../layout/types';
import type { VisualizationSnapshot } from '../viewer-contract/types';
import { toVisibleLane, VISIBLE_LANE_ORDER } from '../viewer-contract/lanePolicy';

export type InvariantStatus = 'PASS' | 'FAIL';

export type InvariantSummary = {
  leftToRightEdges: InvariantStatus;
  allOccurrencesHaveLanes: InvariantStatus;
  allEdgesHaveEndpoints: InvariantStatus;
  allEdgesHaveRoutePoints: InvariantStatus;
  visibleLanesValid: InvariantStatus;
};

export function renderInvariantSummary(snapshot: VisualizationSnapshot): InvariantSummary {
  const occurrences = getSnapshotOccurrences(snapshot);
  const edges = getSnapshotEdges(snapshot);
  const occurrenceIds = new Set(occurrences.map((occ) => occ.occurrenceId));
  const visibleLaneSet = new Set<string>(VISIBLE_LANE_ORDER);

  return {
    leftToRightEdges: edges.every(isLeftToRight) ? 'PASS' : 'FAIL',
    allOccurrencesHaveLanes: occurrences.every((occ) => typeof occ.lane === 'string' && occ.lane.length > 0) ? 'PASS' : 'FAIL',
    allEdgesHaveEndpoints: edges.every((edge) => occurrenceIds.has(edge.fromOccurrenceId) && occurrenceIds.has(edge.toOccurrenceId)) ? 'PASS' : 'FAIL',
    allEdgesHaveRoutePoints: edges.every((edge) => edge.points.length > 0) ? 'PASS' : 'FAIL',
    visibleLanesValid: occurrences.every((occ) => visibleLaneSet.has(toVisibleLane(occ.lane))) ? 'PASS' : 'FAIL',
  };
}

export function renderInvariantLines(summary: InvariantSummary): string[] {
  return [
    `left-to-right edges: ${summary.leftToRightEdges}`,
    `all occurrences have lanes: ${summary.allOccurrencesHaveLanes}`,
    `all edges have endpoints: ${summary.allEdgesHaveEndpoints}`,
    `all edges have route points: ${summary.allEdgesHaveRoutePoints}`,
    `visible lanes valid: ${summary.visibleLanesValid}`,
  ];
}

export function getSnapshotOccurrences(snapshot: VisualizationSnapshot): Occurrence[] {
  const direct = (snapshot as unknown as { occurrences?: Occurrence[] }).occurrences;
  if (Array.isArray(direct)) return direct;

  const layoutOccurrences = (snapshot.layoutState as unknown as { occurrences?: Occurrence[] | Record<string, Occurrence> }).occurrences;
  if (Array.isArray(layoutOccurrences)) return layoutOccurrences;
  return Object.values(layoutOccurrences ?? {});
}

export function getSnapshotEdges(snapshot: VisualizationSnapshot): RenderedEdge[] {
  const direct = (snapshot as unknown as { renderedEdges?: RenderedEdge[] }).renderedEdges;
  if (Array.isArray(direct)) return direct;

  const layoutEdges = (snapshot.layoutState as unknown as {
    renderedEdges?: RenderedEdge[];
    displayEdges?: Record<string, RenderedEdge>;
  });
  if (Array.isArray(layoutEdges.renderedEdges)) return layoutEdges.renderedEdges;
  return Object.values(layoutEdges.displayEdges ?? {});
}

export function isLeftToRight(edge: RenderedEdge): boolean {
  const first = edge.points[0];
  const last = edge.points[edge.points.length - 1];
  if (!first || !last) return false;
  return first[0] <= last[0];
}
