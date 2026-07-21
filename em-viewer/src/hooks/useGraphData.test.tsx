import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LayoutState, Occurrence } from '@em/layout/types';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { maxLayoutHopsForRoots, useGraphData } from './useGraphData';

describe('useGraphData layout URL hydration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  test('loads the initial snapshot from shareable focus, direction, and hops params', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=backward&hops=3');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-detail'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const requested = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost');

    expect(requested.pathname).toBe('/api/layout');
    expect(requested.searchParams.get('focus')).toBe('ui.screen.return-detail');
    expect(requested.searchParams.get('direction')).toBe('backward');
    expect(requested.searchParams.get('hops')).toBe('3');
    expect(requested.searchParams.get('includeTruncatedPaths')).toBe('false');
    expect(result.current.data?.focusNodeId).toBe('ui.screen.return-detail');
  });

  test('clamps shareable URL hops with the graph-derived maximum', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=forward&hops=99');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse({ eventModelingEdgeCount: 12 }));
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-detail'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const requested = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost');

    expect(requested.searchParams.get('hops')).toBe('12');
    expect(result.current.layoutRequest?.hops).toBe(12);
  });

  test('root refocus writes a clean base focus URL and fetches default layout params', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=backward&hops=3');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/layout')) {
        const requested = new URL(url, 'http://localhost');
        return jsonResponse(snapshot(requested.searchParams.get('focus') ?? 'ui.screen.return-lookup'));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refocus('ui.screen.app-installation');
    });

    await waitFor(() => expect(result.current.data?.focusNodeId).toBe('ui.screen.app-installation'));
    const requested = new URL(String(fetchMock.mock.calls[2]?.[0]), 'http://localhost');
    const visibleParams = new URLSearchParams(window.location.search);

    expect(requested.searchParams.get('focus')).toBe('ui.screen.app-installation');
    expect(requested.searchParams.get('direction')).toBe('both');
    expect(requested.searchParams.get('hops')).toBe('2');
    expect(requested.searchParams.get('includeTruncatedPaths')).toBe('false');
    expect(visibleParams.get('focus')).toBe('ui.screen.app-installation');
    expect(visibleParams.has('direction')).toBe(false);
    expect(visibleParams.has('hops')).toBe(false);
    expect(visibleParams.has('includeTruncatedPaths')).toBe(false);
  });

  test('browser history changes hydrate from the URL through the same layout request flow', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-lookup');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/layout')) {
        const requested = new URL(url, 'http://localhost');
        return jsonResponse(snapshot(requested.searchParams.get('focus') ?? 'ui.screen.return-lookup'));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());
    await waitFor(() => expect(result.current.data?.focusNodeId).toBe('ui.screen.return-lookup'));
    await waitFor(() => expect(result.current.rootsData?.roots.length).toBeGreaterThan(0));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      window.history.pushState(null, '', '/?focus=ui.screen.return-detail&direction=backward&hops=3');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => expect(result.current.data?.focusNodeId).toBe('ui.screen.return-detail'));
    const requested = new URL(String(fetchMock.mock.calls[2]?.[0]), 'http://localhost');

    expect(requested.searchParams.get('focus')).toBe('ui.screen.return-detail');
    expect(requested.searchParams.get('direction')).toBe('backward');
    expect(requested.searchParams.get('hops')).toBe('3');
    expect(requested.searchParams.get('includeTruncatedPaths')).toBe('false');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rootsResponse(overrides: { eventModelingEdgeCount?: number } = {}) {
  return {
    projectName: 'Returns Management',
    roots: [
      { canonicalId: 'ui.screen.return-lookup', kind: 'ui.screen', displayName: 'Return Lookup' },
      { canonicalId: 'ui.screen.app-installation', kind: 'ui.screen', displayName: 'App Installation' },
    ],
    laneMap: {},
    graphStats: {
      nodeCount: 8,
      edgeCount: 9,
      eventModelingEdgeCount: overrides.eventModelingEdgeCount ?? 9,
    },
  };
}

describe('maxLayoutHopsForRoots', () => {
  test('uses the event-modeling edge count when it is larger than the default', () => {
    expect(maxLayoutHopsForRoots(rootsResponse({ eventModelingEdgeCount: 18 }))).toBe(18);
  });
});

function snapshot(focusNodeId: string): VisualizationSnapshot {
  const occurrence = occurrenceFor(focusNodeId);
  return {
    focusNodeId,
    projectName: 'Returns Management',
    truncation: {
      includeTruncatedPaths: false,
      hiddenPathCount: 0,
    },
    layoutState: layoutStateFor(occurrence),
    occurrences: [occurrence],
    renderedEdges: [],
    swimlaneRects: [
      { lane: 'shared', x: -40, y: -40, width: 300, height: 136 },
    ],
    laneDescriptors: [],
    domainNodes: {},
    domainEdges: {},
    laneMap: {},
  };
}

function occurrenceFor(canonicalNodeId: string): Occurrence {
  return {
    occurrenceId: `occ-${canonicalNodeId}`,
    canonicalNodeId,
    nodeKind: 'shared',
    lane: 'shared',
    stageIndex: 0,
    rowIndex: 0,
    displayRole: 'ui',
    branchClusterId: 'main',
    lockLevel: 'none',
    x: 0,
    y: 0,
    width: 220,
    height: 56,
  };
}

function layoutStateFor(occurrence: Occurrence): LayoutState {
  return {
    occurrences: { [occurrence.occurrenceId]: occurrence },
    displayEdges: {},
    stageBuckets: { 0: [occurrence.occurrenceId] },
    laneRows: { shared: [occurrence.occurrenceId] },
    locks: {},
    frontierHandles: {},
    viewport: {
      minStage: 0,
      maxStage: 0,
      zoom: 1,
      centerX: 0,
      centerY: 0,
    },
    swimlaneRects: [],
  };
}
