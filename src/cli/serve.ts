import express from 'express';
import cors from 'cors';
import type { Server } from 'node:http';
import { Workspace } from '../workspace/workspace';
import { buildGraph, walkGraph, findRoots } from '../graph/graph-builder';
import type { Edge, ModelSnapshot, Node } from '../domain/types';
import { EVENT_MODELING_EDGE_TYPES, toEventModelingEdges } from '../domain/event-modeling-edges';
import type { WalkBranch } from '../graph/graph-builder';
import { buildVisualizationSnapshot, VisualizationSnapshotError } from '../viewer-contract';
import type { SnapshotDirection } from '../viewer-contract';
import { resolveNodeLaneMap } from '../viewer-contract/laneAssignment';
import { buildSemanticDiff } from '../drafts/diff';
import {
  currentModelSnapshot,
  modelSnapshotForDraftGraph,
} from '../drafts/projection';
import { buildViewerDiffChanges } from '../drafts/viewer-diff';
import {
  draftContext,
  emptyModelSnapshot,
  resolveViewerProjection,
  withViewerProjectionContext,
  type ViewerProjection,
} from '../drafts/viewer-projection';

const activeServers: Server[] = [];
const activeKeepAlives: Array<ReturnType<typeof setInterval>> = [];

export function createServerApp(ws: Workspace): {
  app: express.Express;
  manifest: ReturnType<Workspace['getManifest']>;
  nodeCount: number;
  edgeCount: number;
} {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const manifest = ws.getManifest();
  if (!manifest) {
    console.error(`No active project. Run 'em project init' or 'em project open' first.`);
  }

  const initialModel = manifest ? currentModelSnapshot(ws) : emptyModelSnapshot();

  function collectNodes(branches: WalkBranch[], nodeMap: Map<string, Node>): Record<string, Node> {
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

  function collectEdges(branches: WalkBranch[], edgeMap: Map<string, Edge>): Record<string, Edge> {
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

  function laneMapForNodes(modelSnapshot: ModelSnapshot, nodeIds: Iterable<string>): Record<string, string> {
    const laneMap = resolveNodeLaneMap(buildGraph(modelSnapshot.nodes, modelSnapshot.edges));
    const result: Record<string, string> = {};
    for (const id of nodeIds) {
      const lane = laneMap.get(id);
      if (lane) result[id] = lane;
    }
    return result;
  }

  function sendNoProject(res: express.Response): void {
    res.status(400).json({
      error: {
        code: 'NO_PROJECT',
        message: 'No active project. Run em project init or em project open.',
      },
    });
  }

  app.get('/api/drafts', (_req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    const activeDraftId = ws.getContext()?.draft?.id ?? null;
    res.json({
      activeDraftId,
      drafts: ws.listDrafts().map(draft => ({
        id: draft.id,
        status: draft.status,
        baseRevisionId: draft.baseRevisionId,
        message: draft.message,
        isActive: draft.id === activeDraftId,
        summary: buildSemanticDiff(draft).summary,
      })),
    });
  });

  app.get('/api/drafts/:draftId/diff', (req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    const draft = ws.getDraft(req.params.draftId);
    if (!draft) {
      res.status(404).json({
        error: {
          code: 'DRAFT_NOT_FOUND',
          message: `Draft not found: ${req.params.draftId}`,
        },
      });
      return;
    }
    if (!draft.baseSnapshot) {
      res.status(400).json({
        error: {
          code: 'DRAFT_BASE_SNAPSHOT_MISSING',
          message: `Draft "${draft.id}" does not have a base model snapshot`,
        },
      });
      return;
    }

    const afterSnapshot = modelSnapshotForDraftGraph(draft, 'after');
    res.json({
      draft: draftContext(draft, 'compare', 'overlay'),
      diff: {
        summary: buildSemanticDiff(draft).summary,
        changes: buildViewerDiffChanges(draft.baseSnapshot, afterSnapshot).map(compactDiffChange),
      },
    });
  });

  app.get('/api/roots', (req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    let projection: ViewerProjection;
    try {
      projection = resolveViewerProjection(ws, viewerProjectionRequest(req));
    } catch (error) {
      sendVisualizationError(res, error);
      return;
    }

    const domainGraph = buildGraph(projection.modelSnapshot.nodes, projection.modelSnapshot.edges);
    const rootNodes = findRoots(domainGraph);
    const rootIds = rootNodes.map(r => r.canonicalId);
    res.json({
      roots: rootNodes.map(r => ({
        canonicalId: r.canonicalId,
        kind: r.kind,
        displayName: r.displayName,
      })),
      projectName: manifest.name,
      draft: projection.draft ? draftContext(projection.draft, projection.graph, projection.diff) : undefined,
      laneMap: laneMapForNodes(projection.modelSnapshot, rootIds),
      graphStats: {
        nodeCount: projection.modelSnapshot.nodes.length,
        edgeCount: projection.modelSnapshot.edges.length,
        eventModelingEdgeCount: toEventModelingEdges(projection.modelSnapshot.edges).length,
      },
    });
  });

  app.get('/api/init', (req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    const modelSnapshot = currentModelSnapshot(ws);
    const nodes = modelSnapshot.nodes;
    const edges = modelSnapshot.edges;
    const eventModelingEdges = toEventModelingEdges(edges);
    const eventModelingGraph = buildGraph(nodes, eventModelingEdges);
    const nodeMap = new Map(nodes.map(n => [n.canonicalId, n]));
    const edgeMap = new Map(edges.map(e => [e.id, e]));
    const focus = firstQueryValue(req.query.focus) || nodes[0]?.canonicalId || '';
    const result = walkGraph(eventModelingGraph, focus, 'both', EVENT_MODELING_EDGE_TYPES, 1);
    const collectedNodes = collectNodes(result.branches, nodeMap);

    res.json({
      focusNodeId: focus,
      projectName: manifest.name,
      branches: result.branches,
      nodes: collectedNodes,
      edges: collectEdges(result.branches, edgeMap),
      laneMap: laneMapForNodes(modelSnapshot, Object.keys(collectedNodes)),
    });
  });

  app.get('/api/layout', (req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    let projection: ViewerProjection;
    try {
      projection = resolveViewerProjection(ws, viewerProjectionRequest(req));
    } catch (error) {
      sendVisualizationError(res, error);
      return;
    }

    const focus = firstQueryValue(req.query.focus) || projection.modelSnapshot.nodes[0]?.canonicalId || '';
    const direction = (firstQueryValue(req.query.direction) || 'both') as SnapshotDirection;
    const hops = parseInt(firstQueryValue(req.query.hops) ?? '') || 2;
    const includeTruncatedPaths = parseBooleanQuery(req.query.includeTruncatedPaths);

    if (!focus) {
      res.status(400).json({
        error: {
          code: 'MISSING_FOCUS',
          message: 'focus query parameter is required',
        },
      });
      return;
    }

    try {
      const snapshot = buildVisualizationSnapshot({
        workspace: ws,
        modelSnapshot: projection.modelSnapshot,
        projectName: manifest.name,
        focus,
        direction,
        hops,
        includeTruncatedPaths,
      });
      res.json(withViewerProjectionContext(snapshot, projection, focus));
    } catch (error) {
      sendVisualizationError(res, error);
    }
  });

  app.get('/api/walk', (req, res) => {
    if (!manifest) {
      sendNoProject(res);
      return;
    }

    const modelSnapshot = currentModelSnapshot(ws);
    const nodes = modelSnapshot.nodes;
    const edges = modelSnapshot.edges;
    const eventModelingGraph = buildGraph(nodes, toEventModelingEdges(edges));
    const nodeMap = new Map(nodes.map(n => [n.canonicalId, n]));
    const edgeMap = new Map(edges.map(e => [e.id, e]));
    const from = firstQueryValue(req.query.from);
    const direction = (firstQueryValue(req.query.direction) as 'forward' | 'backward' | 'both') || 'forward';
    const hops = parseInt(firstQueryValue(req.query.hops) ?? '') || 3;

    if (!from) {
      res.status(400).json({ error: 'from query parameter is required' });
      return;
    }

    const result = walkGraph(eventModelingGraph, from, direction, EVENT_MODELING_EDGE_TYPES, hops);
    const collectedNodes = collectNodes(result.branches, nodeMap);

    res.json({
      fromNodeId: from,
      direction,
      hops,
      branches: result.branches,
      nodes: collectedNodes,
      edges: collectEdges(result.branches, edgeMap),
      laneMap: laneMapForNodes(modelSnapshot, Object.keys(collectedNodes)),
    });
  });

  return {
    app,
    manifest,
    nodeCount: initialModel.nodes.length,
    edgeCount: initialModel.edges.length,
  };
}

function parseBooleanQuery(value: unknown): boolean {
  if (Array.isArray(value)) return parseBooleanQuery(value[0]);
  return value === true || value === 'true' || value === '1';
}

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function viewerProjectionRequest(req: express.Request) {
  return {
    draftId: firstQueryValue(req.query.draft),
    graph: firstQueryValue(req.query.graph),
    diff: firstQueryValue(req.query.diff),
  };
}

function compactDiffChange(change: ReturnType<typeof buildViewerDiffChanges>[number]) {
  const { before, after, changedFields, fieldChanges, ...compact } = change;
  return compact;
}

function sendVisualizationError(res: express.Response, error: unknown): void {
  if (error instanceof VisualizationSnapshotError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown server error';
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}

export function startServer(ws: Workspace, opts: { port?: number } = {}) {
  const { app, manifest, nodeCount, edgeCount } = createServerApp(ws);

  const PORT = opts.port || parseInt(process.env.PORT || '5198');
  return new Promise<void>((resolve) => {
    const server = app.listen(PORT, () => {
      console.log(`em serve — http://localhost:${PORT}`);
      if (manifest) {
        console.log(`  Project: ${manifest.name} (${manifest.id})`);
      }
      console.log(`  Nodes: ${nodeCount}, Edges: ${edgeCount}`);
      console.log(`  GET /api/init?focus=<nodeId>`);
      console.log(`  GET /api/layout?focus=<nodeId>&direction=both&hops=2`);
      console.log(`  GET /api/roots`);
      console.log(`  GET /api/walk?from=<nodeId>&direction=forward|backward&hops=3`);
      resolve();
    });
    activeServers.push(server);
    activeKeepAlives.push(setInterval(() => undefined, 60 * 60 * 1000));
  });
}
