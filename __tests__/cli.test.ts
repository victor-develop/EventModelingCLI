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
      expect((r.data.edge as any).type).toBe('uiOrProcessorConsumesViewModel');
    });

    test('ui expose-cmd', () => {
      em('ui', 'add', 'screen', '--name', 'Detail');
      em('cmd', 'new', 'order.cmd.test-do');
      const r = em('ui', 'expose-cmd', '--role', 'role.customer', '--ui', 'ui.screen.detail', '--cmd', 'order.cmd.test-do');
      expect(r.ok).toBe(true);
      expect((r.data.edge as any).type).toBe('roleUsesUIToIssueCommand');
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
      em('view', 'new', 'order.view.charge.detail');
      em('evt', 'new', 'order.evt.charge.succeeded');
      em('link', 'evt->view', 'order.evt.charge.succeeded', 'order.view.charge.detail');
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
      const r = em('review', 'impact', 'evt', 'order.evt.test.happened');
      expect(r.ok).toBe(true);
      expect((r.data as any).eventId).toBe('order.evt.test.happened');
    });

    test('review impact field', () => {
      em('view', 'new', 'order.view.test.detail');
      em('evt', 'new', 'order.evt.test.happened');
      em('link', 'evt->view', 'order.evt.test.happened', 'order.view.test.detail');
      em('view', 'field', 'add', 'order.view.test.detail', '--field-id', 'f.id', '--name', 'id', '--type', 'string', '--from-event', 'order.evt.test.happened', '--path', 'payload.id');
      const r = em('review', 'impact', 'field', 'order.view.test.detail', 'f.id');
      expect(r.ok).toBe(true);
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

      em('ui', 'expose-cmd', '--role', 'role.customer', '--ui', 'ui.screen.tracking-detail', '--cmd', 'tracking.refresh.cmd.refresh-tracking');

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
});
