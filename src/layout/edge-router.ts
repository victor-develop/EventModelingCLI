import {
  Occurrence,
  RenderedEdge,
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from './types';

export function routeEdges(
  edges: RenderedEdge[],
  occurrences: Record<string, Occurrence>,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
): RenderedEdge[] {
  const sourceEdges = new Map<string, number>();
  const result: RenderedEdge[] = [];

  for (const edge of edges) {
    const from = occurrences[edge.fromOccurrenceId];
    const to = occurrences[edge.toOccurrenceId];
    if (!from || !to) continue;

    const fromRight = from.x + from.width;
    const toLeft = to.x;
    const fromCenterY = from.y + from.height / 2;
    const toCenterY = to.y + to.height / 2;

    const fanOutIdx = sourceEdges.get(edge.fromOccurrenceId) ?? 0;
    sourceEdges.set(edge.fromOccurrenceId, fanOutIdx + 1);

    const midX = fromRight + (toLeft - fromRight) / 2;

    let points: [number, number][];

    if (Math.abs(fromCenterY - toCenterY) < 1) {
      points = [
        [fromRight, fromCenterY],
        [toLeft, toCenterY],
      ];
    } else {
      const fanOffset = fanOutIdx * 10;

      points = [
        [fromRight, fromCenterY + fanOffset],
        [midX, fromCenterY + fanOffset],
        [midX, toCenterY],
        [toLeft, toCenterY],
      ];
    }

    result.push({
      ...edge,
      points,
    });
  }

  return result;
}
