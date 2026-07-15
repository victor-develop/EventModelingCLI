import type { Node } from '../domain/types';
import type { Occurrence, RenderedEdge, SwimlaneRect } from '../layout/types';
import {
  getVisibleLaneOrder,
  getSnapshotLaneDescriptors,
  toVisibleLane,
} from '../viewer-contract/lanePolicy';
import type { VisualizationSnapshot } from '../viewer-contract/types';
import {
  getSnapshotEdges,
  getSnapshotOccurrences,
  isLeftToRight,
  renderInvariantLines,
  renderInvariantSummary,
} from './invariants';

export function renderLayoutTable(snapshot: VisualizationSnapshot): string {
  const laneDescriptors = getSnapshotLaneDescriptors(snapshot);
  const occurrences = sortOccurrencesForTable(getSnapshotOccurrences(snapshot), laneDescriptors);
  const edges = sortEdgesForTable(getSnapshotEdges(snapshot), occurrences);
  const swimlaneRects = getSnapshotSwimlaneRects(snapshot);
  const lines: string[] = [];

  lines.push('PROJECT');
  lines.push(`name: ${snapshot.projectName}`);
  lines.push(`focusNodeId: ${snapshot.focusNodeId}`);
  lines.push('');
  lines.push('OCCURRENCES');
  lines.push('occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel');
  for (const occ of occurrences) {
    lines.push([
      occ.occurrenceId,
      occ.canonicalNodeId,
      occ.nodeKind,
      toVisibleLane(occ.lane),
      occ.stageIndex,
      occ.rowIndex,
      occ.x,
      occ.y,
      occ.width,
      occ.height,
      normalizeLockLevel(occ.lockLevel),
    ].join(' | '));
  }

  lines.push('');
  lines.push('EDGES');
  lines.push('displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction');
  for (const edge of edges) {
    lines.push([
      edge.displayEdgeId,
      edge.fromOccurrenceId,
      edge.toOccurrenceId,
      edge.kind,
      edge.points.length,
      isLeftToRight(edge) ? 'LTR' : 'RTL',
    ].join(' | '));
  }

  lines.push('');
  lines.push('SWIMLANES');
  lines.push('lane | x | y | width | height');
  for (const rect of sortSwimlaneRects(swimlaneRects, laneDescriptors)) {
    lines.push([
      toVisibleLane(rect.lane),
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    ].join(' | '));
  }

  lines.push('');
  lines.push('INVARIANTS');
  lines.push(...renderInvariantLines(renderInvariantSummary(snapshot)));

  return lines.join('\n');
}

export function renderLayoutAscii(snapshot: VisualizationSnapshot): string {
  const occurrences = getSnapshotOccurrences(snapshot);
  const edges = getSnapshotEdges(snapshot);
  const occurrenceById = new Map(occurrences.map((occ) => [occ.occurrenceId, occ]));
  const laneDescriptors = getSnapshotLaneDescriptors(snapshot);
  const lines: string[] = [];

  lines.push(`PROJECT: ${snapshot.projectName}`);
  lines.push(`FOCUS: ${snapshot.focusNodeId}`);
  lines.push('');
  lines.push('STAGES');
  lines.push(renderStages(occurrences));
  lines.push('');

  for (const { id: lane, label } of laneDescriptors) {
    lines.push(`LANE ${label}`);
    const laneOccurrences = sortOccurrencesForLane(occurrences.filter((occ) => toVisibleLane(occ.lane) === lane));
    for (let index = 0; index < laneOccurrences.length; index++) {
      const occ = laneOccurrences[index]!;
      if (index > 0) lines.push('');
      lines.push(`[stage ${occ.stageIndex} row ${occ.rowIndex}] ${occ.canonicalNodeId}`);
      const displayName = getDomainNodeName(snapshot.domainNodes[occ.canonicalNodeId]);
      if (displayName) lines.push(`name: ${displayName}`);
      if (normalizeLockLevel(occ.lockLevel) === 'hard') lines.push('lockLevel: hard');

      const incoming = incomingCanonicalIds(occ, edges, occurrenceById);
      if (incoming.length > 0) lines.push(`in: ${incoming.join(', ')}`);

      const outgoing = outgoingCanonicalIds(occ, edges, occurrenceById);
      if (outgoing.length > 0) lines.push(`out: ${outgoing.join(', ')}`);
    }
    lines.push('');
  }

  lines.push('GRAPH');
  for (const edge of edges) {
    const source = occurrenceById.get(edge.fromOccurrenceId)?.canonicalNodeId ?? unknownOccurrence(edge.fromOccurrenceId);
    const target = occurrenceById.get(edge.toOccurrenceId)?.canonicalNodeId ?? unknownOccurrence(edge.toOccurrenceId);
    lines.push(`${source} --${edge.kind}--> ${target}`);
  }
  lines.push('');
  lines.push('INVARIANTS');
  lines.push(...renderInvariantLines(renderInvariantSummary(snapshot)));

  return lines.join('\n');
}

