import { useState, useRef, useCallback, useEffect } from 'react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';

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

export function useWalkState(initData: VisualizationSnapshot | null): UseWalkStateResult {
  const [snapshot, setSnapshot] = useState<VisualizationSnapshot | null>(initData);
  const [walkCount, setWalkCount] = useState(0);
  const isWalkingRef = useRef(false);
  const [canWalkLeft, setCanWalkLeft] = useState(true);
  const [canWalkRight, setCanWalkRight] = useState(true);
  const [isWalking, setIsWalking] = useState(false);

  useEffect(() => {
    setSnapshot(initData);
    setWalkCount(0);
    setCanWalkLeft(true);
    setCanWalkRight(true);
    setIsWalking(false);
  }, [initData]);

  const walk = useCallback(async (direction: 'forward' | 'backward') => {
    if (!snapshot || isWalkingRef.current) return;
    isWalkingRef.current = true;
    setIsWalking(true);

    const preferHighStage = direction === 'forward';

    try {
      const occs = snapshot.occurrences;
      if (occs.length === 0) return;

      const sorted = [...occs].sort((a, b) => (
        preferHighStage
          ? (b.stageIndex - a.stageIndex) || (b.x - a.x)
          : (a.stageIndex - b.stageIndex) || (a.x - b.x)
      ));
      const frontier = sorted[0];
      if (!frontier) return;

      const resp = await fetchLayout(frontier.canonicalNodeId, direction);
      if (!resp.ok) {
        if (preferHighStage) setCanWalkRight(false);
        else setCanWalkLeft(false);
        return;
      }
      const nextSnapshot = await resp.json() as VisualizationSnapshot;
      if (nextSnapshot.occurrences.length === 0) {
        if (preferHighStage) setCanWalkRight(false);
        else setCanWalkLeft(false);
        return;
      }

      setSnapshot(nextSnapshot);
      setWalkCount(c => c + 1);
    } finally {
      isWalkingRef.current = false;
      setIsWalking(false);
    }
  }, [snapshot]);

  const walkRight = useCallback(() => { walk('forward'); }, [walk]);
  const walkLeft = useCallback(() => { walk('backward'); }, [walk]);

  const setOccurrenceLock = useCallback((occurrenceId: string, lockLevel: 'hard' | 'none') => {
    setSnapshot((current) => current ? updateOccurrenceLock(current, occurrenceId, lockLevel) : current);
  }, []);

  const resetOccurrencePosition = useCallback((occurrenceId: string) => {
    setSnapshot((current) => {
      if (!current) return current;
      const baseline = initData?.layoutState.occurrences[occurrenceId];
      const occurrence = current.layoutState.occurrences[occurrenceId];
      if (!baseline || !occurrence) return current;
      return updateOccurrence(current, occurrenceId, {
        lane: baseline.lane,
        stageIndex: baseline.stageIndex,
        rowIndex: baseline.rowIndex,
        x: baseline.x,
        y: baseline.y,
        width: baseline.width,
        height: baseline.height,
      });
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
    isWalking,
  };
}

function fetchLayout(
  focus: string,
  direction: 'forward' | 'backward',
): Promise<Response> {
  const params = new URLSearchParams({
    focus,
    direction,
    hops: '3',
  });
  return fetch(`/api/layout?${params.toString()}`);
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
