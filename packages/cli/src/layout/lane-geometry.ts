import type { Occurrence, SwimlaneRect } from './types';

export const LANE_ORDER_FALLBACK: string[] = ['nonRole', 'commandViewModel', 'event'];

export const LANE_GEOMETRY = {
  swimlanePadX: 40,
  swimlanePadY: 40,
  interLaneGap: 10,
  defaultLaneHeight: 136,
  defaultLaneWidth: 900,
  defaultLaneSpacing: 200,
};

export function computeLaneOrder(occurrences: Occurrence[]): string[] {
  const lanes = new Set(occurrences.map(o => o.lane));
  const roleLanes = [...lanes].filter(l => l.startsWith('role:')).sort();
  const nonRole = lanes.has('nonRole') ? ['nonRole'] : [];
  const shared = lanes.has('shared') ? ['shared'] : [];
  const cmdVm = lanes.has('commandViewModel') ? ['commandViewModel'] : [];
  const evt = lanes.has('event') ? ['event'] : [];
  const ordered = [...roleLanes, ...nonRole, ...shared, ...cmdVm, ...evt];
  return ordered.length > 0 ? ordered : LANE_ORDER_FALLBACK;
}

export function computeLaneBaseY(laneOrder: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (let i = 0; i < laneOrder.length; i++) {
    const lane = laneOrder[i]!;
    result[lane] = i * LANE_GEOMETRY.defaultLaneSpacing;
  }
  return result;
}

export function computePackedSwimlaneRects(args: {
  occurrences: Occurrence[];
  laneOrder?: string[];
  includeEmptyLanes?: boolean;
  useGlobalHorizontalEnvelope?: boolean;
}): SwimlaneRect[] {
  const laneOrder = args.laneOrder ?? computeLaneOrder(args.occurrences);
  const lanes = args.includeEmptyLanes
    ? laneOrder
    : laneOrder.filter((lane) => args.occurrences.some((occ) => occ.lane === lane));
  const globalEnvelope = args.useGlobalHorizontalEnvelope ? computeGlobalHorizontalEnvelope(args.occurrences) : undefined;

  const rects = lanes.map((lane, index) => {
    const laneOccurrences = args.occurrences.filter((occ) => occ.lane === lane);
    if (laneOccurrences.length === 0) {
      return emptyLaneRect(lane, index, globalEnvelope);
    }
    return occupiedLaneRect(lane, laneOccurrences, globalEnvelope);
  });

  return packRectsVertically(rects);
}

export function realignOccurrencesToRects(
  occurrences: Occurrence[],
  rects: SwimlaneRect[],
): Occurrence[] {
  const laneRectMap = new Map(rects.map(r => [r.lane, r]));
  const laneMinY = new Map<string, number>();
  for (const occ of occurrences) {
    const current = laneMinY.get(occ.lane);
    if (current === undefined || occ.y < current) {
      laneMinY.set(occ.lane, occ.y);
    }
  }

  const result = occurrences.map(o => ({ ...o }));
  for (const occ of result) {
    const rect = laneRectMap.get(occ.lane);
    const minY = laneMinY.get(occ.lane);
    if (!rect || minY === undefined) continue;

    const naturalRectY = minY - LANE_GEOMETRY.swimlanePadY;
    const shift = rect.y - naturalRectY;
    if (shift > 0) {
      occ.y += shift;
    }
  }

  return result;
}

function computeGlobalHorizontalEnvelope(occurrences: Occurrence[]): { x: number; width: number } {
  const globalMinX = occurrences.length > 0 ? Math.min(...occurrences.map((occ) => occ.x)) : 0;
  const globalMaxX = occurrences.length > 0
    ? Math.max(...occurrences.map((occ) => occ.x + occ.width))
    : LANE_GEOMETRY.defaultLaneWidth - LANE_GEOMETRY.swimlanePadX;
  const x = globalMinX - LANE_GEOMETRY.swimlanePadX;
  const width = Math.max(
    LANE_GEOMETRY.defaultLaneWidth,
    globalMaxX - globalMinX + 2 * LANE_GEOMETRY.swimlanePadX,
  );
  return { x, width };
}

function emptyLaneRect(
  lane: string,
  index: number,
  globalEnvelope: { x: number; width: number } | undefined,
): SwimlaneRect {
  return {
    lane,
    x: globalEnvelope?.x ?? -LANE_GEOMETRY.swimlanePadX,
    y: index * LANE_GEOMETRY.defaultLaneSpacing - LANE_GEOMETRY.swimlanePadY,
    width: globalEnvelope?.width ?? LANE_GEOMETRY.defaultLaneWidth,
    height: LANE_GEOMETRY.defaultLaneHeight,
  };
}

function occupiedLaneRect(
  lane: string,
  occurrences: Occurrence[],
  globalEnvelope: { x: number; width: number } | undefined,
): SwimlaneRect {
  const minX = Math.min(...occurrences.map((occ) => occ.x));
  const maxX = Math.max(...occurrences.map((occ) => occ.x + occ.width));
  const minY = Math.min(...occurrences.map((occ) => occ.y));
  const maxY = Math.max(...occurrences.map((occ) => occ.y + occ.height));

  return {
    lane,
    x: globalEnvelope?.x ?? minX - LANE_GEOMETRY.swimlanePadX,
    y: minY - LANE_GEOMETRY.swimlanePadY,
    width: globalEnvelope?.width ?? maxX - minX + 2 * LANE_GEOMETRY.swimlanePadX,
    height: Math.max(
      LANE_GEOMETRY.defaultLaneHeight,
      maxY - minY + 2 * LANE_GEOMETRY.swimlanePadY,
    ),
  };
}

function packRectsVertically(rects: SwimlaneRect[]): SwimlaneRect[] {
  const packed = rects.map((rect) => ({ ...rect }));
  for (let i = 1; i < packed.length; i++) {
    const prevBottom = packed[i - 1]!.y + packed[i - 1]!.height + LANE_GEOMETRY.interLaneGap;
    if (packed[i]!.y < prevBottom) {
      packed[i]!.y = prevBottom;
    }
  }
  return packed;
}
