import { Node, Edge, EdgeType, NodeKind } from '../domain/types';

export interface Graph {
  nodes: Map<string, Node>;
  edges: Map<string, Edge>;
  outgoing: Map<string, Edge[]>;
  incoming: Map<string, Edge[]>;
}

export function buildGraph(nodes: Node[], edges: Edge[]): Graph {
  const nodeMap = new Map<string, Node>();
  const edgeMap = new Map<string, Edge>();
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    if (n.canonicalId !== n.id) {
      nodeMap.set(n.canonicalId, n);
    }
  }

  for (const e of edges) {
    edgeMap.set(e.id, e);
    // Helper to add edge to a direction map without duplicates
    const addDirected = (map: Map<string, Edge[]>, key: string) => {
      const list = map.get(key) ?? [];
      if (!list.some(existing => existing.id === e.id)) {
        list.push(e);
      }
      map.set(key, list);
    };

    addDirected(outgoing, e.fromNodeId);
    const fromNode = nodeMap.get(e.fromNodeId);
    if (fromNode && fromNode.canonicalId !== e.fromNodeId) {
      addDirected(outgoing, fromNode.canonicalId);
    }

    addDirected(incoming, e.toNodeId);
    const toNode = nodeMap.get(e.toNodeId);
    if (toNode && toNode.canonicalId !== e.toNodeId) {
      addDirected(incoming, toNode.canonicalId);
    }
  }

  return { nodes: nodeMap, edges: edgeMap, outgoing, incoming };
}

export function resolveNodeId(graph: Graph, idOrCanonical: string): string | null {
  const node = graph.nodes.get(idOrCanonical);
  return node?.canonicalId ?? null;
}

export interface NeighborResult {
  edgeId: string;
  edgeType: EdgeType;
  direction: 'in' | 'out';
  nodeId: string;
  nodeKind: NodeKind;
}

export function getNeighbors(
  graph: Graph,
  nodeId: string,
  direction: 'in' | 'out' | 'both',
  edgeTypes?: EdgeType[],
  limit?: number,
): NeighborResult[] {
  const resolved = resolveNodeId(graph, nodeId);
  if (!resolved) return [];
  const results: NeighborResult[] = [];

  const addEdges = (edges: Edge[], dir: 'in' | 'out') => {
    for (const e of edges) {
      if (edgeTypes && !edgeTypes.includes(e.type)) continue;
      const targetId = dir === 'out' ? e.toNodeId : e.fromNodeId;
      const targetNode = graph.nodes.get(targetId);
      if (!targetNode) continue;
      results.push({
        edgeId: e.id,
        edgeType: e.type,
        direction: dir,
        nodeId: targetNode.canonicalId,
        nodeKind: targetNode.kind,
      });
      if (limit && results.length >= limit) return;
    }
  };

  if (direction === 'out' || direction === 'both') {
    addEdges(graph.outgoing.get(resolved) ?? [], 'out');
  }
  if (direction === 'in' || direction === 'both') {
    addEdges(graph.incoming.get(resolved) ?? [], 'in');
  }

  return results.slice(0, limit ?? results.length);
}

export interface WalkStep {
  nodeId?: string;
  nodeKind?: NodeKind;
  edgeId?: string;
  edgeType?: EdgeType;
  direction?: 'forward' | 'backward';
}

export interface WalkBranch {
  path: WalkStep[];
}