function getSnapshotSwimlaneRects(snapshot: VisualizationSnapshot): SwimlaneRect[] {
  const direct = (snapshot as unknown as { swimlaneRects?: SwimlaneRect[] }).swimlaneRects;
  if (Array.isArray(direct)) return direct;

  const layoutRects = (snapshot.layoutState as unknown as { swimlaneRects?: SwimlaneRect[] }).swimlaneRects;
  return Array.isArray(layoutRects) ? layoutRects : [];
}

function sortOccurrencesForTable(
  occurrences: Occurrence[],
  laneDescriptors: ReturnType<typeof getSnapshotLaneDescriptors>,
): Occurrence[] {
  return [...occurrences].sort((a, b) => (
    a.stageIndex - b.stageIndex ||
    a.rowIndex - b.rowIndex ||
    getVisibleLaneOrder(a.lane, laneDescriptors) - getVisibleLaneOrder(b.lane, laneDescriptors) ||
    a.occurrenceId.localeCompare(b.occurrenceId)
  ));
}

function sortOccurrencesForLane(occurrences: Occurrence[]): Occurrence[] {
  return [...occurrences].sort((a, b) => (
    a.stageIndex - b.stageIndex ||
    a.rowIndex - b.rowIndex ||
    a.occurrenceId.localeCompare(b.occurrenceId)
  ));
}

function sortEdgesForTable(edges: RenderedEdge[], occurrences: Occurrence[]): RenderedEdge[] {
  const occurrenceIds = new Set(occurrences.map((occ) => occ.occurrenceId));
  return edges
    .map((edge, index) => ({ edge, index, invalid: !occurrenceIds.has(edge.fromOccurrenceId) || !occurrenceIds.has(edge.toOccurrenceId) }))
    .sort((a, b) => Number(b.invalid) - Number(a.invalid) || a.index - b.index)
    .map((entry) => entry.edge);
}

function sortSwimlaneRects(
  rects: SwimlaneRect[],
  laneDescriptors: ReturnType<typeof getSnapshotLaneDescriptors>,
): SwimlaneRect[] {
  const bestRectByLane = new Map<string, SwimlaneRect>();
  for (const rect of rects) {
    const lane = toVisibleLane(rect.lane);
    const existing = bestRectByLane.get(lane);
    if (!existing) {
      bestRectByLane.set(lane, { ...rect, lane });
    } else {
      const minX = Math.min(existing.x, rect.x);
      const minY = Math.min(existing.y, rect.y);
      const maxX = Math.max(existing.x + existing.width, rect.x + rect.width);
      const maxY = Math.max(existing.y + existing.height, rect.y + rect.height);
      bestRectByLane.set(lane, {
        lane,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  }

  return laneDescriptors.flatMap(({ id: lane }) => {
    const rect = bestRectByLane.get(lane);
    return rect ? [rect] : [];
  });
}

function renderStages(occurrences: Occurrence[]): string {
  const stages = [...new Set(occurrences.map((occ) => occ.stageIndex))].sort((a, b) => a - b);
  return stages.length > 0 ? stages.join(' -> ') : '(none)';
}

function incomingCanonicalIds(
  occurrence: Occurrence,
  edges: RenderedEdge[],
  occurrenceById: Map<string, Occurrence>,
): string[] {
  return edges
    .filter((edge) => edge.toOccurrenceId === occurrence.occurrenceId)
    .map((edge) => occurrenceById.get(edge.fromOccurrenceId)?.canonicalNodeId ?? unknownOccurrence(edge.fromOccurrenceId))
    .sort((a, b) => a.localeCompare(b));
}

function outgoingCanonicalIds(
  occurrence: Occurrence,
  edges: RenderedEdge[],
  occurrenceById: Map<string, Occurrence>,
): string[] {
  return edges
    .filter((edge) => edge.fromOccurrenceId === occurrence.occurrenceId)
    .map((edge) => occurrenceById.get(edge.toOccurrenceId)?.canonicalNodeId ?? unknownOccurrence(edge.toOccurrenceId))
    .sort((a, b) => a.localeCompare(b));
}

function unknownOccurrence(occurrenceId: string): string {
  return `UNKNOWN(${occurrenceId})`;
}

function getDomainNodeName(node: Node | undefined): string | undefined {
  if (!node) return undefined;
  const fixtureName = (node as unknown as { name?: string }).name;
  return node.displayName ?? fixtureName;
}

function normalizeLockLevel(lockLevel: string): string {
  return lockLevel === 'free' ? 'none' : lockLevel;
}
