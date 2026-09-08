import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LayoutState, Occurrence } from 'event-modeling-spec-cli/layout/types';
import type { VisualizationSnapshot } from 'event-modeling-spec-cli/viewer-contract/types';
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
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-detail'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const requested = firstLayoutRequest(fetchMock);

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
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-detail'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const requested = firstLayoutRequest(fetchMock);

    expect(requested.searchParams.get('hops')).toBe('12');
    expect(result.current.layoutRequest?.hops).toBe(12);
  });

  test('root refocus writes a clean base focus URL and fetches default layout params', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-detail&direction=backward&hops=3');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
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
    const requested = layoutRequests(fetchMock).at(-1)!;
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
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
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
    const requested = layoutRequests(fetchMock).at(-1)!;

    expect(requested.searchParams.get('focus')).toBe('ui.screen.return-detail');
    expect(requested.searchParams.get('direction')).toBe('backward');
    expect(requested.searchParams.get('hops')).toBe('3');
    expect(requested.searchParams.get('includeTruncatedPaths')).toBe('false');
  });

  test('draft URL context is sent to roots and layout requests', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-lookup&draft=draft_001&graph=compare&diff=overlay');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-lookup'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const roots = fetchMock.mock.calls
      .map((call) => new URL(String(call[0]), 'http://localhost'))
      .find((url) => url.pathname === '/api/roots')!;
    const layout = firstLayoutRequest(fetchMock);

    expect(roots.searchParams.get('draft')).toBe('draft_001');
    expect(roots.searchParams.get('graph')).toBe('compare');
    expect(layout.searchParams.get('draft')).toBe('draft_001');
    expect(layout.searchParams.get('graph')).toBe('compare');
    expect(layout.searchParams.get('diff')).toBe('overlay');
    expect(result.current.layoutRequest).toMatchObject({
      draft: 'draft_001',
      graph: 'compare',
      diff: 'overlay',
    });
  });

  test('keeps an empty draft graph mode selection instead of restoring compare', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-lookup&direction=forward&hops=4&draft=active&graph=compare&diff=overlay');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse());
      if (url.startsWith('/api/layout')) {
        const requested = new URL(url, 'http://localhost');
        const graph = requested.searchParams.get('graph') === 'base' ? 'base' : 'compare';
        return jsonResponse(snapshot('ui.screen.return-lookup', {
          draftGraph: graph,
          empty: graph === 'base',
        }));
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());
    await waitFor(() => expect(result.current.data?.draft?.graph).toBe('compare'));

    act(() => {
      result.current.navigateLayout({
        ...result.current.layoutRequest!,
        graph: 'base',
      }, 'push');
    });

    await waitFor(() => expect(result.current.data?.draft?.graph).toBe('base'));
    const params = new URLSearchParams(window.location.search);

    expect(result.current.layoutRequest?.graph).toBe('base');
    expect(result.current.data?.occurrences).toHaveLength(0);
    expect(params.get('graph')).toBe('base');
  });

  test('normalizes submitted draft URLs back to the current model', async () => {
    window.history.replaceState(null, '', '/?focus=ui.screen.return-lookup&draft=draft_submitted&graph=compare&diff=overlay');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/roots')) return jsonResponse(rootsResponse());
      if (url.startsWith('/api/drafts')) return jsonResponse(draftsResponse({
        drafts: [
          submittedDraft('draft_submitted'),
          openDraft('draft_001'),
        ],
      }));
      if (url.startsWith('/api/layout')) return jsonResponse(snapshot('ui.screen.return-lookup'));
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useGraphData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    const layout = firstLayoutRequest(fetchMock);
    const params = new URLSearchParams(window.location.search);

    expect(result.current.layoutRequest?.draft).toBeUndefined();
    expect(layout.searchParams.has('draft')).toBe(false);
    expect(params.has('draft')).toBe(false);
    expect(params.has('graph')).toBe(false);
    expect(params.has('diff')).toBe(false);
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

function draftsResponse(overrides: { activeDraftId?: string | null; drafts?: ReturnType<typeof openDraft>[] } = {}) {
  return {
    activeDraftId: overrides.activeDraftId ?? 'draft_001',
    drafts: overrides.drafts ?? [openDraft('draft_001')],
  };
}

function openDraft(id: string) {
  return {
    id,
    status: 'open',
    baseRevisionId: 'rev_000',
    message: 'Draft viewer overlay',
    isActive: true,
    summary: { totalChanges: 1 },
  };
}

function submittedDraft(id: string) {
  return {
    id,
    status: 'submitted',
    baseRevisionId: 'rev_000',
    message: 'Submitted draft',
    isActive: false,
    summary: { totalChanges: 78 },
  };
}

function firstLayoutRequest(fetchMock: ReturnType<typeof vi.fn>): URL {
  return layoutRequests(fetchMock)[0]!;
}

function layoutRequests(fetchMock: ReturnType<typeof vi.fn>): URL[] {
  return fetchMock.mock.calls
    .map((call) => new URL(String(call[0]), 'http://localhost'))
    .filter((url) => url.pathname === '/api/layout');
}

describe('maxLayoutHopsForRoots', () => {
  test('uses the event-modeling edge count when it is larger than the default', () => {
    expect(maxLayoutHopsForRoots(rootsResponse({ eventModelingEdgeCount: 18 }))).toBe(18);
  });
});

function snapshot(
  focusNodeId: string,
  options: { draftGraph?: 'base' | 'compare' | 'after'; empty?: boolean } = {},
): VisualizationSnapshot {
  const occurrence = occurrenceFor(focusNodeId);
  const occurrences = options.empty ? [] : [occurrence];
  return {
    focusNodeId,
    projectName: 'Returns Management',
    ...(options.draftGraph ? {
      draft: {
        id: 'draft_001',
        status: 'open',
        baseRevisionId: 'rev_000',
        message: 'Draft viewer overlay',
        graph: options.draftGraph,
        diff: 'overlay' as const,
      },
    } : {}),
    truncation: {
      includeTruncatedPaths: false,
      hiddenPathCount: 0,
    },
    layoutState: options.empty ? emptyLayoutState() : layoutStateFor(occurrence),
    occurrences,
    renderedEdges: [],
    swimlaneRects: options.empty ? [] : [
      { lane: 'shared', x: -40, y: -40, width: 300, height: 136 },
    ],
    laneDescriptors: [],
    domainNodes: {},
    domainEdges: {},
    laneMap: {},
  };
}

function emptyLayoutState(): LayoutState {
  return {
    occurrences: {},
    displayEdges: {},
    stageBuckets: {},
    laneRows: {},
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
