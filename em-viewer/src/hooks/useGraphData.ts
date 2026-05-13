import { useState, useEffect, useCallback } from 'react';
import type { Node, Edge } from '@em/domain/types';
import type { WalkBranch } from '@em/graph/graph-builder';
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
  const [data, setData] = useState<InitResponse | null>(null);
  const [rootsData, setRootsData] = useState<RootsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/init').then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<InitResponse>;
      }),
      fetch('/api/roots').then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<RootsResponse>;
      }),
    ])
      .then(([initResp, rootsResp]) => {
        setData(initResp);
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
    fetch(`/api/init?focus=${encodeURIComponent(newFocusId)}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<InitResponse>;
      })
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

export function getDisplayName(nodeMap: Record<string, Node> | null, canonicalNodeId: string): string {
  if (!nodeMap) return canonicalNodeId;
  const node = nodeMap[canonicalNodeId];
  if (node?.displayName) return node.displayName;
  const parts = canonicalNodeId.split('.');
  return parts[parts.length - 1] ?? canonicalNodeId;
}
