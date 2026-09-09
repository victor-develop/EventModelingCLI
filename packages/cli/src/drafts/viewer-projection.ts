import { buildGraph, resolveNodeId } from '../graph/graph-builder';
import type { Draft, ModelSnapshot } from '../domain/types';
import type { Workspace } from '../workspace/workspace';
import { VisualizationSnapshotError } from '../viewer-contract';
import type {
  FocusResolution,
  SnapshotDiffMode,
  SnapshotGraphMode,
  VisualizationSnapshot,
} from '../viewer-contract';
import {
  currentModelSnapshot,
  mergeBaseAndAfterForCompare,
  modelSnapshotForDraftGraph,
} from './projection';
import { buildDiffOverlayForSnapshot } from './viewer-diff';

export interface ViewerProjectionRequest {
  draftId?: string;
  graph?: string;
  diff?: string;
}

export interface ViewerProjection {
  modelSnapshot: ModelSnapshot;
  graph: SnapshotGraphMode;
  diff: SnapshotDiffMode;
  draft?: Draft;
  baseSnapshot?: ModelSnapshot;
  afterSnapshot?: ModelSnapshot;
}

export function resolveViewerProjection(ws: Workspace, request: ViewerProjectionRequest): ViewerProjection {
  const draft = resolveRequestedDraft(ws, request.draftId);
  const graph = parseGraphMode(request.graph, Boolean(draft));
  const diff = parseDiffMode(request.diff, Boolean(draft));

  if (!draft) {
    return {
      modelSnapshot: currentModelSnapshot(ws),
      graph: 'current',
      diff: 'off',
    };
  }

  if (!draft.baseSnapshot) {
    throw new VisualizationSnapshotError(
      'DRAFT_BASE_SNAPSHOT_MISSING',
      `Draft "${draft.id}" does not have a base model snapshot`,
      400,
      { draftId: draft.id },
    );
  }

  const baseSnapshot = modelSnapshotForDraftGraph(draft, 'base');
  const afterSnapshot = modelSnapshotForDraftGraph(draft, 'after');
  const modelSnapshot = graph === 'base'
    ? baseSnapshot
    : graph === 'after'
      ? afterSnapshot
      : mergeBaseAndAfterForCompare(baseSnapshot, afterSnapshot);

  return {
    modelSnapshot,
    graph,
    diff,
    draft,
    baseSnapshot,
    afterSnapshot,
  };
}

export function withViewerProjectionContext(
  snapshot: VisualizationSnapshot,
  projection: ViewerProjection,
  requestedFocus: string,
): VisualizationSnapshot {
  let next: VisualizationSnapshot = {
    ...snapshot,
    focusResolution: focusResolutionFor(projection, requestedFocus),
  };

  if (projection.draft) {
    next = {
      ...next,
      draft: draftContext(projection.draft, projection.graph, projection.diff),
    };
  }

  if (
    projection.draft &&
    projection.diff === 'overlay' &&
    projection.baseSnapshot &&
    projection.afterSnapshot
  ) {
    next = {
      ...next,
      diffOverlay: buildDiffOverlayForSnapshot({
        baseSnapshot: projection.baseSnapshot,
        afterSnapshot: projection.afterSnapshot,
        snapshot: next,
      }),
    };
  }

  return next;
}

export function draftContext(draft: Draft, graph: SnapshotGraphMode, diff: SnapshotDiffMode) {
  return {
    id: draft.id,
    status: draft.status,
    baseRevisionId: draft.baseRevisionId,
    message: draft.message,
    graph,
    diff,
  };
}

export function emptyModelSnapshot(): ModelSnapshot {
  return {
    nodes: [],
    edges: [],
    commandSchemas: [],
    eventSchemas: [],
    viewModelSchemas: [],
    proposals: [],
  };
}

function resolveRequestedDraft(ws: Workspace, draftId: string | undefined): Draft | undefined {
  if (!draftId) return undefined;
  if (draftId === 'active') {
    const activeDraft = ws.getContext()?.draft;
    if (activeDraft) return activeDraft;
    const openDraft = ws.listDrafts().find(draft => draft.status === 'open');
    if (openDraft) return openDraft;
    throw new VisualizationSnapshotError('DRAFT_NOT_FOUND', 'No active draft found', 404, { draft: draftId });
  }
  const draft = ws.getDraft(draftId);
  if (!draft) {
    throw new VisualizationSnapshotError('DRAFT_NOT_FOUND', `Draft not found: ${draftId}`, 404, { draft: draftId });
  }
  return draft;
}

function parseGraphMode(value: string | undefined, hasDraft: boolean): SnapshotGraphMode {
  if (!hasDraft) return 'current';
  if (value === 'base' || value === 'after' || value === 'compare') return value;
  return 'compare';
}

function parseDiffMode(value: string | undefined, hasDraft: boolean): SnapshotDiffMode {
  if (!hasDraft) return 'off';
  return value === 'off' ? 'off' : 'overlay';
}

function focusResolutionFor(projection: ViewerProjection, requestedFocus: string): FocusResolution {
  if (!projection.draft || !projection.baseSnapshot || !projection.afterSnapshot) {
    return {
      requestedFocus,
      resolvedFocus: resolveNodeId(buildGraph(projection.modelSnapshot.nodes, projection.modelSnapshot.edges), requestedFocus) ?? undefined,
      availability: 'current',
    };
  }

  const baseGraph = buildGraph(projection.baseSnapshot.nodes, projection.baseSnapshot.edges);
  const afterGraph = buildGraph(projection.afterSnapshot.nodes, projection.afterSnapshot.edges);
  const baseResolved = resolveNodeId(baseGraph, requestedFocus);
  const afterResolved = resolveNodeId(afterGraph, requestedFocus);
  const availability = baseResolved && afterResolved
    ? 'both'
    : baseResolved
      ? 'baseOnly'
      : afterResolved
        ? 'afterOnly'
        : 'missing';

  return {
    requestedFocus,
    resolvedFocus: afterResolved ?? baseResolved ?? undefined,
    availability,
  };
}
