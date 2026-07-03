import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@em/domain/types';
import type { WalkBranch } from '@em/graph/graph-builder';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import type { RootNodeInfo } from '../types';

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
}

export function useGraphData() {
  const [data, setData] = useState<VisualizationSnapshot | null>(null);
  const [rootsData, setRootsData] = useState<RootsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/roots')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RootsResponse>;
      })
      .then(async (rootsResp) => {
        const firstFocus = rootsResp.roots[0]?.canonicalId;
        const layoutResp = await fetchLayout(firstFocus);
        setData(layoutResp);
        setRootsData(rootsResp);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const refocus = useCallback((newFocusId: string) => {
    setSwitching(true);
    fetchLayout(newFocusId)
      .then(initResp => {
        setData(initResp);
        setSwitching(false);
      })
      .catch(err => {
        setError(err.message);
        setSwitching(false);
      });
  }, []);

  return { data, rootsData, loading, switching, error, refocus };
}

function fetchLayout(focus?: string): Promise<VisualizationSnapshot> {
  const params = new URLSearchParams({ direction: 'both', hops: '2' });
  if (focus) params.set('focus', focus);
  return fetch(`/api/layout?${params.toString()}`).then(async r => {
    if (!r.ok) {
      const body = await r.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
      throw new Error(body?.error?.message ?? `HTTP ${r.status}`);
    }
    return r.json() as Promise<VisualizationSnapshot>;
  });
}

export function getDisplayName(nodeMap: Record<string, Node> | null, canonicalNodeId: string): string {
  if (!nodeMap) return canonicalNodeId;
  const node = nodeMap[canonicalNodeId];
  if (node?.displayName) return node.displayName;
  const parts = canonicalNodeId.split('.');
  return parts[parts.length - 1] ?? canonicalNodeId;
}
