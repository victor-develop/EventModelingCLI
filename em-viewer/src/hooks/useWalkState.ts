import { useMemo, useState, useCallback } from 'react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { LayoutRequest } from './layoutRequest';
import { WALK_LAYOUT_HOPS, clampLayoutHops, walkLayoutRequest } from './layoutRequest';

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
  const walkHops = clampLayoutHops(options.walkHops ?? WALK_LAYOUT_HOPS);
  const snapshot = useMemo(() => (
    draft?.base === initData ? draft.snapshot : initData
  ), [draft, initData]);

  const walk = useCallback((direction: 'forward' | 'backward') => {
    if (!snapshot || !onNavigate) return;
    const preferHighStage = direction === 'forward';
    const occs = snapshot.occurrences;
    if (occs.length === 0) return;

    const sorted = [...occs].sort((a, b) => (
      preferHighStage
        ? (b.stageIndex - a.stageIndex) || (b.x - a.x)
        : (a.stageIndex - b.stageIndex) || (a.x - b.x)
    ));
    const frontier = sorted[0];
    if (!frontier) return;

    onNavigate(walkLayoutRequest(frontier.canonicalNodeId, direction, walkHops));
    setWalkCount(c => c + 1);
  }, [onNavigate, snapshot, walkHops]);

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
    canWalkLeft: Boolean(snapshot?.occurrences.length),
    canWalkRight: Boolean(snapshot?.occurrences.length),
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
