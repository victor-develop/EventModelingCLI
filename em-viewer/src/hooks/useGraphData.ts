import { useState, useEffect, useCallback, useRef } from 'react';
import type { Node, Edge } from '@em/domain/types';
import type { WalkBranch } from '@em/graph/graph-builder';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { RootNodeInfo } from '../types';
import { fetchLayout } from './layoutApi';
import type { LayoutRequest } from './layoutRequest';
import {
  DEFAULT_MAX_LAYOUT_HOPS,
  defaultLayoutRequest,
  readLayoutRequestFromLocation,
  writeLayoutRequestToLocation,
} from './layoutRequest';

export interface InitResponse {
  focusNodeId: string;
  projectName: string;
  branches: WalkBranch[];
  nodes: Record<string, Node>;
  edges: Record<string, Edge>;
  laneMap: Record<string, string>;
}

export interface RootsResponse {
  roots: RootNodeInfo[];
  projectName: string;
  laneMap: Record<string, string>;
  graphStats?: {
    nodeCount: number;
    edgeCount: number;
    eventModelingEdgeCount: number;
  };
}

type NavigateMode = 'push' | 'replace';

export function useGraphData() {
  const [data, setData] = useState<VisualizationSnapshot | null>(null);
  const [rootsData, setRootsData] = useState<RootsResponse | null>(null);
  const [layoutRequest, setLayoutRequest] = useState<LayoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successfulRequestRef = useRef<LayoutRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/roots')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RootsResponse>;
      })
      .then(async (rootsResp) => {
        const request = readLayoutRequestFromLocation(
          rootsResp.roots[0]?.canonicalId,
          maxLayoutHopsForRoots(rootsResp),
        );
        if (cancelled) return;
        setRootsData(rootsResp);
        setLayoutRequest(request);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const navigateLayout = useCallback((request: LayoutRequest, mode: NavigateMode = 'push') => {
    setError(null);
    if (successfulRequestRef.current) setSwitching(true);
    else setLoading(true);
    writeLayoutRequestToLocation(request, mode);
    setLayoutRequest(request);
  }, []);

  const refocus = useCallback((newFocusId: string) => {
    navigateLayout(defaultLayoutRequest(newFocusId), 'push');
  }, [navigateLayout]);

  useEffect(() => {
    if (!layoutRequest) return;
    let cancelled = false;

    fetchLayout(layoutRequest)
      .then(layoutResp => {
        if (cancelled) return;
        const fallback = successfulRequestRef.current;
        if (fallback && isEmptyWalk(layoutRequest, layoutResp)) {
          writeLayoutRequestToLocation(fallback, 'replace');
          setLayoutRequest(fallback);
          return;
        }

        successfulRequestRef.current = layoutRequest;
        setData(layoutResp);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setSwitching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [layoutRequest]);

  useEffect(() => {
    if (!rootsData) return;

    const onPopState = () => {
      if (successfulRequestRef.current) setSwitching(true);
      else setLoading(true);
      setError(null);
      setLayoutRequest(readLayoutRequestFromLocation(
        rootsData.roots[0]?.canonicalId,
        maxLayoutHopsForRoots(rootsData),
      ));
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [rootsData]);

  return {
    data,
    rootsData,
    loading,
    switching,
    error,
    layoutRequest,
    navigateLayout,
    refocus,
  };
}

export function maxLayoutHopsForRoots(rootsData: Pick<RootsResponse, 'graphStats'> | null | undefined): number {
  return Math.max(
    DEFAULT_MAX_LAYOUT_HOPS,
    rootsData?.graphStats?.eventModelingEdgeCount ?? 0,
  );
}

function isEmptyWalk(request: LayoutRequest, snapshot: VisualizationSnapshot): boolean {
  return request.direction !== 'both' && snapshot.occurrences.length === 0;
}

export function getDisplayName(nodeMap: Record<string, Node> | null, canonicalNodeId: string): string {
  if (!nodeMap) return canonicalNodeId;
  const node = nodeMap[canonicalNodeId];
  if (node?.displayName) return node.displayName;
  const parts = canonicalNodeId.split('.');
  return parts[parts.length - 1] ?? canonicalNodeId;
}
