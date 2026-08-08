import * as http from 'node:http';
import type { Server } from 'node:http';
import type { Draft, Edge, Node } from '../src/domain/types';
import { createServerApp } from '../src/cli/serve';
import { currentModelSnapshot } from '../src/drafts/projection';
import { createOrderWorkspace } from './helpers/order-workspace';

describe('/api/layout', () => {
  let server: Server | undefined;

  afterEach((done) => {
    if (!server) {
      done();
      return;
    }
    server.close(() => {
      server = undefined;
      done();
    });
  });

  test('returns a VisualizationSnapshot', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/layout?focus=cmd.submit-order&direction=both&hops=2');

      expect(body.status).toBe(200);
      expect(body.json.focusNodeId).toBe('cmd.submit-order');
      expect(body.json.projectName).toBe('Order Management');
      expect(body.json.truncation).toEqual({
        includeTruncatedPaths: false,
        hiddenPathCount: 0,
      });
      expect(Array.isArray(body.json.occurrences)).toBe(true);
      expect(Array.isArray(body.json.renderedEdges)).toBe(true);
      expect(body.json.laneMap).toEqual({
        shared: 'shared',
        commandViewModel: 'command / viewModel',
        event: 'event',
      });
    } finally {
      cleanup();
    }
  });

  test('passes includeTruncatedPaths to the layout contract', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/layout?focus=cmd.submit-order&direction=both&hops=2&includeTruncatedPaths=true');

      expect(body.status).toBe(200);
      expect(body.json.truncation.includeTruncatedPaths).toBe(true);
    } finally {
      cleanup();
    }
  });

  test('/api/roots returns graph stats for dynamic viewer controls', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/roots');

      expect(body.status).toBe(200);
      expect(body.json.graphStats).toEqual({
        nodeCount: 5,
        edgeCount: 4,
        eventModelingEdgeCount: 4,
      });
    } finally {
      cleanup();
    }
  });

  test('/api/drafts and draft diff expose viewer-safe draft summaries', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const draft = saveViewerDraft(workspace);
      const { app } = createServerApp(workspace);
      server = app.listen(0);

      const draftsBody = await getJson(server, '/api/drafts');
      expect(draftsBody.status).toBe(200);
      expect(draftsBody.json.activeDraftId).toBe(draft.id);
      expect(draftsBody.json.drafts[0]).toMatchObject({
        id: draft.id,
        status: 'open',
        isActive: true,
      });

      const diffBody = await getJson(server, `/api/drafts/${draft.id}/diff`);
      expect(diffBody.status).toBe(200);
      expect(diffBody.json.draft).toMatchObject({
        id: draft.id,
        graph: 'compare',
        diff: 'overlay',
      });
      expect(diffBody.json.diff.changes.map((change: any) => change.status).sort()).toEqual([
        'added',
        'added',
        'changed',
        'changed',
        'removed',
        'removed',
      ]);
      expect(JSON.stringify(diffBody.json)).not.toContain('before');
      expect(JSON.stringify(diffBody.json)).not.toContain('after');
    } finally {
      cleanup();
    }
  });

  test('/api/drafts/:draftId/impact exposes the shared draft-wide impact result', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const draft = saveViewerDraft(workspace);
      const { app } = createServerApp(workspace);
      server = app.listen(0);

      const body = await getJson(server, `/api/drafts/${draft.id}/impact`);

      expect(body.status).toBe(200);
      expect(body.json.draft).toMatchObject({ id: draft.id, graph: 'compare', diff: 'overlay' });
      expect(body.json.impact).toMatchObject({
        draftId: draft.id,
        baseRevisionId: 'rev_000',
        seeds: expect.any(Array),
        affectedNodes: expect.any(Object),
        affectedEdges: expect.any(Array),
        schemaImpacts: expect.any(Array),
        compatibilityWarnings: expect.any(Array),
        summary: expect.any(Object),
        warnings: expect.any(Array),
      });
      expect(body.json.impact.seeds.map((seed: any) => seed.id)).toContain('node:removed:ui.pay-order-action');
    } finally {
      cleanup();
    }
  });

  test('/api/layout renders draft compare overlay without changing layout contract shape', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const draft = saveViewerDraft(workspace);
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, `/api/layout?focus=cmd.submit-order&direction=forward&hops=4&draft=${draft.id}&graph=compare&diff=overlay`);

      expect(body.status).toBe(200);
      expect(body.json.draft).toMatchObject({
        id: draft.id,
        graph: 'compare',
        diff: 'overlay',
      });
      expect(body.json.focusResolution).toMatchObject({
        requestedFocus: 'cmd.submit-order',
        availability: 'both',
      });
      expect(body.json.diffOverlay.nodesByCanonicalId['vm.order-detail'].status).toBe('changed');
      expect(body.json.diffOverlay.nodesByCanonicalId['ui.order-confirmation'].status).toBe('added');
      expect(body.json.diffOverlay.nodesByCanonicalId['ui.pay-order-action'].status).toBe('removed');
      expect(body.json.diffOverlay.edgesById['edge-evt-to-vm'].status).toBe('changed');
      expect(body.json.diffOverlay.edgesById['edge-vm-to-confirmation'].status).toBe('added');
      expect(body.json.diffOverlay.edgesById['edge-vm-to-pay'].status).toBe('removed');
      expect(body.json.diffOverlay.visibleChanges.length).toBeGreaterThan(0);
      const changedNode = body.json.diffOverlay.visibleChanges.find((change: any) => change.id === 'node:vm.order-detail');
      expect(changedNode).toMatchObject({
        status: 'changed',
        entityType: 'node',
        changedFields: ['displayName'],
        fieldChanges: [
          {
            path: 'displayName',
            status: 'changed',
            before: 'Order Detail',
            after: 'Order Detail Draft',
          },
        ],
      });
      expect(changedNode.before.displayName).toBe('Order Detail');
      expect(changedNode.after.displayName).toBe('Order Detail Draft');
      const changedEdge = body.json.diffOverlay.visibleChanges.find((change: any) => change.id === 'edge:edge-evt-to-vm');
      expect(changedEdge).toMatchObject({
        status: 'changed',
        entityType: 'edge',
        changedFields: ['meta.apiKey', 'meta.fieldRefs[0]'],
        fieldChanges: [
          {
            path: 'meta.apiKey',
            status: 'added',
            after: '[REDACTED]',
          },
          {
            path: 'meta.fieldRefs[0]',
            status: 'added',
            after: 'orderId',
          },
        ],
      });
      expect(changedEdge.after.meta.apiKey).toBe('[REDACTED]');
      expect(body.json.domainEdges['edge-evt-to-vm'].meta.apiKey).toBe('[REDACTED]');
      expect(JSON.stringify(body.json)).not.toContain('secret-value');
    } finally {
      cleanup();
    }
  });

  test('/api/layout compare mode accepts a removed base-only focus', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const draft = saveViewerDraft(workspace);
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, `/api/layout?focus=ui.pay-order-action&direction=backward&hops=4&draft=${draft.id}&graph=compare&diff=overlay`);

      expect(body.status).toBe(200);
      expect(body.json.focusNodeId).toBe('ui.pay-order-action');
      expect(body.json.focusResolution).toMatchObject({
        requestedFocus: 'ui.pay-order-action',
        resolvedFocus: 'ui.pay-order-action',
        availability: 'baseOnly',
      });
      expect(body.json.diffOverlay.nodesByCanonicalId['ui.pay-order-action'].status).toBe('removed');
    } finally {
      cleanup();
    }
  });

  test('/api/layout base overlay does not mark after-only edges as visible', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const draft = saveViewerDraft(workspace);
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, `/api/layout?focus=cmd.submit-order&direction=forward&hops=4&draft=${draft.id}&graph=base&diff=overlay`);

      expect(body.status).toBe(200);
      const visibleChangeIds = body.json.diffOverlay.visibleChanges.map((change: any) => change.id);
      const hiddenChangeIds = body.json.diffOverlay.hiddenChanges.map((change: any) => change.id);
      expect(visibleChangeIds).not.toContain('edge:edge-vm-to-confirmation');
      expect(hiddenChangeIds).toContain('edge:edge-vm-to-confirmation');
    } finally {
      cleanup();
    }
  });

  test('returns structured NOT_FOUND errors', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/layout?focus=cmd.missing&direction=both&hops=2');

      expect(body.status).toBe(404);
      expect(body.json).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Focus node not found: cmd.missing',
          details: { focus: 'cmd.missing' },
        },
      });
    } finally {
      cleanup();
    }
  });

  test('/api/walk returns only event-modeling edges by default', async () => {
    const { workspace, cleanup } = createOrderWorkspace();
    try {
      const projectId = workspace.getManifest()!.id;
      workspace.saveNode(node(projectId, 'ui.checkout.summary', 'ui.section', 'Checkout Summary'));
      workspace.saveEdge(edge(projectId, 'edge-ui-parent', 'parentOf', 'ui.checkout', 'ui.checkout.summary'));

      const { app } = createServerApp(workspace);
      server = app.listen(0);
      const body = await getJson(server, '/api/walk?from=ui.checkout&direction=forward&hops=1');

      expect(body.status).toBe(200);
      expect(Object.values(body.json.edges).map((item: any) => item.type)).toEqual(['roleIssuesCommand']);
      expect(Object.keys(body.json.nodes)).not.toContain('ui.checkout.summary');
    } finally {
      cleanup();
    }
  });
});

