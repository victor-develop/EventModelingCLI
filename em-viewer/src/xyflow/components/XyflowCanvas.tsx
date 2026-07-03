import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { Lock, RotateCcw, Unlock } from 'lucide-react';
import type { LayoutPatch } from '@em/layout/types';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { applyLayoutPatchToReactFlow, toReactFlowEdges, toReactFlowNodes } from '../adapter';
import { edgeTypes } from '../adapter/edgeTypes';
import { nodeTypes } from '../adapter/nodeTypes';
import type { SnapshotContext } from '../adapter/types';
import { guardNodeChanges } from '../interaction/nodeChangeGuard';

interface XyflowCanvasProps {
  snapshot: VisualizationSnapshot;
  patch?: LayoutPatch | null;
  snapshotContext: SnapshotContext;
  onOccurrenceLockChange?: (occurrenceId: string, lockLevel: 'hard' | 'none') => void;
  onOccurrenceReset?: (occurrenceId: string) => void;
  onExploreLeft?: () => void;
  onExploreRight?: () => void;
}

type SelectionInfo =
  | { type: 'node'; id: string; title: string; subtitle: string; lockLevel: string }
  | { type: 'edge'; id: string; title: string; subtitle: string; lockLevel?: never };

export function XyflowCanvas({
  snapshot,
  patch,
  snapshotContext,
  onOccurrenceLockChange,
  onOccurrenceReset,
  onExploreLeft,
  onExploreRight,
}: XyflowCanvasProps) {
  const [nodes, setNodes] = useState<Node[]>(() => toReactFlowNodes(snapshot, { includeFrontierHandles: true }));
  const [edges, setEdges] = useState<Edge[]>(() => toReactFlowEdges(snapshot));
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const baselinePositionsRef = useRef(new Map<string, { x: number; y: number }>());

  const resetBaseline = useCallback((nextNodes: Node[]) => {
    baselinePositionsRef.current = new Map(nextNodes.map((node) => [node.id, { ...node.position }]));
  }, []);

  useEffect(() => {
    const nextNodes = toReactFlowNodes(snapshot, { includeFrontierHandles: true });
    const nextEdges = toReactFlowEdges(snapshot);
    setNodes(nextNodes);
    setEdges(nextEdges);
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setSelection(null);
    resetBaseline(nextNodes);
  }, [snapshot, resetBaseline]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    if (!patch) return;
    const next = applyLayoutPatchToReactFlow({
      patch,
      previousNodes: nodesRef.current,
      previousEdges: edgesRef.current,
      snapshotContext,
    });
    setNodes(next.nodes);
    setEdges(next.edges);
    nodesRef.current = next.nodes;
    edgesRef.current = next.edges;
    resetBaseline(next.nodes);
  }, [patch, snapshotContext, resetBaseline]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => {
      const guarded = guardNodeChanges({ changes, nodes: currentNodes });
      return applyNodeChanges(guarded.changes, currentNodes);
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const node = params.nodes[0];
    if (node) {
      const data = node.data as { label?: string; canonicalNodeId?: string; lockLevel?: string };
      setSelection({
        type: 'node',
        id: node.id,
        title: data.label ?? node.id,
        subtitle: data.canonicalNodeId ?? node.id,
        lockLevel: data.lockLevel ?? 'none',
      });
      return;
    }

    const edge = params.edges[0];
    if (edge) {
      const data = edge.data as { kind?: string } | undefined;
      setSelection({
        type: 'edge',
        id: edge.id,
        title: edge.id,
        subtitle: data?.kind ?? 'edge',
      });
      return;
    }

    setSelection(null);
  }, []);

  const onNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    if (node.type !== 'frontierHandle') return;
    const direction = (node.data as { direction?: string }).direction;
    if (direction === 'left') onExploreLeft?.();
    if (direction === 'right') onExploreRight?.();
  }, [onExploreLeft, onExploreRight]);

  const lockSelectedNode = useCallback((lockLevel: 'hard' | 'none') => {
    if (selection?.type !== 'node') return;
    setNodes((currentNodes) => currentNodes.map((node) => {
      if (node.id !== selection.id) return node;
      return {
        ...node,
        draggable: lockLevel !== 'hard',
        data: { ...node.data, lockLevel },
      };
    }));
    onOccurrenceLockChange?.(selection.id, lockLevel);
    setSelection((current) => current?.type === 'node' ? { ...current, lockLevel } : current);
  }, [selection, onOccurrenceLockChange]);

  const resetSelectedNode = useCallback(() => {
    if (selection?.type !== 'node') return;
    const baseline = baselinePositionsRef.current.get(selection.id);
    if (!baseline) return;
    setNodes((currentNodes) => currentNodes.map((node) => (
      node.id === selection.id ? { ...node, position: { ...baseline } } : node
    )));
    onOccurrenceReset?.(selection.id);
  }, [selection, onOccurrenceReset]);

  const minimapNodeColor = useCallback((node: Node) => {
    if (node.id.startsWith('lane:')) return '#e7e2d4';
    const lane = (node.data as { visibleLane?: string } | undefined)?.visibleLane;
    if (lane === 'event') return '#b86b4b';
    if (lane === 'commandViewModel') return '#2f6f73';
    return '#8c6f3d';
  }, []);

  const fitViewOptions = useMemo(() => ({ padding: 0.18 }), []);

  return (
    <main className="xyflow-shell" aria-label="Event modeling canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={fitViewOptions}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} color="#d8d0bf" />
        <Controls position="bottom-left" />
        <MiniMap nodeColor={minimapNodeColor} pannable zoomable />
      </ReactFlow>
      <SelectionInspector
        selection={selection}
        onLock={() => lockSelectedNode('hard')}
        onUnlock={() => lockSelectedNode('none')}
        onReset={resetSelectedNode}
      />
    </main>
  );
}

function SelectionInspector({
  selection,
  onLock,
  onUnlock,
  onReset,
}: {
  selection: SelectionInfo | null;
  onLock: () => void;
  onUnlock: () => void;
  onReset: () => void;
}) {
  if (!selection) return null;

  return (
    <aside className="selection-inspector" aria-label="Selection inspector">
      <div>
        <div className="inspector-kicker">{selection.type}</div>
        <h2>{selection.title}</h2>
        <p>{selection.subtitle}</p>
      </div>
      {selection.type === 'node' && (
        <div className="inspector-actions">
          {selection.lockLevel === 'hard' ? (
            <button type="button" onClick={onUnlock} aria-label="Unlock node">
              <Unlock size={16} />
              Unlock
            </button>
          ) : (
            <button type="button" onClick={onLock} aria-label="Lock node">
              <Lock size={16} />
              Lock
            </button>
          )}
          <button type="button" onClick={onReset} aria-label="Reset node position">
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      )}
    </aside>
  );
}
