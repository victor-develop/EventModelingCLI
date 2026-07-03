import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { applyLayoutPatchToReactFlow } from './applyLayoutPatch';
import { toReactFlowEdges } from './toReactFlowEdges';
import { toReactFlowNodes } from './toReactFlowNodes';

const ROOT = path.resolve(__dirname, '../../../../__tests__/fixtures/xyflow-spec/04-xyflow-adapter-components');

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
    const previous = readJsonFence<{ nodes: any[]; edges: any[] }>(path.join(caseRoot, 'input-previous-react-flow-state.md'));
    const patch = readJsonFence<any>(path.join(caseRoot, 'input-layoutpatch.md'));
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
      patch: patch as any,
      previousNodes: previousNodes as any,
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