function node(projectId: string, canonicalId: string, kind: Node['kind'], displayName: string): Node {
  return {
    id: canonicalId,
    projectId,
    kind,
    canonicalId,
    displayName,
    tags: [],
    domains: [],
  };
}

function edge(
  projectId: string,
  id: string,
  type: Edge['type'],
  fromNodeId: string,
  toNodeId: string,
): Edge {
  return {
    id,
    projectId,
    type,
    fromNodeId,
    toNodeId,
  };
}

function saveViewerDraft(workspace: ReturnType<typeof createOrderWorkspace>['workspace']): Draft {
  const projectId = workspace.getManifest()!.id;
  const baseSnapshot = currentModelSnapshot(workspace);
  const changedView = {
    ...baseSnapshot.nodes.find(item => item.canonicalId === 'vm.order-detail')!,
    displayName: 'Order Detail Draft',
  };
  const changedEvtToVmEdge = {
    ...baseSnapshot.edges.find(item => item.id === 'edge-evt-to-vm')!,
    meta: { apiKey: 'secret-value', fieldRefs: ['orderId'] },
  };
  const removedPayUi = baseSnapshot.nodes.find(item => item.canonicalId === 'ui.pay-order-action')!;
  const removedPayEdge = baseSnapshot.edges.find(item => item.id === 'edge-vm-to-pay')!;
  const addedConfirmation = node(projectId, 'ui.order-confirmation', 'ui.screen', 'Order Confirmation');
  const addedConfirmationEdge = edge(
    projectId,
    'edge-vm-to-confirmation',
    'viewModelConsumedByUiOrProcessor',
    'vm.order-detail',
    'ui.order-confirmation',
  );

  const draft: Draft = {
    id: 'draft_001',
    projectId,
    baseRevisionId: 'rev_000',
    baseSnapshot,
    status: 'open',
    message: 'Draft viewer overlay',
    proposals: [],
    ops: [
      {
        version: 2,
        op: 'edit',
        action: 'edit',
        entityType: 'node',
        entityId: 'vm.order-detail',
        timestamp: '2026-07-27T00:00:00.000Z',
        before: baseSnapshot.nodes.find(item => item.canonicalId === 'vm.order-detail'),
        after: changedView,
      },
      {
        version: 2,
        op: 'edit',
        action: 'edit',
        entityType: 'edge',
        entityId: changedEvtToVmEdge.id,
        timestamp: '2026-07-27T00:00:00.500Z',
        before: baseSnapshot.edges.find(item => item.id === 'edge-evt-to-vm'),
        after: changedEvtToVmEdge,
      },
      {
        version: 2,
        op: 'add',
        action: 'add',
        entityType: 'node',
        entityId: addedConfirmation.canonicalId,
        timestamp: '2026-07-27T00:00:01.000Z',
        before: null,
        after: addedConfirmation,
      },
      {
        version: 2,
        op: 'add',
        action: 'add',
        entityType: 'edge',
        entityId: addedConfirmationEdge.id,
        timestamp: '2026-07-27T00:00:02.000Z',
        before: null,
        after: addedConfirmationEdge,
      },
      {
        version: 2,
        op: 'remove',
        action: 'remove',
        entityType: 'edge',
        entityId: removedPayEdge.id,
        timestamp: '2026-07-27T00:00:03.000Z',
        before: removedPayEdge,
        after: null,
      },
      {
        version: 2,
        op: 'remove',
        action: 'remove',
        entityType: 'node',
        entityId: removedPayUi.canonicalId,
        timestamp: '2026-07-27T00:00:04.000Z',
        before: removedPayUi,
        after: null,
      },
    ],
  };
  workspace.saveDraft(draft);
  workspace.setActiveDraft(draft.id);
  return draft;
}

function getJson(server: Server, path: string): Promise<{ status: number; json: any }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server has no port');

  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: address.port, path }, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          json: JSON.parse(data),
        });
      });
    }).on('error', reject);
  });
}