export function walkGraph(
  graph: Graph,
  fromNodeId: string,
  direction: 'forward' | 'backward' | 'both',
  edgeTypes?: EdgeType[],
  maxHops?: number,
  limit?: number,
): {
  branches: WalkBranch[];
  backwardBranches?: WalkBranch[];
  forwardBranches?: WalkBranch[];
  frontier: { hasMore: boolean; nextCursor?: string };
} {
  const resolved = resolveNodeId(graph, fromNodeId);
  if (!resolved) {
    return { branches: [], frontier: { hasMore: false } };
  }
  const hops = maxHops ?? 5;
  const lim = limit ?? 100;
  const hasMore = false;

  const walk = (startId: string, dir: 'forward' | 'backward'): WalkBranch[] => {
    const branches: WalkBranch[] = [];
    const visited = new Set<string>();
    const startNode = graph.nodes.get(startId);
    if (!startNode) return branches;

    const stack: { currentId: string; path: WalkStep[]; depth: number }[] = [
      { currentId: startId, path: [{ nodeId: startNode.canonicalId, nodeKind: startNode.kind }], depth: 0 },
    ];

    while (stack.length > 0 && branches.length < lim) {
      const { currentId, path, depth } = stack.pop()!;
      if (depth >= hops) {
        branches.push({ path });
        continue;
      }
      const resolvedCur = resolveNodeId(graph, currentId);
      if (!resolvedCur) continue;
      const edges =
        dir === 'forward'
          ? (graph.outgoing.get(resolvedCur) ?? [])
          : (graph.incoming.get(resolvedCur) ?? []);

      const filtered = edgeTypes ? edges.filter(e => edgeTypes.includes(e.type)) : edges;
      if (filtered.length === 0) {
        if (path.length > 1 || depth > 0) branches.push({ path });
        continue;
      }

      for (const edge of filtered) {
        const nextId = dir === 'forward' ? edge.toNodeId : edge.fromNodeId;
        const nextNode = graph.nodes.get(nextId);
        if (!nextNode) continue;
        const key = `${nextId}:${edge.id}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const newPath = [
          ...path,
          { edgeId: edge.id, edgeType: edge.type, direction: dir },
          { nodeId: nextNode.canonicalId, nodeKind: nextNode.kind },
        ];
        stack.push({ currentId: nextId, path: newPath, depth: depth + 1 });
      }
    }
    return branches;
  };

  if (direction === 'both') {
    const back = walk(resolved, 'backward');
    const fwd = walk(resolved, 'forward');
    return {
      branches: [...back, ...fwd],
      backwardBranches: back,
      forwardBranches: fwd,
      frontier: { hasMore },
    };
  }

  const branches = walk(resolved, direction as 'forward' | 'backward');
  return { branches, frontier: { hasMore } };
}

export function tracePath(
  graph: Graph,
  fromNodeId: string,
  toNodeId: string,
  maxHops?: number,
): string[][] {
  const from = resolveNodeId(graph, fromNodeId);
  const to = resolveNodeId(graph, toNodeId);
  if (!from || !to) return [];

  const hops = maxHops ?? 10;
  const paths: string[][] = [];
  const visited = new Set<string>();

  const dfs = (currentId: string, path: string[], depth: number) => {
    if (depth > hops) return;
    if (currentId === to) {
      paths.push([...path]);
      return;
    }
    const node = graph.nodes.get(currentId);
    const canonical = node?.canonicalId;
    const edges = graph.outgoing.get(currentId) ?? [];
    for (const edge of edges) {
      const key = `${edge.id}:${edge.toNodeId}`;
      if (visited.has(key)) continue;
      visited.add(key);
      dfs(edge.toNodeId, [...path, edge.id, edge.toNodeId], depth + 1);
      visited.delete(key);
    }
  };

  dfs(from, [from], 0);
  return paths.map(p => p.map(id => {
    const node = graph.nodes.get(id);
    return node?.canonicalId ?? id;
  }));
}

export function toMermaid(graph: Graph, focusNodeId?: string, depth?: number): string {
  const lines: string[] = ['graph TD'];
  const shown = new Set<string>();

  let focusEdges: Edge[];
  if (focusNodeId) {
    const resolved = resolveNodeId(graph, focusNodeId);
    if (resolved) {
      focusEdges = collectEdgesWithinDepth(graph, resolved, depth ?? 3);
    } else {
      focusEdges = [...graph.edges.values()];
    }
  } else {
    focusEdges = [...graph.edges.values()];
  }

  for (const edge of focusEdges) {
    const from = graph.nodes.get(edge.fromNodeId);
    const to = graph.nodes.get(edge.toNodeId);
    if (!from || !to) continue;
    const fromLabel = sanitizeMermaid(from.canonicalId);
    const toLabel = sanitizeMermaid(to.canonicalId);
    lines.push(`    ${fromLabel}[${from.canonicalId}] --> ${toLabel}[${to.canonicalId}]`);
    shown.add(from.canonicalId);
    shown.add(to.canonicalId);
  }

  if (lines.length === 1) lines.push('    empty[No nodes]');
  return lines.join('\n');
}

function collectEdgesWithinDepth(graph: Graph, startId: string, maxDepth: number): Edge[] {
  const edgeSet = new Set<string>();
  const result: Edge[] = [];
  const visited = new Set<string>();
  const queue: { nodeId: string; depth: number }[] = [{ nodeId: startId, depth: 0 }];

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const outEdges = graph.outgoing.get(nodeId) ?? [];
    const inEdges = graph.incoming.get(nodeId) ?? [];
    for (const e of [...outEdges, ...inEdges]) {
      if (!edgeSet.has(e.id)) {
        edgeSet.add(e.id);
        result.push(e);
      }
      if (depth < maxDepth) {
        const next = outEdges.includes(e) ? e.toNodeId : e.fromNodeId;
        const resolved = resolveNodeId(graph, next);
        if (resolved && !visited.has(resolved)) {
          queue.push({ nodeId: resolved, depth: depth + 1 });
        }
      }
    }
  }
  return result;
}

function sanitizeMermaid(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_');
}
