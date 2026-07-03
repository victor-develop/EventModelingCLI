import { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutEngine } from '@em/layout/layout-engine';
import type { LayoutPatch, LayoutState } from '@em/layout/types';
import type { WalkBranch } from '@em/graph/graph-builder';
import type { Node, Edge } from '@em/domain/types';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { walkBranchesToEnvelope } from '@em/viewer-contract/envelope';

interface UseWalkStateResult {
  patch: LayoutPatch | null;
  domainNodes: Record<string, Node>;
  walkLeft: () => void;
  walkRight: () => void;
  setOccurrenceLock: (occurrenceId: string, lockLevel: 'hard' | 'none') => void;
  resetOccurrencePosition: (occurrenceId: string) => void;
  canWalkLeft: boolean;
  canWalkRight: boolean;
  walkCount: number;
  isWalking: boolean;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function useWalkState(initData: VisualizationSnapshot | null): UseWalkStateResult {
  const engineRef = useRef(new LayoutEngine());
  const layoutStateRef = useRef<LayoutState | null>(null);
  const baselineLayoutStateRef = useRef<LayoutState | null>(null);
  const [patch, setPatch] = useState<LayoutPatch | null>(null);
  const [domainNodes, setDomainNodes] = useState<Record<string, Node>>({});
  const [walkCount, setWalkCount] = useState(0);
  const isWalkingRef = useRef(false);
  const [canWalkLeft, setCanWalkLeft] = useState(true);
  const [canWalkRight, setCanWalkRight] = useState(true);
  const [isWalking, setIsWalking] = useState(false);

  useEffect(() => {
    if (!initData) return;

    layoutStateRef.current = deepClone(initData.layoutState);
    baselineLayoutStateRef.current = deepClone(initData.layoutState);
    setDomainNodes(initData.domainNodes);
    setPatch(null);
    setWalkCount(0);
    setCanWalkLeft(true);
    setCanWalkRight(true);
    setIsWalking(false);
  }, [initData]);

  const walk = useCallback(async (direction: 'forward' | 'backward') => {
    const layoutState = layoutStateRef.current;
    if (!layoutState || !initData || isWalkingRef.current) return;
    isWalkingRef.current = true;
    setIsWalking(true);

    const preferHighStage = direction === 'forward';

    try {
      const occs = Object.values(layoutState.occurrences);
      if (occs.length === 0) return;

      const sorted = [...occs].sort((a, b) =>
        preferHighStage ? b.stageIndex - a.stageIndex : a.stageIndex - b.stageIndex,
      );
      const frontier = sorted[0];
      if (!frontier) return;

      const resp = await fetch(
        `/api/walk?from=${encodeURIComponent(frontier.canonicalNodeId)}&direction=${direction}&hops=3`,
      );
      if (!resp.ok) {
        if (preferHighStage) setCanWalkRight(false);
        else setCanWalkLeft(false);
        return;
      }
      const result = await resp.json() as { branches: WalkBranch[]; nodes: Record<string, Node>; edges: Record<string, Edge>; laneMap: Record<string, string> };

      if (result.branches.length === 0 || result.branches.every(b => b.path.length <= 1)) {
        if (preferHighStage) setCanWalkRight(false);
        else setCanWalkLeft(false);
        return;
      }

      const envelope = walkBranchesToEnvelope({
        branches: result.branches,
        focusNodeId: frontier.canonicalNodeId,
        laneMap: result.laneMap,
        includeSingletonBranches: false,
      });
      if (envelope.branches.length === 0) {
        if (preferHighStage) setCanWalkRight(false);
        else setCanWalkLeft(false);
        return;
      }

      setDomainNodes(prev => ({ ...prev, ...result.nodes }));
      const nextPatch = direction === 'forward'
        ? engineRef.current.appendExploreResult(layoutState, frontier.occurrenceId, envelope)
        : engineRef.current.prependExploreResult(layoutState, frontier.occurrenceId, envelope);
      setPatch(deepClone(nextPatch));
      setWalkCount(c => c + 1);
    } finally {
      isWalkingRef.current = false;
      setIsWalking(false);
    }
  }, [initData]);

  const walkRight = useCallback(() => { walk('forward'); }, [walk]);
  const walkLeft = useCallback(() => { walk('backward'); }, [walk]);

  const setOccurrenceLock = useCallback((occurrenceId: string, lockLevel: 'hard' | 'none') => {
    const layoutState = layoutStateRef.current;
    const occurrence = layoutState?.occurrences[occurrenceId];
    if (!layoutState || !occurrence) return;
    occurrence.lockLevel = lockLevel;
    if (lockLevel === 'hard') {
      layoutState.locks[occurrenceId] = 'hard';
    } else {
      delete layoutState.locks[occurrenceId];
    }
  }, []);

  const resetOccurrencePosition = useCallback((occurrenceId: string) => {
    const layoutState = layoutStateRef.current;
    const baseline = baselineLayoutStateRef.current?.occurrences[occurrenceId];
    const occurrence = layoutState?.occurrences[occurrenceId];
    if (!layoutState || !baseline || !occurrence) return;
    layoutState.occurrences[occurrenceId] = {
      ...occurrence,
      lane: baseline.lane,
      stageIndex: baseline.stageIndex,
      rowIndex: baseline.rowIndex,
      x: baseline.x,
      y: baseline.y,
      width: baseline.width,
      height: baseline.height,
    };
  }, []);

  return {
    patch,
    domainNodes,
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
