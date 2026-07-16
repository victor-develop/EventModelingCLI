import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Lock, RotateCcw, Unlock } from 'lucide-react';
import type { VisualizationSnapshot } from '@em/viewer-contract/types';
import { NODE_COLORS } from '../../types';
import { toReactFlowEdges, toReactFlowNodes } from '../adapter';
import { edgeTypes } from '../adapter/edgeTypes';
import { nodeTypes } from '../adapter/nodeTypes';
import { guardNodeChanges } from '../interaction/nodeChangeGuard';
import { nodeVisualKindFromType } from './nodeVisualKind';

interface XyflowCanvasProps {
  snapshot: VisualizationSnapshot;
  onOccurrenceLockChange?: (occurrenceId: string, lockLevel: 'hard' | 'none') => void;
  onOccurrenceReset?: (occurrenceId: string) => void;
  onExploreLeft?: () => void;
  onExploreRight?: () => void;
}

const FIT_VIEW_OPTIONS = { padding: 0.1 };
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 2;

type SelectionInfo =
  | { type: 'node'; id: string; title: string; subtitle: string; lockLevel: string }
  | { type: 'edge'; id: string; title: string; subtitle: string; lockLevel?: never };

export function XyflowCanvas({
  snapshot,
  onOccurrenceLockChange,
  onOccurrenceReset,
  onExploreLeft,
  onExploreRight,
}: XyflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <XyflowCanvasInner
        snapshot={snapshot}
        onOccurrenceLockChange={onOccurrenceLockChange}
        onOccurrenceReset={onOccurrenceReset}
        onExploreLeft={onExploreLeft}
        onExploreRight={onExploreRight}
      />
    </ReactFlowProvider>
  );
}

function XyflowCanvasInner({
  snapshot,
  onOccurrenceLockChange,
  onOccurrenceReset,
  onExploreLeft,
  onExploreRight,
}: XyflowCanvasProps) {
  const [nodes, setNodes] = useState<Node[]>(() => toReactFlowNodes(snapshot, { includeFrontierHandles: true }));
  const [edges, setEdges] = useState<Edge[]>(() => toReactFlowEdges(snapshot));
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const baselinePositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const flowReadyRef = useRef(false);
  const reactFlow = useReactFlow<Node, Edge>();

  const fitSnapshotView = useCallback(() => {
    window.requestAnimationFrame(() => {
      if (!flowReadyRef.current) return;
      void reactFlow.fitView(FIT_VIEW_OPTIONS);
    });
  }, [reactFlow]);

  const resetBaseline = useCallback((nextNodes: Node[]) => {
    baselinePositionsRef.current = new Map(nextNodes.map((node) => [node.id, { ...node.position }]));
  }, []);

  useEffect(() => {
    const nextNodes = toReactFlowNodes(snapshot, { includeFrontierHandles: true });
    const nextEdges = toReactFlowEdges(snapshot);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- React Flow controlled state must be reset when a new snapshot arrives.
    setNodes(nextNodes);
    setEdges(nextEdges);
    setSelection(null);
    resetBaseline(nextNodes);
    fitSnapshotView();
  }, [snapshot, resetBaseline, fitSnapshotView]);

  const onInit = useCallback((instance: ReactFlowInstance<Node, Edge>) => {
    flowReadyRef.current = true;
    void instance.fitView(FIT_VIEW_OPTIONS);
  }, []);

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
    return NODE_COLORS[nodeVisualKindFromType(node.type)] ?? NODE_COLORS.shared;
  }, []);

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
        onInit={onInit}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
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
