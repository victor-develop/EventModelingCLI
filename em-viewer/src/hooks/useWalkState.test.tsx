import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Node as DomainNode } from '@em/domain/types';
import type { LayoutState, Occurrence, RenderedEdge, SwimlaneRect } from '@em/layout/types';
import type { LaneDescriptor, VisualizationSnapshot } from '@em/viewer-contract/types';
import { useWalkState } from './useWalkState';

describe('useWalkState stateless layout navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('walkRight requests a bounded layout snapshot and replaces the visible snapshot without local layout mutation', async () => {
    const initial = snapshot([
      occurrence('occ-leftmost-old', 'ui.screen.return-lookup', 'shared', 0),
      occurrence('occ-cmd-lookup-order', 'returns.cmd.lookup-order', 'cmd', 1),
      occurrence('occ-event-lookup-completed', 'returns.evt.order-lookup-completed', 'evt', 2),
    ]);
    const next = snapshot([
      occurrence('occ-vm-order-summary', 'returns.view.order-summary', 'viewModel', 0),
      occurrence('occ-ui-return-form', 'ui.screen.return-request-form', 'shared', 1),
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/layout')) return jsonResponse(next);
      if (url.startsWith('/api/walk')) return jsonResponse({ branches: [], nodes: {}, edges: {}, laneMap: {} });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWalkState(initial));

    act(() => {
      result.current.walkRight();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(requested.pathname).toBe('/api/layout');
    expect(requested.searchParams.get('focus')).toBe('returns.evt.order-lookup-completed');
    expect(requested.searchParams.get('direction')).toBe('forward');
    expect(requested.searchParams.get('hops')).toBe('3');
    expect(requested.searchParams.has('width')).toBe(false);
    expect(requested.searchParams.has('shift')).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).startsWith('/api/walk'))).toBe(false);

    await waitFor(() => {
      const currentSnapshot = (result.current as typeof result.current & { snapshot?: VisualizationSnapshot }).snapshot;
      expect(currentSnapshot).toEqual(next);
      expect(currentSnapshot?.occurrences.map((occ) => occ.occurrenceId)).toEqual([
        'occ-vm-order-summary',
        'occ-ui-return-form',
      ]);
      expect(Object.keys(currentSnapshot?.layoutState.occurrences ?? {})).toEqual([
        'occ-vm-order-summary',
        'occ-ui-return-form',
      ]);
    });
  });

  test('walkLeft requests a backward layout snapshot from the left frontier with viewer-agnostic params', async () => {
    const initial = snapshot([
      occurrence('occ-later-view', 'returns.view.order-summary', 'viewModel', 8),
      occurrence('occ-earliest-ui', 'ui.screen.return-lookup', 'shared', 3),
      occurrence('occ-middle-cmd', 'returns.cmd.lookup-order', 'cmd', 5),
    ]);
    const previous = snapshot([
      occurrence('occ-previous-event', 'returns.evt.return-created', 'evt', 0),
    ]);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/layout')) return jsonResponse(previous);
      if (url.startsWith('/api/walk')) return jsonResponse({ branches: [], nodes: {}, edges: {}, laneMap: {} });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useWalkState(initial));

    act(() => {
      result.current.walkLeft();
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const requested = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost');
    expect(requested.pathname).toBe('/api/layout');
    expect(requested.searchParams.get('focus')).toBe('ui.screen.return-lookup');
    expect(requested.searchParams.get('direction')).toBe('backward');
    expect(requested.searchParams.get('hops')).toBe('3');
    expect(requested.searchParams.has('width')).toBe(false);
    expect(requested.searchParams.has('shift')).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).startsWith('/api/walk'))).toBe(false);

    await waitFor(() => {
      const currentSnapshot = (result.current as typeof result.current & { snapshot?: VisualizationSnapshot }).snapshot;
      expect(currentSnapshot).toEqual(previous);
      expect(currentSnapshot?.occurrences.map((occ) => occ.occurrenceId)).toEqual(['occ-previous-event']);
      expect(Object.keys(currentSnapshot?.layoutState.occurrences ?? {})).toEqual(['occ-previous-event']);
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function snapshot(occurrences: Occurrence[], renderedEdges: RenderedEdge[] = []): VisualizationSnapshot {
  const domainNodes = Object.fromEntries(
    occurrences.map((occ) => [occ.canonicalNodeId, domainNode(occ.canonicalNodeId, occ)]),
  );
  const layoutState = layoutStateFor(occurrences, renderedEdges);

  return {
    focusNodeId: occurrences[0]?.canonicalNodeId ?? 'ui.screen.empty',
    projectName: 'Returns Management',
    layoutState,
    occurrences,
    renderedEdges,
    swimlaneRects: swimlanesFor(occurrences),
    laneDescriptors: laneDescriptorsFor(occurrences),
    domainNodes,
    domainEdges: {},
    laneMap: Object.fromEntries(occurrences.map((occ) => [occ.canonicalNodeId, occ.lane])),
  };
}

function layoutStateFor(occurrences: Occurrence[], renderedEdges: RenderedEdge[]): LayoutState {
  return {
    occurrences: Object.fromEntries(occurrences.map((occ) => [occ.occurrenceId, occ])),
    displayEdges: Object.fromEntries(renderedEdges.map((edge) => [edge.displayEdgeId, edge])),
    stageBuckets: occurrences.reduce<Record<number, string[]>>((buckets, occ) => {
      buckets[occ.stageIndex] = [...(buckets[occ.stageIndex] ?? []), occ.occurrenceId];
      return buckets;
    }, {}),
    laneRows: occurrences.reduce<Record<string, string[]>>((rows, occ) => {
      rows[occ.lane] = [...(rows[occ.lane] ?? []), occ.occurrenceId];
      return rows;
    }, {}),
    locks: {},
    frontierHandles: {},
    viewport: {
      minStage: Math.min(...occurrences.map((occ) => occ.stageIndex)),
      maxStage: Math.max(...occurrences.map((occ) => occ.stageIndex)),
      zoom: 1,
      centerX: 0,
      centerY: 0,
    },
    swimlaneRects: swimlanesFor(occurrences),
  };
}

function occurrence(
  occurrenceId: string,
  canonicalNodeId: string,
  nodeKind: Occurrence['nodeKind'],
  stageIndex: number,
): Occurrence {
  const lane = laneFor(nodeKind);
  return {
    occurrenceId,
    canonicalNodeId,
    nodeKind,
    lane,
    stageIndex,
    rowIndex: 0,
    displayRole: displayRoleFor(nodeKind),
    branchClusterId: 'main',
    lockLevel: 'none',
    x: stageIndex * 400,
    y: lane === 'nonRole' ? 40 : lane === 'commandViewModel' ? 240 : 440,
    width: 220,
    height: 56,
  };
}

function domainNode(canonicalId: string, occ: Occurrence): DomainNode {
  return {
    id: canonicalId,
    canonicalId,
    projectId: 'returns',
    kind: occ.nodeKind === 'shared' ? 'ui.screen' : occ.nodeKind,
    displayName: canonicalId.split('.').at(-1) ?? canonicalId,
    tags: [],
    domains: [],
  };
}

function laneFor(kind: Occurrence['nodeKind']): string {
  if (kind === 'shared') return 'nonRole';
  if (kind === 'evt') return 'event';
  return 'commandViewModel';
}

function displayRoleFor(kind: Occurrence['nodeKind']): Occurrence['displayRole'] {
  if (kind === 'cmd') return 'command';
  if (kind === 'evt') return 'event';
  if (kind === 'viewModel') return 'projection';
  return 'ui';
}

function swimlanesFor(occurrences: Occurrence[]): SwimlaneRect[] {
  const minX = Math.min(...occurrences.map((occ) => occ.x), 0) - 40;
  const maxX = Math.max(...occurrences.map((occ) => occ.x + occ.width), 900) + 40;
  return [
    { lane: 'nonRole', x: minX, y: 0, width: maxX - minX, height: 136 },
    { lane: 'commandViewModel', x: minX, y: 200, width: maxX - minX, height: 136 },
    { lane: 'event', x: minX, y: 400, width: maxX - minX, height: 136 },
  ];
}

function laneDescriptorsFor(occurrences: Occurrence[]): LaneDescriptor[] {
  return [...new Set(swimlanesFor(occurrences).map((rect) => rect.lane))].map((lane) => ({
    id: lane,
    label: lane,
    kind: lane === 'event' ? 'event' : lane === 'commandViewModel' ? 'commandViewModel' : 'shared',
  }));
}
