import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Node as DomainNode } from '@em/domain/types';
import type { LayoutState, Occurrence, RenderedEdge, SwimlaneRect } from '@em/layout/types';
import type { LaneDescriptor, VisualizationSnapshot } from '@em/viewer-contract/types';
import { useWalkState } from './useWalkState';

describe('useWalkState stateless layout navigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('walkRight emits a bounded layout request and waits for parent hydration', () => {
    const initial = snapshot([
      occurrence('occ-leftmost-old', 'ui.screen.return-lookup', 'shared', 0),
      occurrence('occ-cmd-lookup-order', 'returns.cmd.lookup-order', 'cmd', 1),
      occurrence('occ-event-lookup-completed', 'returns.evt.order-lookup-completed', 'evt', 2),
    ]);
    const next = snapshot([
      occurrence('occ-vm-order-summary', 'returns.view.order-summary', 'viewModel', 0),
      occurrence('occ-ui-return-form', 'ui.screen.return-request-form', 'shared', 1),
    ]);

    vi.stubGlobal('fetch', vi.fn());
    const onNavigate = vi.fn();

    const { result, rerender } = renderHook(
      ({ data }) => useWalkState(data, { onNavigate }),
      { initialProps: { data: initial } },
    );

    act(() => {
      result.current.walkRight();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'returns.evt.order-lookup-completed',
      direction: 'forward',
      hops: 3,
      includeTruncatedPaths: false,
    });

    expect(fetch).not.toHaveBeenCalled();

    rerender({ data: next });

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

  test('walkLeft emits a backward layout request from the left frontier', () => {
    const initial = snapshot([
      occurrence('occ-later-view', 'returns.view.order-summary', 'viewModel', 8),
      occurrence('occ-earliest-ui', 'ui.screen.return-lookup', 'shared', 3),
      occurrence('occ-middle-cmd', 'returns.cmd.lookup-order', 'cmd', 5),
    ]);
    vi.stubGlobal('fetch', vi.fn());
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, { onNavigate }));

    act(() => {
      result.current.walkLeft();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'ui.screen.return-lookup',
      direction: 'backward',
      hops: 3,
      includeTruncatedPaths: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('walkLeft ignores display-only role markers when selecting the frontier', () => {
    const initial = snapshot([
      roleOccurrence('occ-role-buyer', 'role.buyer', -1),
      occurrence('occ-return-form', 'ui.screen.return-request-form', 'shared', 0),
      occurrence('occ-request-command', 'returns.cmd.request-return', 'cmd', 1),
    ]);
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, { onNavigate, walkHops: 2 }));

    act(() => {
      result.current.walkLeft();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'ui.screen.return-request-form',
      direction: 'backward',
      hops: 2,
      includeTruncatedPaths: false,
    });
  });

  test('walkRight uses the configured hop count', () => {
    const initial = snapshot([
      occurrence('occ-root', 'ui.screen.return-lookup', 'shared', 0),
      occurrence('occ-frontier', 'returns.cmd.lookup-order', 'cmd', 1),
    ]);
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, { onNavigate, walkHops: 5 }));

    act(() => {
      result.current.walkRight();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'returns.cmd.lookup-order',
      direction: 'forward',
      hops: 5,
      includeTruncatedPaths: false,
    });
  });

  test('walkRight can use hop counts above the default max when the graph supports it', () => {
    const initial = snapshot([
      occurrence('occ-root', 'ui.screen.return-lookup', 'shared', 0),
      occurrence('occ-frontier', 'returns.cmd.lookup-order', 'cmd', 1),
    ]);
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, {
      onNavigate,
      walkHops: 12,
      maxHops: 20,
    }));

    act(() => {
      result.current.walkRight();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'returns.cmd.lookup-order',
      direction: 'forward',
      hops: 12,
      includeTruncatedPaths: false,
    });
  });

  test('walk navigation preserves includeTruncatedPaths', () => {
    const initial = snapshot([
      occurrence('occ-root', 'returns.proc.public-api', 'shared', 0),
      occurrence('occ-frontier', 'returns.cmd.lookup-order', 'cmd', 1),
    ]);
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, {
      onNavigate,
      includeTruncatedPaths: true,
    }));

    act(() => {
      result.current.walkRight();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'returns.cmd.lookup-order',
      direction: 'forward',
      hops: 3,
      includeTruncatedPaths: true,
    });
  });

  test('walk navigation preserves draft graph and diff context', () => {
    const initial = snapshot([
      occurrence('occ-root', 'returns.proc.public-api', 'shared', 0),
      occurrence('occ-frontier', 'returns.cmd.lookup-order', 'cmd', 1),
    ]);
    const onNavigate = vi.fn();

    const { result } = renderHook(() => useWalkState(initial, {
      onNavigate,
      requestContext: {
        focus: 'returns.proc.public-api',
        direction: 'both',
        hops: 2,
        includeTruncatedPaths: false,
        draft: 'draft_001',
        graph: 'compare',
        diff: 'overlay',
      },
    }));

    act(() => {
      result.current.walkRight();
    });

    expect(onNavigate).toHaveBeenCalledWith({
      focus: 'returns.cmd.lookup-order',
      direction: 'forward',
      hops: 3,
      includeTruncatedPaths: false,
      draft: 'draft_001',
      graph: 'compare',
      diff: 'overlay',
    });
  });
});

function snapshot(occurrences: Occurrence[], renderedEdges: RenderedEdge[] = []): VisualizationSnapshot {
  const domainNodes = Object.fromEntries(
    occurrences.map((occ) => [occ.canonicalNodeId, domainNode(occ.canonicalNodeId, occ)]),
  );
  const layoutState = layoutStateFor(occurrences, renderedEdges);

  return {
    focusNodeId: occurrences[0]?.canonicalNodeId ?? 'ui.screen.empty',
    projectName: 'Returns Management',
    truncation: {
      includeTruncatedPaths: false,
      hiddenPathCount: 0,
    },
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

function roleOccurrence(
  occurrenceId: string,
  canonicalNodeId: string,
  stageIndex: number,
): Occurrence {
  return {
    occurrenceId,
    canonicalNodeId,
    nodeKind: 'role',
    lane: `role:${canonicalNodeId}`,
    stageIndex,
    rowIndex: 0,
    displayRole: 'role',
    branchClusterId: 'role',
    lockLevel: 'none',
    x: stageIndex * 400,
    y: 40,
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
