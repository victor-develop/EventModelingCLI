import { buildGraph, resolveNodeId } from '../graph/graph-builder';
import { toEventModelingEdges } from '../domain/event-modeling-edges';
import type { LayoutState } from '../layout/types';
import { LayoutEngine } from '../layout/layout-engine';
import type { Workspace } from '../workspace/workspace';
import {
  createLaneDescriptors,
  createLaneDescriptorsFromOccurrences,
  createVisibleLaneMap,
} from './lanePolicy';
import {
  computeVisibleSwimlaneRects,
  normalizeOccurrencesForViewer,
  normalizeRenderedEdgesForViewer,
} from './normalize';
import {
  buildWalkEnvelope,
  collectDomainEdges,
  collectDomainNodes,
} from './envelope';
import { resolveNodeLaneMap } from './laneAssignment';
import type { SnapshotDirection, VisualizationSnapshot } from './types';
import { VisualizationSnapshotError } from './types';

export function buildVisualizationSnapshot(args: {
  workspace: Workspace;
  focus: string;
  direction?: SnapshotDirection;
  hops?: number;
}): VisualizationSnapshot {
  const manifest = args.workspace.getManifest();
  if (!manifest) {
    throw new VisualizationSnapshotError(
      'NO_PROJECT',
      'No active project. Run em project init or em project open.',
      400,
    );
  }

  const nodes = args.workspace.listNodes();
  const edges = args.workspace.listEdges();
  const allDomainNodes = Object.fromEntries(nodes.map((node) => [node.canonicalId, node]));
  const domainGraph = buildGraph(nodes, edges);
  const graph = buildGraph(nodes, toEventModelingEdges(edges));
  const nodeLaneMap = resolveNodeLaneMap(domainGraph);
  const resolvedFocus = resolveNodeId(domainGraph, args.focus);
  if (!resolvedFocus) {
    throw new VisualizationSnapshotError(
      'NOT_FOUND',
      `Focus node not found: ${args.focus}`,
      404,
      { focus: args.focus },
    );
  }

  const direction = args.direction ?? 'both';
  const hops = args.hops ?? 2;
  const envelope = buildWalkEnvelope({
    graph,
    focusNodeId: resolvedFocus,
    direction,
    hops,
    laneMap: nodeLaneMap,
  });

  if (envelope.branches.length === 0) {
    const emptyLayoutState = createEmptyLayoutState();
    const laneDescriptors = createLaneDescriptors({ lanes: [], domainNodes: allDomainNodes });
    return {
      focusNodeId: resolvedFocus,
      projectName: manifest.name,
      layoutState: emptyLayoutState,
      occurrences: [],
      renderedEdges: [],
      swimlaneRects: computeVisibleSwimlaneRects([]),
      laneDescriptors,
      domainNodes: collectDomainNodes({ envelope, graph: domainGraph, focusNodeId: resolvedFocus }),
      domainEdges: {},
      laneMap: createVisibleLaneMap(laneDescriptors),
    };
  }

  const engine = new LayoutEngine();
  const layoutState = engine.initLayout(envelope);
  const coreOccurrences = Object.values(layoutState.occurrences);
  const coreEdges = Object.values(layoutState.displayEdges);
  const occurrences = normalizeOccurrencesForViewer(coreOccurrences);
  const laneDescriptors = createLaneDescriptorsFromOccurrences(occurrences, allDomainNodes);

  return {
    focusNodeId: resolvedFocus,
    projectName: manifest.name,
    layoutState,
    occurrences,
    renderedEdges: normalizeRenderedEdgesForViewer(coreEdges),
    swimlaneRects: computeVisibleSwimlaneRects(coreOccurrences),
    laneDescriptors,
    domainNodes: collectDomainNodes({ envelope, graph: domainGraph, focusNodeId: resolvedFocus }),
    domainEdges: collectDomainEdges({ envelope, graph: domainGraph }),
    laneMap: createVisibleLaneMap(laneDescriptors),
  };
}

function createEmptyLayoutState(): LayoutState {
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
