import { useMemo, useState, useCallback } from 'react';
import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import type { LayoutRequest } from './layoutRequest';
import { WALK_LAYOUT_HOPS, clampLayoutHops, walkLayoutRequest } from './layoutRequest';
import { canWalkDirection, findWalkFrontier } from './walkFrontier';

interface UseWalkStateResult {
  snapshot: VisualizationSnapshot | null;
  walkLeft: () => void;
  walkRight: () => void;
  setOccurrenceLock: (occurrenceId: string, lockLevel: 'hard' | 'none') => void;
  resetOccurrencePosition: (occurrenceId: string) => void;
  canWalkLeft: boolean;
  canWalkRight: boolean;
  walkCount: number;
  isWalking: boolean;
}

interface UseWalkStateOptions {
  onNavigate?: (request: LayoutRequest) => void;
  walkHops?: number;
  maxHops?: number;
  includeTruncatedPaths?: boolean;
  requestContext?: LayoutRequest | null;
}

interface DraftSnapshot {
  base: VisualizationSnapshot | null;
  snapshot: VisualizationSnapshot;
}

export function useWalkState(
  initData: VisualizationSnapshot | null,
  options: UseWalkStateOptions = {},
): UseWalkStateResult {
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);
  const [walkCount, setWalkCount] = useState(0);
  const { onNavigate } = options;
  const maxHops = options.maxHops ?? Math.max(WALK_LAYOUT_HOPS, options.walkHops ?? WALK_LAYOUT_HOPS);
  const walkHops = clampLayoutHops(options.walkHops ?? WALK_LAYOUT_HOPS, maxHops);
  const includeTruncatedPaths = options.includeTruncatedPaths ?? false;
  const requestContext = options.requestContext ?? null;
  const snapshot = useMemo(() => (
    draft?.base === initData ? draft.snapshot : initData
  ), [draft, initData]);
  const canWalkLeft = useMemo(() => canWalkDirection(snapshot, 'backward'), [snapshot]);
  const canWalkRight = useMemo(() => canWalkDirection(snapshot, 'forward'), [snapshot]);

  const walk = useCallback((direction: 'forward' | 'backward') => {
    if (!snapshot || !onNavigate) return;
    if (!canWalkDirection(snapshot, direction)) return;
    const frontier = findWalkFrontier(snapshot, direction);
    if (!frontier) return;

    onNavigate(walkLayoutRequest(
      frontier.canonicalNodeId,
      direction,
      walkHops,
      includeTruncatedPaths,
      maxHops,
      requestContext,
    ));
    setWalkCount(c => c + 1);
  }, [includeTruncatedPaths, maxHops, onNavigate, requestContext, snapshot, walkHops]);

  const walkRight = useCallback(() => { walk('forward'); }, [walk]);
  const walkLeft = useCallback(() => { walk('backward'); }, [walk]);

  const setOccurrenceLock = useCallback((occurrenceId: string, lockLevel: 'hard' | 'none') => {
    setDraft((current) => {
      const currentSnapshot = current?.base === initData ? current.snapshot : initData;
      if (!currentSnapshot) return current;
      return {
        base: initData,
        snapshot: updateOccurrenceLock(currentSnapshot, occurrenceId, lockLevel),
      };
    });
  }, [initData]);

  const resetOccurrencePosition = useCallback((occurrenceId: string) => {
    setDraft((current) => {
      const currentSnapshot = current?.base === initData ? current.snapshot : initData;
      if (!currentSnapshot) return current;
      const baseline = initData?.layoutState.occurrences[occurrenceId];
      const occurrence = currentSnapshot.layoutState.occurrences[occurrenceId];
      if (!baseline || !occurrence) return current;
      return {
        base: initData,
        snapshot: updateOccurrence(currentSnapshot, occurrenceId, {
          lane: baseline.lane,
          stageIndex: baseline.stageIndex,
          rowIndex: baseline.rowIndex,
          x: baseline.x,
          y: baseline.y,
          width: baseline.width,
          height: baseline.height,
        }),
      };
    });
  }, [initData]);

  return {
    snapshot,
    walkLeft,
    walkRight,
    setOccurrenceLock,
    resetOccurrencePosition,
    canWalkLeft,
    canWalkRight,
    walkCount,
    isWalking: false,
  };
}

function updateOccurrenceLock(
  snapshot: VisualizationSnapshot,
  occurrenceId: string,
  lockLevel: 'hard' | 'none',
): VisualizationSnapshot {
  return updateOccurrence(snapshot, occurrenceId, { lockLevel }, (next) => {
    const locks = { ...next.layoutState.locks };
    if (lockLevel === 'hard') locks[occurrenceId] = 'hard';
    else delete locks[occurrenceId];
    next.layoutState = { ...next.layoutState, locks };
  });
}

function updateOccurrence(
  snapshot: VisualizationSnapshot,
  occurrenceId: string,
  changes: Partial<VisualizationSnapshot['occurrences'][number]>,
  mutate?: (snapshot: VisualizationSnapshot) => void,
): VisualizationSnapshot {
  const occurrence = snapshot.layoutState.occurrences[occurrenceId];
  if (!occurrence) return snapshot;

  const nextOccurrence = { ...occurrence, ...changes };
  const next: VisualizationSnapshot = {
    ...snapshot,
    layoutState: {
      ...snapshot.layoutState,
      occurrences: {
        ...snapshot.layoutState.occurrences,
        [occurrenceId]: nextOccurrence,
      },
    },
    occurrences: snapshot.occurrences.map((item) => (
      item.occurrenceId === occurrenceId ? { ...item, ...changes } : item
    )),
  };
  mutate?.(next);
  return next;
}
