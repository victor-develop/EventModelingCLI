import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Workspace } from '../../src/workspace/workspace';
import type { Edge, Node } from '../../src/domain/types';

export function createOrderWorkspace(): { workspace: Workspace; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'em-order-'));
  const workspace = new Workspace(tmpDir);
  const { manifest } = workspace.initProject('Order Management');

  const nodes: Node[] = [
    node(manifest.id, 'ui.checkout', 'ui.screen', 'Checkout UI'),
    node(manifest.id, 'cmd.submit-order', 'cmd', 'Submit Order'),
    node(manifest.id, 'evt.order-submitted', 'evt', 'Order Submitted'),
    node(manifest.id, 'vm.order-detail', 'viewModel', 'Order Detail'),
    node(manifest.id, 'ui.pay-order-action', 'ui.component', 'Pay Order Action'),
  ];

  const edges: Edge[] = [
    edge(manifest.id, 'edge-ui-to-cmd', 'roleIssuesCommand', 'ui.checkout', 'cmd.submit-order'),
    edge(manifest.id, 'edge-cmd-to-evt', 'commandCausesEvent', 'cmd.submit-order', 'evt.order-submitted'),
    edge(manifest.id, 'edge-evt-to-vm', 'eventRefreshesViewModel', 'evt.order-submitted', 'vm.order-detail'),
    edge(manifest.id, 'edge-vm-to-pay', 'viewModelConsumedByUiOrProcessor', 'vm.order-detail', 'ui.pay-order-action'),
  ];

  for (const item of nodes) workspace.saveNode(item);
  for (const item of edges) workspace.saveEdge(item);

  return {
    workspace,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

function node(projectId: string, canonicalId: string, kind: Node['kind'], displayName: string): Node {
  return { id: canonicalId, projectId, kind, canonicalId, displayName, tags: [], domains: [] };
}

function edge(projectId: string, id: string, type: Edge['type'], fromNodeId: string, toNodeId: string): Edge {
  return { id, projectId, type, fromNodeId, toNodeId };
}
