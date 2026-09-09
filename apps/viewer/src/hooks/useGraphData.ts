import { useState, useEffect, useCallback, useRef } from 'react';
import type { Node, Edge } from 'event-modeling-spec-cli/domain/types';
import type { WalkBranch } from 'event-modeling-spec-cli/graph/graph-builder';
import type { DraftContext, VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
import type { RootNodeInfo } from '../types';
import { fetchLayout } from './layoutApi';
import type { LayoutRequest } from './layoutRequest';
import {
  DEFAULT_MAX_LAYOUT_HOPS,
  defaultLayoutRequest,
  layoutRequestToApiSearchParams,
  readLayoutRequestFromLocation,
  refocusLayoutRequest,
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
  draft?: DraftContext;
  laneMap: Record<string, string>;
  graphStats?: {
    nodeCount: number;
    edgeCount: number;
    eventModelingEdgeCount: number;
  };
}

export interface DraftSummary {
  id: string;
  status: string;
  baseRevisionId: string;
  message: string;
  isActive: boolean;
  summary: Record<string, number>;
}

export interface DraftsResponse {
  activeDraftId: string | null;
  drafts: DraftSummary[];
}

type NavigateMode = 'push' | 'replace';

export function useGraphData() {
  const [data, setData] = useState<VisualizationSnapshot | null>(null);
  const [rootsData, setRootsData] = useState<RootsResponse | null>(null);
  const [draftsData, setDraftsData] = useState<DraftsResponse | null>(null);
  const [layoutRequest, setLayoutRequest] = useState<LayoutRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const successfulRequestRef = useRef<LayoutRequest | null>(null);

  useEffect(() => {
    let cancelled = false;

    const urlRequest = readLayoutRequestFromLocation(undefined, DEFAULT_MAX_LAYOUT_HOPS);

    Promise.all([
      fetchRoots(urlRequest),
      fetchDrafts(),
    ])
      .then(async ([rootsResp, draftsResp]) => {
        const urlRequestWithFallback = readLayoutRequestFromLocation(
          rootsResp.roots[0]?.canonicalId,
          maxLayoutHopsForRoots(rootsResp),
        );
        const request = normalizeDraftRequest(urlRequestWithFallback, draftsResp);
        if (cancelled) return;
        if (hasDifferentViewContext(urlRequestWithFallback, request)) {
          writeLayoutRequestToLocation(request, 'replace');
        }
        setRootsData(rootsResp);
        setDraftsData(draftsResp);
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
    navigateLayout(refocusLayoutRequest(newFocusId, layoutRequest), 'push');
  }, [layoutRequest, navigateLayout]);

  useEffect(() => {
    if (!layoutRequest) return;
    let cancelled = false;

    fetchRoots(layoutRequest)
      .then((rootsResp) => {
        if (cancelled) return;
        setRootsData(rootsResp);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [layoutRequest?.draft, layoutRequest?.graph, layoutRequest]);

  useEffect(() => {
    if (!layoutRequest) return;
    let cancelled = false;

    fetchLayout(layoutRequest)
      .then(layoutResp => {
        if (cancelled) return;
        const fallback = successfulRequestRef.current;
        if (fallback && shouldRestorePreviousRequest(layoutRequest, layoutResp, fallback)) {
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
      const urlRequest = readLayoutRequestFromLocation(
        rootsData.roots[0]?.canonicalId,
        maxLayoutHopsForRoots(rootsData),
      );
      const request = draftsData ? normalizeDraftRequest(urlRequest, draftsData) : urlRequest;
      if (hasDifferentViewContext(urlRequest, request)) {
        writeLayoutRequestToLocation(request, 'replace');
      }
      setLayoutRequest(request);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [draftsData, rootsData]);

  return {
    data,
    rootsData,
    loading,
    switching,
    error,
    layoutRequest,
    draftsData,
    navigateLayout,
    refocus,
  };
}

async function fetchRoots(request: Pick<LayoutRequest, 'draft' | 'graph' | 'diff'>): Promise<RootsResponse> {
  const params = layoutRequestToApiSearchParams({
    ...defaultLayoutRequest(),
    ...request,
  });
  const response = await fetch(`/api/roots?${params.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<RootsResponse>;
}

async function fetchDrafts(): Promise<DraftsResponse> {
  const response = await fetch('/api/drafts');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<DraftsResponse>;
}

function normalizeDraftRequest(request: LayoutRequest, draftsData: DraftsResponse): LayoutRequest {
  if (!request.draft) return request;

  const openDraftIds = new Set(draftsData.drafts
    .filter(draft => draft.status === 'open')
    .map(draft => draft.id));
  if (request.draft === 'active') {
    return draftsData.activeDraftId && openDraftIds.has(draftsData.activeDraftId)
      ? request
      : withoutDraftContext(request);
  }
  return openDraftIds.has(request.draft) ? request : withoutDraftContext(request);
}

function withoutDraftContext(request: LayoutRequest): LayoutRequest {
  const currentModelRequest = { ...request };
  delete currentModelRequest.draft;
  delete currentModelRequest.graph;
  delete currentModelRequest.diff;
  return currentModelRequest;
}

function hasDifferentViewContext(left: LayoutRequest, right: LayoutRequest): boolean {
  return left.draft !== right.draft || left.graph !== right.graph || left.diff !== right.diff;
}

export function maxLayoutHopsForRoots(rootsData: Pick<RootsResponse, 'graphStats'> | null | undefined): number {
  return Math.max(
    DEFAULT_MAX_LAYOUT_HOPS,
    rootsData?.graphStats?.eventModelingEdgeCount ?? 0,
  );
}

function shouldRestorePreviousRequest(
  request: LayoutRequest,
  snapshot: VisualizationSnapshot,
  fallback: LayoutRequest,
): boolean {
  return isEmptyDirectionalWalk(request, snapshot) && hasSameViewContext(request, fallback);
}

function isEmptyDirectionalWalk(request: LayoutRequest, snapshot: VisualizationSnapshot): boolean {
  return request.direction !== 'both' && snapshot.occurrences.length === 0;
}

function hasSameViewContext(left: LayoutRequest, right: LayoutRequest): boolean {
  return left.draft === right.draft &&
    left.graph === right.graph &&
    left.diff === right.diff &&
    left.includeTruncatedPaths === right.includeTruncatedPaths;
}

export function getDisplayName(nodeMap: Record<string, Node> | null, canonicalNodeId: string): string {
  if (!nodeMap) return canonicalNodeId;
  const node = nodeMap[canonicalNodeId];
  if (node?.displayName) return node.displayName;
  const parts = canonicalNodeId.split('.');
  return parts[parts.length - 1] ?? canonicalNodeId;
}
