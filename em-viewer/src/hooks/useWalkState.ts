import { useState, useRef, useCallback, useEffect } from 'react';
import { LayoutEngine } from '@em/layout/layout-engine';
import type { LayoutState } from '@em/layout/types';
import type { WalkBranch } from '@em/graph/graph-builder';
import type { Node, Edge } from '@em/domain/types';
import { walkResultToEnvelope } from '../utils/walk-to-envelope';
import type { InitResponse } from './useGraphData';

interface UseWalkStateResult {
  layoutState: LayoutState | null;
  nodeMap: Record<string, Node>;
  walkLeft: () => void;
  walkRight: () => void;
  canWalkLeft: boolean;
  canWalkRight: boolean;
  walkCount: number;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function useWalkState(initData: InitResponse | null): UseWalkStateResult {
  const engineRef = useRef(new LayoutEngine());
  const [layoutState, setLayoutState] = useState<LayoutState | null>(null);
  const [nodeMap, setNodeMap] = useState<Record<string, Node>>({});
  const [walkCount, setWalkCount] = useState(0);
  const isWalkingRef = useRef(false);
  const [canWalkLeft, setCanWalkLeft] = useState(true);
  const [canWalkRight, setCanWalkRight] = useState(true);

  const allBranchesRef = useRef<WalkBranch[]>([]);

  const laneMapRef = useRef<Record<string, string>>({});

  const rebuildLayout = useCallback((focusNodeId: string) => {
    if (allBranchesRef.current.length === 0) return;
    const envelope = walkResultToEnvelope(
      { branches: allBranchesRef.current },
      focusNodeId,
      laneMapRef.current,
    );
    if (envelope.branches.length === 0) return;

    const state = engineRef.current.initLayout(envelope);
    setLayoutState(deepClone(state));
  }, []);

  useEffect(() => {
    if (!initData) return;

    allBranchesRef.current = [...initData.branches];
    setNodeMap(initData.nodes);
    laneMapRef.current = initData.laneMap ?? {};

    rebuildLayout(initData.focusNodeId);
    setWalkCount(0);
    setCanWalkLeft(true);
    setCanWalkRight(true);
  }, [initData, rebuildLayout]);

  const walk = useCallback(async (direction: 'forward' | 'backward') => {
    if (!layoutState || !initData || isWalkingRef.current) return;
    isWalkingRef.current = true;

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

      allBranchesRef.current = [...allBranchesRef.current, ...result.branches];
      setNodeMap(prev => ({ ...prev, ...result.nodes }));
      if (result.laneMap) {
        laneMapRef.current = { ...laneMapRef.current, ...result.laneMap };
      }

      rebuildLayout(initData.focusNodeId);
      setWalkCount(c => c + 1);
    } finally {
      isWalkingRef.current = false;
    }
  }, [layoutState, initData, rebuildLayout]);

  const walkRight = useCallback(() => { walk('forward'); }, [walk]);
  const walkLeft = useCallback(() => { walk('backward'); }, [walk]);

  return { layoutState, nodeMap, walkLeft, walkRight, canWalkLeft, canWalkRight, walkCount };
}
