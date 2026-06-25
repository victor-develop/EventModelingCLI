import { Workspace } from '../src/workspace/workspace';
import { routeCommand } from '../src/cli/router';
import * as fs from 'node:fs';
import * as path from 'node:path';

function em(ws: Workspace, ...args: string[]) {
  const r = routeCommand(ws, args);
  if (!r.ok) {
    console.error(`FAIL: em ${args.join(' ')} — ${r.error?.message}`);
    process.exit(1);
  }
  return r;
}

// Create temp workspace
const tmpDir = fs.mkdtempSync('/tmp/em-hotel-viewer-');
const ws = new Workspace(tmpDir);

// Phase 1: Project + Draft
em(ws, 'project', 'init', 'Hotel-Booking');
em(ws, 'draft', 'start', '--n', 'Hotel-booking-flow');

// Phase 2: Create all nodes
em(ws, 'cmd', 'new', 'hotel.cmd.BookRoom');
em(ws, 'cmd', 'new', 'hotel.cmd.CancelBooking');
em(ws, 'cmd', 'new', 'hotel.cmd.Checkout');
em(ws, 'evt', 'new', 'hotel.evt.RoomBooked');
em(ws, 'evt', 'new', 'hotel.evt.BookingCancelled');
em(ws, 'evt', 'new', 'hotel.evt.CheckoutCompleted');
em(ws, 'view', 'new', 'hotel.view.BookingSummary');
em(ws, 'view', 'new', 'hotel.view.RoomAvailability');
em(ws, 'proc', 'new', 'hotel.proc.BookingValidator');
em(ws, 'trigger', 'new', 'hotel.trigger.CheckoutReminder');

// Phase 3: Link edges
em(ws, 'link', 'cmd->evt', 'hotel.cmd.BookRoom', 'hotel.evt.RoomBooked');
em(ws, 'link', 'cmd->evt', 'hotel.cmd.CancelBooking', 'hotel.evt.BookingCancelled');
em(ws, 'link', 'cmd->evt', 'hotel.cmd.Checkout', 'hotel.evt.CheckoutCompleted');
em(ws, 'link', 'evt->view', 'hotel.evt.RoomBooked', 'hotel.view.BookingSummary');
em(ws, 'link', 'evt->view', 'hotel.evt.RoomBooked', 'hotel.view.RoomAvailability');
em(ws, 'link', 'evt->view', 'hotel.evt.BookingCancelled', 'hotel.view.RoomAvailability');
em(ws, 'link', 'evt->view', 'hotel.evt.BookingCancelled', 'hotel.view.BookingSummary');
em(ws, 'link', 'evt->view', 'hotel.evt.CheckoutCompleted', 'hotel.view.BookingSummary');

// Phase 4: UI + Trigger + Proc bindings
em(ws, 'ui', 'add', 'page', '--name', 'Booking-Page');
em(ws, 'ui', 'add', 'form', '--name', 'Booking-Form', '--parent', 'ui.page.booking-page');
em(ws, 'ui', 'bind-view', '--ui', 'ui.form.booking-form', '--view', 'hotel.view.BookingSummary', '--fields', 'booking_id,guest_name');
em(ws, 'ui', 'expose-cmd', '--role', 'guest', '--ui', 'ui.form.booking-form', '--cmd', 'hotel.cmd.BookRoom');
em(ws, 'trigger', 'issues-cmd', '--trigger', 'hotel.trigger.CheckoutReminder', '--cmd', 'hotel.cmd.Checkout');
em(ws, 'proc', 'bind-view', '--proc', 'hotel.proc.BookingValidator', '--view', 'hotel.view.RoomAvailability', '--fields', 'room_id');

// Extract graph data
const nodes = ws.listNodes();
const edges = ws.listEdges();

const output = {
  focusNodeId: 'hotel.cmd.BookRoom',
  nodes: nodes.map(n => ({
    id: n.id,
    projectId: n.projectId,
    kind: n.kind,
    canonicalId: n.canonicalId,
    displayName: n.displayName,
    tags: n.tags,
    domains: n.domains,
    role: n.role ?? undefined,
  })),
  edges: edges.map(e => ({
    id: e.id,
    projectId: e.projectId,
    type: e.type,
    fromNodeId: e.fromNodeId,
    toNodeId: e.toNodeId,
    viaNodeId: e.viaNodeId ?? undefined,
    meta: e.meta ?? undefined,
  })),
};

// Write output
const outDir = path.join(process.cwd(), 'em-viewer', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'hotel-graph.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`✅ Generated: ${outPath}`);
console.log(`   ${nodes.length} nodes, ${edges.length} edges`);

// Cleanup
fs.rmSync(tmpDir, { recursive: true });
