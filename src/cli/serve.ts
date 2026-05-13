import express from 'express';
import cors from 'cors';
import { Workspace } from '../workspace/workspace';
import { buildGraph, walkGraph, findRoots, resolveLaneMap } from '../graph/graph-builder';
import type { Node, Edge } from '../domain/types';
import type { WalkBranch } from '../graph/graph-builder';

export function startServer(ws: Workspace, opts: { port?: number } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const manifest = ws.getManifest();
  if (!manifest) {
    console.error(`No active project. Run 'em project init' or 'em project open' first.`);
    process.exit(1);
  }

  const nodes = ws.listNodes();
  const edges = ws.listEdges();
  const graph = buildGraph(nodes, edges);

  const laneMap = resolveLaneMap(graph);

  const nodeMap = new Map<string, Node>();
  for (const n of nodes) nodeMap.set(n.canonicalId, n);

  const edgeMap = new Map<string, Edge>();
  for (const e of edges) edgeMap.set(e.id, e);

  function collectNodes(branches: WalkBranch[]): Record<string, Node> {
    const ids = new Set<string>();
    for (const b of branches) {
      for (const s of b.path) {
        if (s.nodeId) ids.add(s.nodeId);
      }
    }
    const result: Record<string, Node> = {};
    for (const id of ids) {
      const n = nodeMap.get(id);
      if (n) result[n.canonicalId] = n;
    }
    return result;
  }

  function collectEdges(branches: WalkBranch[]): Record<string, Edge> {
    const ids = new Set<string>();
    for (const b of branches) {
      for (const s of b.path) {
        if (s.edgeId) ids.add(s.edgeId);
      }
    }
    const result: Record<string, Edge> = {};
    for (const id of ids) {
      const e = edgeMap.get(id);
      if (e) result[e.id] = e;
    }
    return result;
  }

  function laneMapForNodes(nodeIds: Iterable<string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const id of nodeIds) {
      const lane = laneMap.get(id);
      if (lane) result[id] = lane;
    }
    return result;
  }

  app.get('/api/roots', (_req, res) => {
    const rootNodes = findRoots(graph);
    const rootIds = rootNodes.map(r => r.canonicalId);
    res.json({
      roots: rootNodes.map(r => ({
        canonicalId: r.canonicalId,
        kind: r.kind,
        displayName: r.displayName,
      })),
      projectName: manifest.name,
      laneMap: laneMapForNodes(rootIds),
    });
  });

  app.get('/api/init', (req, res) => {
    const focus = (req.query.focus as string) || nodes[0]?.canonicalId || '';
    const result = walkGraph(graph, focus, 'both', undefined, 1);
    const collectedNodes = collectNodes(result.branches);

    res.json({
      focusNodeId: focus,
      projectName: manifest.name,
      branches: result.branches,
      nodes: collectedNodes,
      edges: collectEdges(result.branches),
      laneMap: laneMapForNodes(Object.keys(collectedNodes)),
    });
  });

  app.get('/api/walk', (req, res) => {
    const from = req.query.from as string;
    const direction = (req.query.direction as 'forward' | 'backward' | 'both') || 'forward';
    const hops = parseInt(req.query.hops as string) || 3;

    if (!from) {
      res.status(400).json({ error: 'from query parameter is required' });
      return;
    }

    const result = walkGraph(graph, from, direction, undefined, hops);
    const collectedNodes = collectNodes(result.branches);

    res.json({
      fromNodeId: from,
      direction,
      hops,
      branches: result.branches,
      nodes: collectedNodes,
      edges: collectEdges(result.branches),
      laneMap: laneMapForNodes(Object.keys(collectedNodes)),
    });
  });

  const PORT = opts.port || parseInt(process.env.PORT || '5198');
  return new Promise<void>((resolve) => {
    app.listen(PORT, () => {
      console.log(`em serve — http://localhost:${PORT}`);
      console.log(`  Project: ${manifest.name} (${manifest.id})`);
      console.log(`  Nodes: ${nodes.length}, Edges: ${edges.length}`);
    console.log(`  GET /api/init?focus=<nodeId>`);
    console.log(`  GET /api/roots`);
    console.log(`  GET /api/walk?from=<nodeId>&direction=forward|backward&hops=3`);
    });
  });
}
