import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import type { LayoutPatch, RenderedEdge } from '@em/layout/types';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { applyLayoutPatchToReactFlow } from './applyLayoutPatch';
import { toReactFlowEdges } from './toReactFlowEdges';
import { toReactFlowNodes } from './toReactFlowNodes';

const ROOT = path.resolve(__dirname, '../../../../__tests__/fixtures/xyflow-spec/04-xyflow-adapter-components');

type FixtureCompatiblePatch = LayoutPatch & {
  addedRenderedEdges?: RenderedEdge[];
  updatedRenderedEdges?: RenderedEdge[];
  type?: string;
};

describe('xyflow adapter contract fixtures', () => {
  test('converts a VisualizationSnapshot into React Flow nodes and edges', () => {
    const caseRoot = path.join(ROOT, 'contract-tests-xyflow-adapter/tc01-minimal-linear-adapter');
    const snapshot = readJsonFence<VisualizationSnapshot>(path.join(caseRoot, 'input-visualizationsnapshot.md'));
    const expectedNodes = readJsonFence(path.join(caseRoot, 'output-react-flow-nodes.md'));
    const expectedEdges = readJsonFence(path.join(caseRoot, 'output-react-flow-edges.md'));

    expect(toReactFlowNodes(snapshot)).toEqual(expectedNodes);
    expect(toReactFlowEdges(snapshot)).toEqual(expectedEdges);
    expect(toReactFlowNodes(snapshot, { includeFrontierHandles: true }).filter((node) => node.type === 'frontierHandle')).toHaveLength(2);
  });

  test('applies an append patch without regenerating the full React Flow state', () => {
    const caseRoot = path.join(ROOT, 'contract-tests-layoutpatch-adapter/tc01-append-right-patch');
    const previous = readJsonFence<{ nodes: Node[]; edges: Edge[] }>(path.join(caseRoot, 'input-previous-react-flow-state.md'));
    const patch = readJsonFence<FixtureCompatiblePatch>(path.join(caseRoot, 'input-layoutpatch.md'));
    const expected = readJsonFence(path.join(caseRoot, 'output-next-react-flow-state.md'));

    expect(applyLayoutPatchToReactFlow({
      patch,
      previousNodes: previous.nodes,
      previousEdges: previous.edges,
      snapshotContext: {
        domainNodes: {},
        laneMap: { shared: 'shared', commandViewModel: 'command / viewModel', event: 'event' },
      },
    })).toEqual(expected);
  });

  test('keeps stable child absolute positions and refreshes frontier handles when lane groups move', () => {
    const previousNodes = [
      { id: 'lane:shared', type: 'swimlaneGroup', position: { x: -40, y: -40 }, style: { width: 900, height: 136 }, data: { lane: 'shared', label: 'shared' } },
      { id: 'lane:commandViewModel', type: 'swimlaneGroup', position: { x: -40, y: 160 }, style: { width: 900, height: 136 }, data: { lane: 'commandViewModel', label: 'command / viewModel' } },
      { id: 'occ-cmd-submit-order', type: 'em.cmd', parentId: 'lane:commandViewModel', extent: 'parent', position: { x: 440, y: 40 }, data: { canonicalNodeId: 'cmd.submit-order', label: 'Submit Order', visibleLane: 'commandViewModel', lockLevel: 'hard' } },
      { id: 'frontier:left', type: 'frontierHandle', position: { x: -96, y: 200 }, data: { direction: 'left', label: 'Explore left' } },
      { id: 'frontier:right', type: 'frontierHandle', position: { x: 700, y: 200 }, data: { direction: 'right', label: 'Explore right' } },
    ];
    const patch = {
      addedOccurrences: [],
      updatedOccurrences: [],
      addedEdges: [],
      updatedEdges: [],
      updatedSwimlaneRects: [
        { lane: 'shared', x: -40, y: -40, width: 1200, height: 136 },
        { lane: 'commandViewModel', x: -40, y: 240, width: 1200, height: 136 },
      ],
      updatedStageRange: { min: 0, max: 1 },
      viewportHint: { revealDirection: 'right' },
    };

    const next = applyLayoutPatchToReactFlow({
      patch,
      previousNodes: previousNodes as Node[],
      previousEdges: [],
      snapshotContext: { domainNodes: {}, laneMap: {} },
    });

    const cmd = next.nodes.find((node) => node.id === 'occ-cmd-submit-order')!;
    expect(cmd.position).toEqual({ x: 440, y: -40 });
    const cmdLane = next.nodes.find((node) => node.id === 'lane:commandViewModel')!;
    expect({
      x: cmdLane.position.x + cmd.position.x,
      y: cmdLane.position.y + cmd.position.y,
    }).toEqual({ x: 400, y: 200 });
    expect(next.nodes.find((node) => node.id === 'frontier:left')?.position.x).toBe(304);
    expect(next.nodes.find((node) => node.id === 'frontier:right')?.position.x).toBe(672);
  });

  test('maps processor and trigger display roles to distinct node types', () => {
    const snapshot = {
      focusNodeId: 'returns.cmd.sync-return-status',
      projectName: 'Returns',
      truncation: {
        includeTruncatedPaths: false,
        hiddenPathCount: 0,
      },
      layoutState: {},
      occurrences: [
        {
          occurrenceId: 'occ-trigger-sync',
          canonicalNodeId: 'returns.trigger.daily-sync',
          nodeKind: 'shared',
          lane: 'shared',
          stageIndex: 0,
          rowIndex: 0,
          displayRole: 'trigger',
          branchClusterId: 'bwd_0',
          lockLevel: 'none',
          x: 0,
          y: 0,
          width: 220,
          height: 56,
        },
        {
          occurrenceId: 'occ-proc-api',
          canonicalNodeId: 'returns.proc.public-api',
          nodeKind: 'shared',
          lane: 'shared',
          stageIndex: 0,
          rowIndex: 1,
          displayRole: 'processor',
          branchClusterId: 'bwd_1',
          lockLevel: 'none',
          x: 0,
          y: 80,
          width: 220,
          height: 56,
        },
      ],
      renderedEdges: [],
      swimlaneRects: [
        { lane: 'shared', x: -40, y: -40, width: 700, height: 216 },
      ],
      laneDescriptors: [
        { id: 'shared', kind: 'shared', label: 'shared' },
      ],
      domainNodes: {
        'returns.trigger.daily-sync': {
          id: 'returns.trigger.daily-sync',
          projectId: 'returns',
          kind: 'trigger',
          canonicalId: 'returns.trigger.daily-sync',
          displayName: 'Daily Sync',
          tags: [],
          domains: [],
        },
        'returns.proc.public-api': {
          id: 'returns.proc.public-api',
          projectId: 'returns',
          kind: 'proc',
          canonicalId: 'returns.proc.public-api',
          displayName: 'Public API',
          tags: [],
          domains: [],
        },
      },
      domainEdges: {},
      laneMap: {},
    } as unknown as VisualizationSnapshot;

    const nodes = toReactFlowNodes(snapshot);

    expect(nodes.find((node) => node.id === 'occ-trigger-sync')?.type).toBe('em.trigger');
    expect(nodes.find((node) => node.id === 'occ-proc-api')?.type).toBe('em.proc');
  });

  test('maps diff overlay markers into React Flow node and edge data', () => {
    const snapshot = {
      focusNodeId: 'cmd.submit-order',
      projectName: 'Order Management',
      truncation: {
        includeTruncatedPaths: false,
        hiddenPathCount: 0,
      },
      layoutState: {},
      occurrences: [
        {
          occurrenceId: 'occ-cmd-submit',
          canonicalNodeId: 'cmd.submit-order',
          nodeKind: 'cmd',
          lane: 'commandViewModel',
          stageIndex: 0,
          rowIndex: 0,
          displayRole: 'command',
          branchClusterId: 'fwd_0',
          lockLevel: 'none',
          x: 0,
          y: 0,
          width: 220,
          height: 56,
        },
        {
          occurrenceId: 'occ-evt-submitted',
          canonicalNodeId: 'evt.order-submitted',
          nodeKind: 'evt',
          lane: 'event',
          stageIndex: 1,
          rowIndex: 0,
          displayRole: 'event',
          branchClusterId: 'fwd_0',
          lockLevel: 'none',
          x: 400,
          y: 200,
          width: 220,
          height: 56,
        },
      ],
      renderedEdges: [
        {
          displayEdgeId: 'de_1',
          fromOccurrenceId: 'occ-cmd-submit',
          toOccurrenceId: 'occ-evt-submitted',
          kind: 'cmd-to-evt',
          points: [],
          meta: { originalEdgeId: 'edge-cmd-to-evt' },
        },
      ],
      swimlaneRects: [
        { lane: 'commandViewModel', x: -40, y: -40, width: 700, height: 136 },
        { lane: 'event', x: -40, y: 160, width: 700, height: 136 },
      ],
      laneDescriptors: [],
      domainNodes: {
        'cmd.submit-order': {
          id: 'cmd.submit-order',
          projectId: 'orders',
          kind: 'cmd',
          canonicalId: 'cmd.submit-order',
          displayName: 'Submit Order',
          tags: [],
          domains: [],
        },
        'evt.order-submitted': {
          id: 'evt.order-submitted',
          projectId: 'orders',
          kind: 'evt',
          canonicalId: 'evt.order-submitted',
          displayName: 'Order Submitted',
          tags: [],
          domains: [],
        },
      },
      domainEdges: {},
      laneMap: {},
      diffOverlay: {
        nodesByCanonicalId: {
          'cmd.submit-order': { status: 'changed', changeIds: ['node:cmd.submit-order'] },
        },
        edgesById: {
          'edge-cmd-to-evt': { status: 'added', changeIds: ['edge:edge-cmd-to-evt'] },
        },
        visibleChanges: [],
        hiddenChanges: [],
        summary: { totalChanges: 2 },
      },
    } as VisualizationSnapshot;

    const nodes = toReactFlowNodes(snapshot);
    const edges = toReactFlowEdges(snapshot);

    expect(nodes.find((node) => node.id === 'occ-cmd-submit')?.data.diff).toEqual({
      status: 'changed',
      changeIds: ['node:cmd.submit-order'],
    });
    expect(edges.find((edge) => edge.id === 'de_1')?.data?.diff).toEqual({
      status: 'added',
      changeIds: ['edge:edge-cmd-to-evt'],
    });
    expect(edges.find((edge) => edge.id === 'de_1')?.markerEnd).toMatchObject({
      color: '#3d8b63',
    });
    expect(edges.find((edge) => edge.id === 'de_1')?.style).toMatchObject({
      stroke: '#3d8b63',
      strokeWidth: 3,
    });
  });

  test('creates dynamic role lane groups and parents role-owned occurrences to them', () => {
    const snapshot = {
      focusNodeId: 'ui.screen.return-portal',
      projectName: 'Returns',
      truncation: {
        includeTruncatedPaths: false,
        hiddenPathCount: 0,
      },
      layoutState: {},
      occurrences: [
        {
          occurrenceId: 'occ-buyer-portal',
          canonicalNodeId: 'ui.screen.return-portal',
          nodeKind: 'shared',
          lane: 'role:role.buyer',
          stageIndex: 0,
          rowIndex: 0,
          displayRole: 'ui',
          branchClusterId: 'fwd_0',
          lockLevel: 'none',
          x: 0,
          y: 0,
          width: 220,
          height: 56,
        },
        {
          occurrenceId: 'occ-request-return',
          canonicalNodeId: 'returns.cmd.request-return',
          nodeKind: 'cmd',
          lane: 'commandViewModel',
          stageIndex: 1,
          rowIndex: 0,
          displayRole: 'command',
          branchClusterId: 'fwd_0',
          lockLevel: 'none',
          x: 400,
          y: 200,
          width: 220,
          height: 56,
        },
      ],
      renderedEdges: [],
      swimlaneRects: [
        { lane: 'role:role.buyer', x: -40, y: -40, width: 700, height: 136 },
        { lane: 'commandViewModel', x: -40, y: 160, width: 700, height: 136 },
      ],
      laneDescriptors: [
        { id: 'role:role.buyer', kind: 'role', label: 'Buyer', sourceNodeId: 'role.buyer' },
        { id: 'commandViewModel', kind: 'commandViewModel', label: 'command / viewModel' },
      ],
      domainNodes: {
        'ui.screen.return-portal': {
          id: 'ui.screen.return-portal',
          projectId: 'returns',
          kind: 'ui.screen',
          canonicalId: 'ui.screen.return-portal',
          displayName: 'Return Portal',
          tags: [],
          domains: [],
        },
      },
      domainEdges: {},
      laneMap: {
        'role:role.buyer': 'Buyer',
        commandViewModel: 'command / viewModel',
      },
    } as VisualizationSnapshot;

    const nodes = toReactFlowNodes(snapshot);

    expect(nodes.find((node) => node.id === 'lane:role:role.buyer')?.data).toEqual({
      lane: 'role:role.buyer',
      label: 'Buyer',
    });
    expect(nodes.find((node) => node.id === 'occ-buyer-portal')?.parentId).toBe('lane:role:role.buyer');
  });

  test('applies a patch that introduces a role lane group', () => {
    const previousNodes = [
      { id: 'lane:commandViewModel', type: 'swimlaneGroup', position: { x: -40, y: 160 }, style: { width: 900, height: 136 }, data: { lane: 'commandViewModel', label: 'command / viewModel' } },
    ];
    const patch = {
      addedOccurrences: [
        {
          occurrenceId: 'occ-buyer-portal',
          canonicalNodeId: 'ui.screen.return-portal',
          nodeKind: 'shared',
          lane: 'role:role.buyer',
          stageIndex: 0,
          rowIndex: 0,
          displayRole: 'ui',
          branchClusterId: 'fwd_0',
          lockLevel: 'none',
          x: 0,
          y: 0,
          width: 220,
          height: 56,
        },
      ],
      updatedOccurrences: [],
      addedEdges: [],
      updatedEdges: [],
      updatedSwimlaneRects: [
        { lane: 'role:role.buyer', x: -40, y: -40, width: 700, height: 136 },
        { lane: 'commandViewModel', x: -40, y: 160, width: 700, height: 136 },
      ],
      updatedStageRange: { min: 0, max: 1 },
      viewportHint: {},
    } satisfies FixtureCompatiblePatch;

    const next = applyLayoutPatchToReactFlow({
      patch,
      previousNodes: previousNodes as Node[],
      previousEdges: [],
      snapshotContext: {
        domainNodes: {},
        laneMap: { 'role:role.buyer': 'Buyer' },
      },
    });

    expect(next.nodes.find((node) => node.id === 'lane:role:role.buyer')?.data).toEqual({
      lane: 'role:role.buyer',
      label: 'Buyer',
    });
    expect(next.nodes.find((node) => node.id === 'occ-buyer-portal')?.parentId).toBe('lane:role:role.buyer');
  });
});

function readJsonFence<T = unknown>(filePath: string): T {
  return JSON.parse(readCodeFence(filePath)) as T;
}

function readCodeFence(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/```(?:[^\n]*)\n([\s\S]*?)```/);
  if (!match?.[1]) throw new Error(`No code fence found in ${filePath}`);
  return match[1].replace(/\n$/, '');
}
