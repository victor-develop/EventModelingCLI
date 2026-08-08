import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Workspace } from '../src/workspace/workspace';
import { routeCommand } from '../src/cli/router';

let tmpDir: string;
let ws: Workspace;

function setup() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-test-'));
  ws = new Workspace(tmpDir);
}

function cleanup() {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function em(...args: string[]) {
  return routeCommand(ws, args);
}

describe('Event Modeling CLI', () => {
  beforeEach(() => setup());
  afterEach(() => cleanup());

  describe('project init', () => {
    test('creates a new project', () => {
      const r = em('project', 'init', 'Payments Modeling');
      expect(r.ok).toBe(true);
      expect(r.command).toBe('em project init');
      expect(r.data.project).toBeDefined();
      expect((r.data.project as any).name).toBe('Payments Modeling');
      expect((r.data.project as any).headRevisionId).toBeNull();
    });
  });

  describe('project open', () => {
    test('opens existing project', () => {
      em('project', 'init', 'Payments');
      const r = em('project', 'open', 'proj_payments');
      expect(r.ok).toBe(true);
      expect((r.data.project as any).name).toBe('Payments');
    });

    test('restores the open draft when opening an existing project', () => {
      em('project', 'init', 'Payments');
      em('draft', 'start', '--n', 'working');
      em('project', 'init', 'Other');

      const r = em('project', 'open', 'proj_payments');

      expect(r.ok).toBe(true);
      expect(ws.getContext()!.draft?.id).toBe('draft_001');
    });

    test('fails for missing project', () => {
      const r = em('project', 'open', 'nonexistent');
      expect(r.ok).toBe(false);
    });
  });

  describe('ctx', () => {
    test('shows current context', () => {
      em('project', 'init', 'Test');
      const r = em('ctx');
      expect(r.ok).toBe(true);
      expect(r.data.project).toBeDefined();
    });
  });

  describe('draft workflow', () => {
    test('start, status, diff, submit', () => {
      em('project', 'init', 'Test');
      const draft = em('draft', 'start', '--n', 'Add feature');
      expect(draft.ok).toBe(true);
      expect((draft.data.draft as any).status).toBe('open');

      const status = em('draft', 'status');
      expect(status.ok).toBe(true);

      const diff = em('draft', 'diff', '--format', 'json');
      expect(diff.ok).toBe(true);
      expect((diff.data as any).format).toBe('json');

      const submitResult = em('submit', '--m', 'Done');
      expect(submitResult.ok).toBe(true);
      expect((submitResult.data as any).newRevision).toBeDefined();
    });

    test('mutating commands require an active draft and do not advance counters', () => {
      em('project', 'init', 'Test');
      const mutatingCommands: string[][] = [
        ['cmd', 'new', 'order.cmd.create-order'],
        ['evt', 'new', 'order.evt.order-created'],
        ['view', 'new', 'order.view.detail'],
        ['proc', 'new', 'order.proc.worker'],
        ['trigger', 'new', 'order.trigger.webhook'],
        ['role', 'add', 'role.buyer'],
        ['story', 'add', 'story', '--title', 'Create order'],
        ['ui', 'add', 'screen', '--name', 'Order Detail'],
        ['link', 'cmd->evt', 'order.cmd.create-order', 'order.evt.order-created'],
        ['link', 'evt->view', 'order.evt.order-created', 'order.view.detail'],
        ['ui', 'bind-view', '--ui', 'ui.screen.order-detail', '--view', 'order.view.detail'],
        ['role', 'issues-cmd', '--role', 'role.buyer', '--via', 'ui.screen.order-detail', '--cmd', 'order.cmd.create-order'],
        ['proc', 'bind-view', '--proc', 'order.proc.worker', '--view', 'order.view.detail'],
        ['trigger', 'issues-cmd', '--trigger', 'order.trigger.webhook', '--cmd', 'order.cmd.create-order'],
        ['story', 'bind', '--story', 'story.create-order', '--cmd', 'order.cmd.create-order'],
        ['cmd', 'schema', 'init', 'order.cmd.create-order'],
        ['cmd', 'field', 'add', 'order.cmd.create-order', '--field-id', 'orderId', '--name', 'orderId', '--type', 'string'],
        ['cmd', 'field', 'edit', 'order.cmd.create-order', 'orderId', '--type', 'scalar.id'],
        ['cmd', 'field', 'rm', 'order.cmd.create-order', 'orderId'],
        ['evt', 'schema', 'init', 'order.evt.order-created'],
        ['evt', 'field', 'add', 'order.evt.order-created', '--field-id', 'orderId', '--name', 'orderId', '--type', 'string'],
        ['evt', 'field', 'edit', 'order.evt.order-created', 'orderId', '--type', 'scalar.id'],
        ['evt', 'field', 'rm', 'order.evt.order-created', 'orderId'],
        ['view', 'field', 'add', 'order.view.detail', '--field-id', 'f.order-id', '--name', 'orderId', '--type', 'string', '--from-event', 'order.evt.order-created', '--path', 'payload.orderId'],
        ['view', 'field', 'edit', 'order.view.detail', 'f.order-id', '--nullable'],
        ['view', 'field', 'rm', 'order.view.detail', 'f.order-id'],
        ['story', 'suggest-bind', '--story', 'story.create-order', '--from-cmd', 'order.cmd.create-order'],
        ['story', 'revise-bind', 'proposal_001', 'set-mode', '--mode', 'core'],
        ['story', 'confirm-bind', '--story', 'story.create-order', '--proposal', 'proposal_001'],
      ];

      for (const args of mutatingCommands) {
        const r = em(...args);
        expect([args.join(' '), r.error?.code]).toEqual([args.join(' '), 'NO_DRAFT']);
      }

      const manifest = ws.getManifest()!;
      expect(manifest.nodeCounter).toBe(0);
      expect(manifest.edgeCounter).toBe(0);
      expect(manifest.proposalCounter).toBe(0);
      expect(ws.listNodes()).toHaveLength(0);
      expect(ws.listEdges()).toHaveLength(0);
      expect(ws.listCommandSchemas()).toHaveLength(0);
      expect(ws.listEventSchemas()).toHaveLength(0);
    });

    test('draft start refuses to replace an open draft', () => {
      em('project', 'init', 'Test');
      const first = em('draft', 'start', '--n', 'first');
      const second = em('draft', 'start', '--n', 'second');

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(false);
      expect(second.error?.code).toBe('DRAFT_ALREADY_OPEN');
      expect(ws.getManifest()!.draftCounter).toBe(1);
      expect(ws.getContext()!.draft?.id).toBe('draft_001');
    });

    test('successful mutations write versioned draft ops with snapshots', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'tracked');

      const r = em('cmd', 'new', 'order.cmd.create-order');

      expect(r.ok).toBe(true);
      const draft = ws.getContext()!.draft!;
      expect(draft.ops).toHaveLength(1);
      expect(draft.ops[0]).toEqual(expect.objectContaining({
        version: 2,
        action: 'add',
        entityType: 'node',
        entityId: 'order.cmd.create-order',
        before: null,
      }));
      expect((draft.ops[0].after as any).canonicalId).toBe('order.cmd.create-order');
      expect(draft.ops[0].transactionId).toBeTruthy();
      expect(draft.ops[0].target?.nodeKind).toBe('cmd');
    });

    test('submit rejects invalid drafts without moving head revision', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'invalid');
      em('cmd', 'new', 'order.cmd.create-order');

      const r = em('submit', '--m', 'invalid submit');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('VALIDATION_FAILED');
      expect(ws.getManifest()!.headRevisionId).toBeNull();
      expect(ws.getContext()!.draft?.status).toBe('open');
    });

    test('submit rejects drafts when head no longer matches draft base', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'stale');
      ws.updateManifest({ headRevisionId: 'rev_999' });

      const r = em('submit', '--m', 'stale submit');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DRAFT_BASE_MISMATCH');
      expect(ws.getContext()!.draft?.status).toBe('open');
    });

    test('submit rejects drafts when recorded ops no longer match model files', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'split');
      em('cmd', 'new', 'order.cmd.create-order');
      fs.rmSync(path.join(tmpDir, 'projects', 'test', 'nodes', 'order.cmd.create-order.yaml'));

      const r = em('submit', '--m', 'split submit');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DRAFT_MODEL_MISMATCH');
      expect(ws.getContext()!.draft?.status).toBe('open');
    });

    test('submit rejects untracked live model additions outside draft ops', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'manual');
      ws.saveNode({
        id: 'node_manual',
        projectId: ws.getManifest()!.id,
        kind: 'cmd',
        canonicalId: 'manual.cmd.outside-change',
        displayName: 'Outside Change',
        tags: [],
        domains: ['manual'],
      });

      const r = em('submit', '--m', 'manual submit');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DRAFT_MODEL_MISMATCH');
      expect(ws.getContext()!.draft?.status).toBe('open');
    });

    test('submit rejects untracked schema content changes outside draft ops', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'manual schema');
      em('view', 'new', 'order.view.order.detail');
      ws.saveViewModelSchema({
        viewModelNodeId: 'order.view.order.detail',
        fields: [{
          fieldId: 'f.manual',
          name: 'manual',
          type: 'string',
          nullable: true,
          source: { eventNodeId: 'order.evt.order.created', eventFieldPath: 'payload.manual' },
        }],
      });

      const r = em('submit', '--m', 'manual schema submit');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DRAFT_MODEL_MISMATCH');
      expect(ws.getContext()!.draft?.status).toBe('open');
    });
  });

  describe('versions and checkout', () => {
    test('lists versions', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'first');
      em('submit', '--m', 'rev1');
      const r = em('versions');
      expect(r.ok).toBe(true);
      expect((r.data.revisions as any[]).length).toBe(1);
    });

    test('checks out a revision', () => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'first');
      em('submit', '--m', 'rev1');
      const r = em('checkout', 'rev_001');
      expect(r.ok).toBe(true);
      expect((r.data.revision as any).id).toBe('rev_001');
    });
  });

  describe('node creation commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
    });

    test('cmd new', () => {
      const r = em('cmd', 'new', 'order.payment.cmd.capture-charge', '--name', 'Capture Charge');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('cmd');
      expect((r.data.node as any).canonicalId).toBe('order.payment.cmd.capture-charge');
    });

    test('evt new', () => {
      const r = em('evt', 'new', 'order.payment.evt.charge.succeeded', '--name', 'Charge Succeeded');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('evt');
    });

    test('view new', () => {
      const r = em('view', 'new', 'order.payment.view.charge.detail', '--name', 'Charge Detail');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('viewModel');
    });

    test('proc new', () => {
      const r = em('proc', 'new', 'order.payment.proc.charge.reconcile');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('proc');
    });

    test('proc new stores owner role', () => {
      const r = em('proc', 'new', 'order.payment.proc.merchant-api', '--owner-role', 'role.merchant');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).ownerRole).toBe('role.merchant');
      expect(ws.getNode('order.payment.proc.merchant-api')?.ownerRole).toBe('role.merchant');
    });

    test('role add', () => {
      const r = em('role', 'add', 'role.buyer', '--name', 'Buyer');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('role');
      expect((r.data.node as any).canonicalId).toBe('role.buyer');
      expect(ws.getNode('role.buyer')?.displayName).toBe('Buyer');
    });

    test('trigger new', () => {
      const r = em('trigger', 'new', 'order.payment.trigger.webhook.stripe-event');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('trigger');
    });

    test('duplicate node rejected', () => {
      em('cmd', 'new', 'order.cmd.test-cmd');
      const r = em('cmd', 'new', 'order.cmd.test-cmd');
      expect(r.ok).toBe(false);
    });

    test('unsafe canonical ids are rejected before writing model files', () => {
      const r = em('cmd', 'new', '../escape');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('INVALID_CANONICAL_ID');
      expect(ws.getManifest()!.nodeCounter).toBe(0);
      expect(ws.listNodes()).toHaveLength(0);
    });
  });

  describe('link commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
      em('cmd', 'new', 'order.payment.cmd.capture-charge');
      em('evt', 'new', 'order.payment.evt.charge.succeeded');
      em('view', 'new', 'order.payment.view.charge.detail');
    });

    test('link cmd->evt', () => {
      const r = em('link', 'cmd->evt', 'order.payment.cmd.capture-charge', 'order.payment.evt.charge.succeeded');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('commandCausesEvent');
    });

    test('link evt->view', () => {
      const r = em('link', 'evt->view', 'order.payment.evt.charge.succeeded', 'order.payment.view.charge.detail');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('eventRefreshesViewModel');
    });
  });

  describe('story commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
    });

    test('story add', () => {
      const r = em('story', 'add', 'story', '--title', 'Test Story');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('story.story');
    });

    test('story tree', () => {
      em('story', 'add', 'epic', '--title', 'Epic One');
      const r = em('story', 'tree');
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.data.tree)).toBe(true);
    });

    test('story bind', () => {
      em('story', 'add', 'story', '--title', 'Test');
      em('cmd', 'new', 'order.cmd.test-do');
      const r = em('story', 'bind', '--story', 'story.test', '--cmd', 'order.cmd.test-do');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('storyOwnsCommand');
    });
  });

  describe('ui commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
    });

    test('ui add', () => {
      const r = em('ui', 'add', 'screen', '--name', 'Payment Detail');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).kind).toBe('ui.screen');
    });

    test('ui add stores owner role', () => {
      const r = em('ui', 'add', 'screen', '--name', 'Merchant Console', '--owner-role', 'role.merchant');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).ownerRole).toBe('role.merchant');
      expect(ws.getNode('ui.screen.merchant-console')?.ownerRole).toBe('role.merchant');
    });

    test('ui tree', () => {
      em('ui', 'add', 'app', '--name', 'Tracking');
      const r = em('ui', 'tree');
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.data.tree)).toBe(true);
    });

    test('ui bind-view', () => {
      em('ui', 'add', 'component', '--name', 'Detail List');
      em('view', 'new', 'order.view.order.detail');
      const r = em('ui', 'bind-view', '--ui', 'ui.component.detail-list', '--view', 'order.view.order.detail', '--fields', 'f.id,f.name');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('viewModelConsumedByUiOrProcessor');
      expect((r.data.edge as any).fromNodeId).toBe('order.view.order.detail');
      expect((r.data.edge as any).toNodeId).toBe('ui.component.detail-list');
    });

    test('role issues-cmd via UI', () => {
      em('ui', 'add', 'screen', '--name', 'Detail');
      em('cmd', 'new', 'order.cmd.test-do');
      const r = em('role', 'issues-cmd', '--role', 'role.customer', '--via', 'ui.screen.detail', '--cmd', 'order.cmd.test-do');
      expect(r.ok).toBe(true);
      expect(r.command).toBe('em role issues-cmd');
      expect((r.data.edge as any).fromNodeId).toBe('role.customer');
      expect((r.data.edge as any).viaNodeId).toBe('ui.screen.detail');
      expect((r.data.edge as any).type).toBe('roleIssuesCommand');
      expect(ws.getNode('role.customer')?.kind).toBe('role');
    });

    test('role issues-cmd via proc', () => {
      em('proc', 'new', 'return.proc.public-api');
      em('cmd', 'new', 'return.cmd.request-return');
      const r = em('role', 'issues-cmd', '--role', 'role.buyer', '--via', 'return.proc.public-api', '--cmd', 'return.cmd.request-return');
      expect(r.ok).toBe(true);
      expect(r.command).toBe('em role issues-cmd');
      expect((r.data.edge as any).fromNodeId).toBe('role.buyer');
      expect((r.data.edge as any).viaNodeId).toBe('return.proc.public-api');
      expect((r.data.edge as any).type).toBe('roleIssuesCommand');
      expect(ws.getNode('role.buyer')?.kind).toBe('role');
    });

    test('role issues-cmd does not persist a role when validation fails', () => {
      em('ui', 'add', 'screen', '--name', 'Return Portal');
      const missingCommand = em('role', 'issues-cmd', '--role', 'role.buyer', '--via', 'ui.screen.return-portal', '--cmd', 'return.cmd.missing');
      expect(missingCommand.ok).toBe(false);
      expect(ws.getNode('role.buyer')).toBeNull();
    });

    test('role issues-cmd validates auto-created role ids', () => {
      em('ui', 'add', 'screen', '--name', 'Return Portal');
      em('cmd', 'new', 'return.cmd.request-return');
      const r = em('role', 'issues-cmd', '--role', 'Role Buyer', '--via', 'ui.screen.return-portal', '--cmd', 'return.cmd.request-return');
      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('INVALID_CANONICAL_ID');
      expect(ws.getNode('Role Buyer')).toBeNull();
    });
  });

  describe('automation commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
    });

    test('proc bind-view', () => {
      em('proc', 'new', 'order.proc.payment.process');
      em('view', 'new', 'order.view.payment.status');
      const r = em('proc', 'bind-view', '--proc', 'order.proc.payment.process', '--view', 'order.view.payment.status', '--fields', 'f.status');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('viewModelConsumedByUiOrProcessor');
      expect((r.data.edge as any).fromNodeId).toBe('order.view.payment.status');
      expect((r.data.edge as any).toNodeId).toBe('order.proc.payment.process');
    });

    test('trigger issues-cmd', () => {
      em('trigger', 'new', 'order.trigger.webhook.payment');
      em('cmd', 'new', 'order.cmd.process-payment');
      const r = em('trigger', 'issues-cmd', '--trigger', 'order.trigger.webhook.payment', '--cmd', 'order.cmd.process-payment');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('processorOrTriggerIssuesCommand');
    });
  });

  describe('schema commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
      em('cmd', 'new', 'order.cmd.capture-charge');
      em('view', 'new', 'order.view.charge.detail');
      em('evt', 'new', 'order.evt.charge.succeeded');
      em('link', 'evt->view', 'order.evt.charge.succeeded', 'order.view.charge.detail');
    });

    test('cmd schema init and field add', () => {
      const init = em('cmd', 'schema', 'init', 'order.cmd.capture-charge');
      expect(init.ok).toBe(true);
      expect((init.data as any).created).toBe(true);

      const r = em('cmd', 'field', 'add', 'order.cmd.capture-charge', '--field-id', 'payment.id', '--name', 'paymentId', '--type', 'string');
      expect(r.ok).toBe(true);
      expect((r.data.field as any).fieldId).toBe('payment.id');
      expect((r.data.field as any).required).toBe(true);
    });

    test('cmd field edit and rm', () => {
      em('cmd', 'field', 'add', 'order.cmd.capture-charge', '--field-id', 'payment.id', '--name', 'paymentId', '--type', 'string');
      const edit = em('cmd', 'field', 'edit', 'order.cmd.capture-charge', 'payment.id', '--type', 'scalar.id', '--optional');
      expect(edit.ok).toBe(true);
      expect((edit.data.field as any).type).toBe('scalar.id');
      expect((edit.data.field as any).required).toBe(false);

      const rm = em('cmd', 'field', 'rm', 'order.cmd.capture-charge', 'payment.id');
      expect(rm.ok).toBe(true);
      expect((rm.data as any).removedFieldId).toBe('payment.id');
    });

    test('cmd schema show', () => {
      em('cmd', 'field', 'add', 'order.cmd.capture-charge', '--field-id', 'payment.id', '--name', 'paymentId', '--type', 'string');
      const r = em('cmd', 'schema', 'show', 'order.cmd.capture-charge');
      expect(r.ok).toBe(true);
      expect(((r.data.input as any).fields as any[]).length).toBe(1);
    });

    test('evt schema init and field add', () => {
      const init = em('evt', 'schema', 'init', 'order.evt.charge.succeeded');
      expect(init.ok).toBe(true);
      expect((init.data as any).created).toBe(true);

      const r = em('evt', 'field', 'add', 'order.evt.charge.succeeded', '--field-id', 'payload.status', '--name', 'status', '--type', 'string', '--optional');
      expect(r.ok).toBe(true);
      expect((r.data.field as any).fieldId).toBe('payload.status');
      expect((r.data.field as any).required).toBe(false);
    });

    test('evt field edit, rm, and schema show', () => {
      em('evt', 'field', 'add', 'order.evt.charge.succeeded', '--field-id', 'status', '--name', 'status', '--type', 'string');
      const edit = em('evt', 'field', 'edit', 'order.evt.charge.succeeded', 'status', '--description', 'Charge state');
      expect(edit.ok).toBe(true);
      expect((edit.data.field as any).description).toBe('Charge state');

      const show = em('evt', 'schema', 'show', 'order.evt.charge.succeeded');
      expect(show.ok).toBe(true);
      expect(((show.data.payload as any).fields as any[]).length).toBe(1);

      const rm = em('evt', 'field', 'rm', 'order.evt.charge.succeeded', 'status');
      expect(rm.ok).toBe(true);
      expect((rm.data as any).removedFieldId).toBe('status');
    });

    test('schema field add rejects duplicate field ids', () => {
      em('evt', 'field', 'add', 'order.evt.charge.succeeded', '--field-id', 'status', '--name', 'status', '--type', 'string');
      const r = em('evt', 'field', 'add', 'order.evt.charge.succeeded', '--field-id', 'status', '--name', 'status', '--type', 'string');
      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DUPLICATE');
    });

    test('validate reports orphan command schema files', () => {
      const schemaDir = path.join(tmpDir, 'projects', 'test', 'schemas');
      fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(
        path.join(schemaDir, 'order.cmd.orphan.schema.yaml'),
        [
          'commandNodeId: order.cmd.orphan',
          'version: 1',
          'input:',
          '  fields: []',
          '',
        ].join('\n'),
        'utf-8',
      );

      const r = em('validate');

      expect(r.ok).toBe(true);
      expect((r.data.errors as any[]).some(e => e.code === 'EMV-060' && e.details.schemaNodeId === 'order.cmd.orphan')).toBe(true);
    });

    test('draft diff includes schema field add edit and remove', () => {
      em('cmd', 'field', 'add', 'order.cmd.capture-charge', '--field-id', 'payment.id', '--name', 'paymentId', '--type', 'string');
      em('cmd', 'field', 'edit', 'order.cmd.capture-charge', 'payment.id', '--type', 'scalar.id');
      em('cmd', 'field', 'rm', 'order.cmd.capture-charge', 'payment.id');
      em('evt', 'field', 'add', 'order.evt.charge.succeeded', '--field-id', 'status', '--name', 'status', '--type', 'string');
      em('evt', 'field', 'edit', 'order.evt.charge.succeeded', 'status', '--description', 'Charge state');
      em('view', 'field', 'add', 'order.view.charge.detail', '--field-id', 'f.status', '--name', 'status', '--type', 'string', '--from-event', 'order.evt.charge.succeeded', '--path', 'payload.status');
      em('view', 'field', 'edit', 'order.view.charge.detail', 'f.status', '--nullable');

      const diff = em('draft', 'diff');

      expect(diff.ok).toBe(true);
      expect((diff.data.diff as any).fieldsAdded).toEqual(expect.arrayContaining([
        'order.cmd.capture-charge#payment.id',
        'order.evt.charge.succeeded#status',
        'order.view.charge.detail#f.status',
      ]));
      expect((diff.data.diff as any).fieldsUpdated).toEqual(expect.arrayContaining([
        'order.cmd.capture-charge#payment.id',
        'order.evt.charge.succeeded#status',
        'order.view.charge.detail#f.status',
      ]));
      expect((diff.data.diff as any).fieldsRemoved).toContain('order.cmd.capture-charge#payment.id');
      expect((diff.data.diff as any).changes).toEqual(expect.arrayContaining([
        expect.objectContaining({
          action: 'edit',
          entityType: 'schema',
          entityId: 'order.cmd.capture-charge#payment.id',
          before: expect.objectContaining({ type: 'string' }),
          after: expect.objectContaining({ type: 'scalar.id' }),
        }),
      ]));
    });

    test('draft diff separates schema envelopes from schema fields', () => {
      const diff = em('draft', 'diff');

      expect(diff.ok).toBe(true);
      expect((diff.data.diff as any).schemasAdded).toContain('order.view.charge.detail');
      expect((diff.data.diff as any).fieldsAdded).not.toContain('order.view.charge.detail');
      expect((diff.data.diff as any).summary.schemasAdded).toBeGreaterThan(0);
    });

    test('view field add', () => {
      const r = em('view', 'field', 'add', 'order.view.charge.detail', '--field-id', 'f.status', '--name', 'status', '--type', 'string', '--from-event', 'order.evt.charge.succeeded', '--path', 'payload.status');
      expect(r.ok).toBe(true);
      expect((r.data.field as any).fieldId).toBe('f.status');
    });

    test('view field edit', () => {
      em('view', 'field', 'add', 'order.view.charge.detail', '--field-id', 'f.status', '--name', 'status', '--type', 'string', '--from-event', 'order.evt.charge.succeeded', '--path', 'payload.status');
      const r = em('view', 'field', 'edit', 'order.view.charge.detail', 'f.status', '--nullable');
      expect(r.ok).toBe(true);
      expect((r.data.field as any).nullable).toBe(true);
    });

    test('view field rm', () => {
      em('view', 'field', 'add', 'order.view.charge.detail', '--field-id', 'f.status', '--name', 'status', '--type', 'string', '--from-event', 'order.evt.charge.succeeded', '--path', 'payload.status');
      const r = em('view', 'field', 'rm', 'order.view.charge.detail', 'f.status');
      expect(r.ok).toBe(true);
      expect((r.data as any).removedFieldId).toBe('f.status');
    });

    test('view schema show', () => {
      em('view', 'field', 'add', 'order.view.charge.detail', '--field-id', 'f.status', '--name', 'status', '--type', 'string', '--from-event', 'order.evt.charge.succeeded', '--path', 'payload.status');
      const r = em('view', 'schema', 'show', 'order.view.charge.detail');
      expect(r.ok).toBe(true);
      expect((r.data.fields as any[]).length).toBe(1);
    });
  });

  describe('exploration commands', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
      em('cmd', 'new', 'order.cmd.create-order');
      em('evt', 'new', 'order.evt.order.created');
      em('view', 'new', 'order.view.order.detail');
      em('link', 'cmd->evt', 'order.cmd.create-order', 'order.evt.order.created');
      em('link', 'evt->view', 'order.evt.order.created', 'order.view.order.detail');
    });

    test('show', () => {
      const r = em('show', 'order.cmd.create-order');
      expect(r.ok).toBe(true);
      expect((r.data.node as any).canonicalId).toBe('order.cmd.create-order');
    });

    test('neighbors', () => {
      const r = em('neighbors', '--node', 'order.cmd.create-order', '--direction', 'out');
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.data.neighbors)).toBe(true);
    });

    test('neighbors reports view model consumption with canonical direction', () => {
      em('ui', 'add', 'component', '--name', 'Order Detail Panel');
      em('ui', 'bind-view', '--ui', 'ui.component.order-detail-panel', '--view', 'order.view.order.detail');

      const viewNeighbors = em('neighbors', '--node', 'order.view.order.detail', '--direction', 'out');
      expect(viewNeighbors.ok).toBe(true);
      expect(viewNeighbors.data.neighbors).toEqual([
        expect.objectContaining({
          edgeType: 'viewModelConsumedByUiOrProcessor',
          direction: 'out',
          nodeId: 'ui.component.order-detail-panel',
          nodeKind: 'ui.component',
        }),
      ]);

      const uiNeighbors = em('neighbors', '--node', 'ui.component.order-detail-panel', '--direction', 'both');
      expect(uiNeighbors.ok).toBe(true);
      expect(uiNeighbors.data.neighbors).toEqual([
        expect.objectContaining({
          edgeType: 'viewModelConsumedByUiOrProcessor',
          direction: 'in',
          nodeId: 'order.view.order.detail',
          nodeKind: 'viewModel',
        }),
      ]);
    });

    test('walk forward', () => {
      const r = em('walk', '--from', 'order.cmd.create-order', '--direction', 'forward', '--max-hops', '3');
      expect(r.ok).toBe(true);
    });

    test('trace', () => {
      const r = em('trace', '--from', 'order.cmd.create-order', '--to', 'order.view.order.detail', '--max-hops', '6');
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.data.paths)).toBe(true);
    });

    test('graph', () => {
      const r = em('graph', '--format', 'mermaid');
      expect(r.ok).toBe(true);
      expect((r.data as any).format).toBe('mermaid');
      expect(typeof (r.data as any).graph).toBe('string');
    });

    test('event-model graph commands exclude UI hierarchy edges', () => {
      em('ui', 'add', 'app', '--name', 'Orders');
      em('ui', 'add', 'screen', '--name', 'Order Detail', '--parent', 'ui.app.orders');

      const neighbors = em('neighbors', '--node', 'ui.app.orders', '--direction', 'out');
      expect(neighbors.ok).toBe(true);
      expect((neighbors.data.neighbors as any[]).map((item) => item.edgeType)).not.toContain('parentOf');
      expect(neighbors.data.neighbors).toEqual([]);

      const walk = em('walk', '--from', 'ui.app.orders', '--direction', 'forward', '--max-hops', '2');
      expect(walk.ok).toBe(true);
      const branches = ((walk.data.subgraph as any).branches ?? []) as any[];
      expect(branches).toEqual([]);

      const trace = em('trace', '--from', 'ui.app.orders', '--to', 'ui.screen.order-detail', '--max-hops', '2');
      expect(trace.ok).toBe(true);
      expect(trace.data.paths).toEqual([]);

      const graph = em('graph', '--format', 'mermaid');
      expect(graph.ok).toBe(true);
      expect((graph.data.graph as string)).not.toContain('ui.app.orders');
      expect((graph.data.graph as string)).not.toContain('ui.screen.order-detail');
    });
  });

  describe('validate and review', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
    });

    test('validate catches errors', () => {
      em('cmd', 'new', 'order.cmd.test-do');
      const r = em('validate');
      expect(r.ok).toBe(true);
      expect((r.data as any).valid).toBe(false);
      const errors = (r.data as any).errors as any[];
      expect(errors.some((e: any) => e.code === 'EMV-020')).toBe(true);
    });

    test('review', () => {
      const r = em('review');
      expect(r.ok).toBe(true);
      expect((r.data as any).summary).toBeDefined();
    });

    test('review impact evt', () => {
      em('evt', 'new', 'order.evt.test.happened');
      em('view', 'new', 'order.view.test.detail');
      em('ui', 'add', 'screen', '--name', 'Test Detail');
      em('link', 'evt->view', 'order.evt.test.happened', 'order.view.test.detail');
      em('ui', 'bind-view', '--ui', 'ui.screen.test-detail', '--view', 'order.view.test.detail');
      const r = em('review', 'impact', 'evt', 'order.evt.test.happened');
      expect(r.ok).toBe(true);
      expect((r.data as any).eventId).toBe('order.evt.test.happened');
      expect((r.data as any).affectedViewModels).toContain('order.view.test.detail');
      expect((r.data as any).affectedUiNodes).toContain('ui.screen.test-detail');
    });

    test('review impact field', () => {
      em('view', 'new', 'order.view.test.detail');
      em('evt', 'new', 'order.evt.test.happened');
      em('ui', 'add', 'screen', '--name', 'Test Detail');
      em('proc', 'new', 'order.proc.test-consumer');
      em('link', 'evt->view', 'order.evt.test.happened', 'order.view.test.detail');
      em('view', 'field', 'add', 'order.view.test.detail', '--field-id', 'f.id', '--name', 'id', '--type', 'string', '--from-event', 'order.evt.test.happened', '--path', 'payload.id');
      em('ui', 'bind-view', '--ui', 'ui.screen.test-detail', '--view', 'order.view.test.detail', '--fields', 'f.id');
      em('proc', 'bind-view', '--proc', 'order.proc.test-consumer', '--view', 'order.view.test.detail', '--fields', 'f.id');
      const r = em('review', 'impact', 'field', 'order.view.test.detail', 'f.id');
      expect(r.ok).toBe(true);
      expect((r.data as any).consumers.ui).toContain('ui.screen.test-detail');
      expect((r.data as any).consumers.proc).toContain('order.proc.test-consumer');
    });

    test('review impact draft returns the reusable net draft analysis', () => {
      em('cmd', 'new', 'order.cmd.test-do');

      const r = em('review', 'impact', 'draft');

      expect(r.ok).toBe(true);
      expect(r.command).toBe('em review impact draft');
      expect((r.data as any).impact).toMatchObject({
        draftId: 'draft_001',
        baseRevisionId: 'rev_000',
        summary: expect.objectContaining({ seedCount: 1 }),
      });
      expect((r.data as any).impact.seeds).toEqual([
        expect.objectContaining({ entityType: 'node', status: 'added', nodeId: 'order.cmd.test-do' }),
      ]);
    });

    test('review impact draft rejects an unknown explicit draft', () => {
      const r = em('review', 'impact', 'draft', 'draft_missing');

      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('DRAFT_NOT_FOUND');
    });
  });

  describe('story proposal workflow', () => {
    beforeEach(() => {
      em('project', 'init', 'Test');
      em('draft', 'start', '--n', 'working');
      em('story', 'add', 'story', '--title', 'Create Order');
      em('cmd', 'new', 'order.cmd.create-order');
      em('evt', 'new', 'order.evt.order.created');
      em('view', 'new', 'order.view.order.detail');
      em('link', 'cmd->evt', 'order.cmd.create-order', 'order.evt.order.created');
      em('link', 'evt->view', 'order.evt.order.created', 'order.view.order.detail');
    });

    test('suggest-bind creates proposal', () => {
      const r = em('story', 'suggest-bind', '--story', 'story.create-order', '--from-cmd', 'order.cmd.create-order', '--mode', 'full');
      expect(r.ok).toBe(true);
      expect((r.data as any).proposal).toBeDefined();
      expect(((r.data as any).proposal.candidateRootCommandIds as string[])).toContain('order.cmd.create-order');
    });

    test('confirm-bind persists edges', () => {
      const suggest = em('story', 'suggest-bind', '--story', 'story.create-order', '--from-cmd', 'order.cmd.create-order');
      const proposalId = ((suggest.data as any).proposal as any).id;
      const r = em('story', 'confirm-bind', '--story', 'story.create-order', '--proposal', proposalId);
      expect(r.ok).toBe(true);
      expect((r.data as any).createdEdges.length).toBeGreaterThan(0);
    });
  });

  describe('end-to-end: spec section 8 minimal example', () => {
    test('tracking timeline example', () => {
      em('project', 'init', 'Tracking');
      em('draft', 'start', '--n', 'Build tracking timeline');

      const roleR = em('story', 'add', 'story', '--title', 'Refresh Tracking', '--role', 'role.customer');
      expect(roleR.ok).toBe(true);

      const uiApp = em('ui', 'add', 'app', '--name', 'tracking');
      expect(uiApp.ok).toBe(true);

      const uiScreen = em('ui', 'add', 'screen', '--name', 'tracking detail', '--parent', 'ui.app.tracking');
      expect(uiScreen.ok).toBe(true);

      const uiSection = em('ui', 'add', 'section', '--name', 'tracking detail timeline', '--parent', 'ui.screen.tracking-detail');
      expect(uiSection.ok).toBe(true);

      const uiComponent = em('ui', 'add', 'component', '--name', 'tracking detail timeline list', '--parent', 'ui.section.tracking-detail-timeline');
      expect(uiComponent.ok).toBe(true);

      const cmdR = em('cmd', 'new', 'tracking.refresh.cmd.refresh-tracking', '--name', 'Refresh Tracking');
      expect(cmdR.ok).toBe(true);

      const evtR = em('evt', 'new', 'tracking.timeline.evt.timeline.refreshed', '--name', 'Timeline Refreshed');
      expect(evtR.ok).toBe(true);

      const viewR = em('view', 'new', 'tracking.timeline.view.timeline.detail', '--name', 'Timeline Detail');
      expect(viewR.ok).toBe(true);

      em('link', 'cmd->evt', 'tracking.refresh.cmd.refresh-tracking', 'tracking.timeline.evt.timeline.refreshed');
      em('link', 'evt->view', 'tracking.timeline.evt.timeline.refreshed', 'tracking.timeline.view.timeline.detail');

      em('view', 'field', 'add', 'tracking.timeline.view.timeline.detail', '--field-id', 'f.tracking-id', '--name', 'trackingId', '--type', 'string', '--from-event', 'tracking.timeline.evt.timeline.refreshed', '--path', 'payload.trackingId');
      em('view', 'field', 'add', 'tracking.timeline.view.timeline.detail', '--field-id', 'f.latest-status', '--name', 'latestStatus', '--type', 'string', '--from-event', 'tracking.timeline.evt.timeline.refreshed', '--path', 'payload.latestStatus');

      em('ui', 'bind-view', '--ui', 'ui.component.tracking-detail-timeline-list', '--view', 'tracking.timeline.view.timeline.detail', '--fields', 'f.latest-status,f.tracking-id');

      em('role', 'issues-cmd', '--role', 'role.customer', '--via', 'ui.screen.tracking-detail', '--cmd', 'tracking.refresh.cmd.refresh-tracking');

      const suggest = em('story', 'suggest-bind', '--story', 'story.refresh-tracking', '--from-cmd', 'tracking.refresh.cmd.refresh-tracking', '--mode', 'full');
      expect(suggest.ok).toBe(true);
      const proposalId = ((suggest.data as any).proposal as any).id;

      em('story', 'confirm-bind', '--story', 'story.refresh-tracking', '--proposal', proposalId);

      const validateR = em('validate');
      expect(validateR.ok).toBe(true);

      const schemaR = em('view', 'schema', 'show', 'tracking.timeline.view.timeline.detail');
      expect(schemaR.ok).toBe(true);
      expect((schemaR.data.fields as any[]).length).toBe(2);

      const showR = em('show', 'tracking.refresh.cmd.refresh-tracking');
      expect(showR.ok).toBe(true);

      const traceR = em('trace', '--from', 'role.customer', '--to', 'tracking.timeline.view.timeline.detail', '--max-hops', '10');
      expect(traceR.ok).toBe(true);

      const graphR = em('graph', '--format', 'mermaid');
      expect(graphR.ok).toBe(true);
      expect(((graphR.data as any).graph as string).length).toBeGreaterThan(0);

      const submitR = em('submit', '--m', 'Build tracking timeline');
      expect(submitR.ok).toBe(true);
      expect((submitR.data as any).newRevision).toBeDefined();

      const versionsR = em('versions');
      expect(versionsR.ok).toBe(true);
      expect((versionsR.data.revisions as any[]).length).toBe(1);

      em('draft', 'start', '--n', 'review draft');
      const reviewR = em('review');
      expect(reviewR.ok).toBe(true);

      const impactEvtR = em('review', 'impact', 'evt', 'tracking.timeline.evt.timeline.refreshed');
      expect(impactEvtR.ok).toBe(true);
      expect(((impactEvtR.data as any).affectedViewModels as string[])).toContain('tracking.timeline.view.timeline.detail');
    });
  });

  describe('em layout', () => {
    test('generates layout output for a graph', () => {
      em('project', 'init', 'Layout Test');
      em('draft', 'start', '--n', 'test');
      em('cmd', 'new', 'hotel.cmd.book-room');
      em('evt', 'new', 'hotel.evt.room.booked');
      em('view', 'new', 'hotel.view.booking.summary');
      em('link', 'cmd->evt', 'hotel.cmd.book-room', 'hotel.evt.room.booked');
      em('link', 'evt->view', 'hotel.evt.room.booked', 'hotel.view.booking.summary');

      const r = em('layout', '--focus', 'hotel.cmd.book-room');
      expect(r.ok).toBe(true);
      expect((r.data as any).layout).toBeDefined();
      expect((r.data as any).layout.nodes.length).toBeGreaterThanOrEqual(2);
      expect((r.data as any).layout.edges.length).toBeGreaterThanOrEqual(1);
      expect((r.data as any).layout.viewport).toBeDefined();

      const nodes = (r.data as any).layout.nodes;
      const cmd = nodes.find((n: any) => n.canonicalNodeId === 'hotel.cmd.book-room');
      const evt = nodes.find((n: any) => n.canonicalNodeId === 'hotel.evt.room.booked');
      expect(cmd).toBeDefined();
      expect(evt).toBeDefined();
      expect(cmd.stageIndex).toBe(1);
      expect(evt.stageIndex).toBe(2);
      expect(cmd.lane).toBe('commandViewModel');
      expect(evt.lane).toBe('event');
    });
  });

  describe('em roots', () => {
    test('returns empty roots for new project', () => {
      em('project', 'init', 'Test');
      const r = em('roots');
      expect(r.ok).toBe(true);
      expect((r.data as any).roots).toEqual([]);
      expect((r.data as any).count).toBe(0);
    });

    test('returns roots after adding nodes and edges', () => {
      em('project', 'init', 'Hotel');
      em('draft', 'start', '--n', 'test');
      em('cmd', 'new', 'hotel.cmd.book-room');
      em('cmd', 'new', 'hotel.cmd.cancel-booking');
      em('evt', 'new', 'hotel.evt.room.booked');
      em('link', 'cmd->evt', 'hotel.cmd.book-room', 'hotel.evt.room.booked');
      const r = em('roots');
      expect(r.ok).toBe(true);
      const rootIds = ((r.data as any).roots as any[]).map((x: any) => x.canonicalId);
      expect(rootIds).toContain('hotel.cmd.book-room');
      expect(rootIds).toContain('hotel.cmd.cancel-booking');
      expect((r.data as any).count).toBe(2);
    });
  });
});
