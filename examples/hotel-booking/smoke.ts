import { Workspace } from '../../packages/cli/src/workspace/workspace';
import { routeCommand } from '../../packages/cli/src/cli/router';
import * as fs from 'node:fs';
import * as path from 'node:path';

let failures = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    failures++;
  } else {
    console.log(`  ✅ ${msg}`);
  }
}

function run(ws: Workspace, cmd: string): any {
  const args = cmd.replace(/^em\s+/, '').split(/\s+/);
  const result = routeCommand(ws, args);
  if (!result.ok) {
    console.error(`  ⚠️  Command "em ${cmd}" failed: ${result.error?.code} — ${result.error?.message}`);
    failures++;
    return null;
  }
  return result;
}

const tmpDir = fs.mkdtempSync('/tmp/em-hotel-test-');
console.log(`\n📁 Working dir: ${tmpDir}\n`);

const ws = new Workspace(tmpDir);

// ========== PHASE 1: Project Setup ==========
console.log('=== Phase 1: Project Setup ===');
{
  const r = run(ws, 'em project init Hotel Booking');
  assert(r !== null, 'project init succeeds');
  assert(r?.data?.project?.name === 'Hotel Booking', 'project name is correct');
  assert(r?.data?.project?.id === 'proj_hotel-booking', 'project id is correct');
}

{
  const r = run(ws, 'em ctx');
  assert(r?.data?.project?.name === 'Hotel Booking', 'ctx shows project');
}

{
  const r = run(ws, 'em draft start --n Add hotel booking flow');
  assert(r !== null, 'draft start succeeds');
  assert(r?.data?.draft?.status === 'open', 'draft is open');
}

// ========== PHASE 2: Create Nodes ==========
console.log('\n=== Phase 2: Create Nodes ===');

{
  const r = run(ws, 'em cmd new hotel.cmd.book-room');
  assert(r !== null, 'cmd new BookRoom succeeds');
  assert(r?.data?.node?.canonicalId === 'hotel.cmd.book-room', 'BookRoom canonicalId correct');
  assert(r?.data?.node?.kind === 'cmd', 'BookRoom kind is cmd');
}

{
  const r = run(ws, 'em cmd new hotel.cmd.cancel-booking');
  assert(r !== null, 'cmd new CancelBooking succeeds');
}

{
  const r = run(ws, 'em cmd new hotel.cmd.checkout');
  assert(r !== null, 'cmd new Checkout succeeds');
}

{
  const r = run(ws, 'em evt new hotel.evt.room-booked');
  assert(r !== null, 'evt new RoomBooked succeeds');
  assert(r?.data?.node?.canonicalId === 'hotel.evt.room-booked', 'RoomBooked canonicalId correct');
}

{
  const r = run(ws, 'em evt new hotel.evt.booking-cancelled');
  assert(r !== null, 'evt new BookingCancelled succeeds');
}

{
  const r = run(ws, 'em evt new hotel.evt.checkout-completed');
  assert(r !== null, 'evt new CheckoutCompleted succeeds');
}

{
  const r = run(ws, 'em view new hotel.view.booking-summary');
  assert(r !== null, 'view new BookingSummary succeeds');
  assert(r?.data?.node?.kind === 'viewModel', 'BookingSummary kind is viewModel');
}

{
  const r = run(ws, 'em view new hotel.view.room-availability');
  assert(r !== null, 'view new RoomAvailability succeeds');
}

{
  const r = run(ws, 'em proc new hotel.proc.booking-validator');
  assert(r !== null, 'proc new BookingValidator succeeds');
}

{
  const r = run(ws, 'em trigger new hotel.trigger.checkout-reminder');
  assert(r !== null, 'trigger new CheckoutReminder succeeds');
}

// ========== PHASE 3: Link Nodes ==========
console.log('\n=== Phase 3: Link Nodes ===');

{
  const r = run(ws, 'em link cmd->evt hotel.cmd.book-room hotel.evt.room-booked');
  assert(r !== null, 'link BookRoom -> RoomBooked succeeds');
  assert(r?.data?.edge?.type === 'commandCausesEvent', 'edge type is commandCausesEvent');
}

{
  const r = run(ws, 'em link cmd->evt hotel.cmd.cancel-booking hotel.evt.booking-cancelled');
  assert(r !== null, 'link CancelBooking -> BookingCancelled succeeds');
}

{
  const r = run(ws, 'em link cmd->evt hotel.cmd.checkout hotel.evt.checkout-completed');
  assert(r !== null, 'link Checkout -> CheckoutCompleted succeeds');
}

{
  const r = run(ws, 'em link evt->view hotel.evt.room-booked hotel.view.booking-summary');
  assert(r !== null, 'link RoomBooked -> BookingSummary succeeds');
  assert(r?.data?.edge?.type === 'eventRefreshesViewModel', 'edge type is eventRefreshesViewModel');
}

{
  const r = run(ws, 'em link evt->view hotel.evt.room-booked hotel.view.room-availability');
  assert(r !== null, 'link RoomBooked -> RoomAvailability succeeds');
}

{
  const r = run(ws, 'em link evt->view hotel.evt.booking-cancelled hotel.view.room-availability');
  assert(r !== null, 'link BookingCancelled -> RoomAvailability succeeds');
}

{
  const r = run(ws, 'em link evt->view hotel.evt.booking-cancelled hotel.view.booking-summary');
  assert(r !== null, 'link BookingCancelled -> BookingSummary succeeds');
}

{
  const r = run(ws, 'em link evt->view hotel.evt.checkout-completed hotel.view.booking-summary');
  assert(r !== null, 'link CheckoutCompleted -> BookingSummary succeeds');
}

// ========== PHASE 4: View Fields ==========
console.log('\n=== Phase 4: View Fields ===');

{
  const r = run(ws, 'em view field add hotel.view.booking-summary --field-id booking_id --name bookingId --type string --from-event hotel.evt.room-booked --path bookingId');
  assert(r !== null, 'field add booking_id succeeds');
}

{
  const r = run(ws, 'em view field add hotel.view.booking-summary --field-id guest_name --name guestName --type string --from-event hotel.evt.room-booked --path guestName');
  assert(r !== null, 'field add guest_name succeeds');
}

{
  const r = run(ws, 'em view field add hotel.view.booking-summary --field-id room_number --name roomNumber --type string --from-event hotel.evt.room-booked --path roomNumber --nullable');
  assert(r !== null, 'field add room_number (nullable) succeeds');
}

{
  const r = run(ws, 'em view field add hotel.view.room-availability --field-id room_id --name roomId --type string --from-event hotel.evt.room-booked --path roomId');
  assert(r !== null, 'field add room_id succeeds');
}

{
  const r = run(ws, 'em view schema show hotel.view.booking-summary');
  assert(r !== null, 'view schema show succeeds');
  assert(r?.data?.fields?.length === 3, `BookingSummary has 3 fields (got ${r?.data?.fields?.length})`);
}

{
  const r = run(ws, 'em view schema show hotel.view.room-availability');
  assert(r?.data?.fields?.length === 1, `RoomAvailability has 1 field (got ${r?.data?.fields?.length})`);
}

// ========== PHASE 5: Proc & Trigger bindings ==========
console.log('\n=== Phase 5: Proc & Trigger Bindings ===');

{
  const r = run(ws, 'em proc bind-view --proc hotel.proc.booking-validator --view hotel.view.room-availability --fields room_id');
  assert(r !== null, 'proc bind-view succeeds');
}

{
  const r = run(ws, 'em link evt->proc hotel.evt.room-booked hotel.proc.booking-validator');
  assert(r !== null, 'link RoomBooked -> BookingValidator succeeds');
  assert(r?.data?.edge?.type === 'eventUpdatesProcessor', 'edge type is eventUpdatesProcessor');
}

{
  const r = run(ws, 'em trigger issues-cmd --trigger hotel.trigger.checkout-reminder --cmd hotel.cmd.checkout');
  assert(r !== null, 'trigger issues-cmd succeeds');
}

// ========== PHASE 6: Story ==========
console.log('\n=== Phase 6: Story ===');

{
  const r = run(ws, 'em story add epic --title Hotel-Booking-Management --role guest');
  assert(r !== null, 'story add epic succeeds');
}

{
  const r = run(ws, 'em story add feature --title Book-a-room --parent story.hotel-booking-management');
  assert(r !== null, 'story add feature succeeds');
}

{
  const r = run(ws, 'em story tree');
  assert(r !== null, 'story tree succeeds');
  assert(r?.data?.tree?.length >= 1, 'story tree has at least 1 root');
  console.log('  📋 Story tree:', JSON.stringify(r?.data?.tree, null, 2).slice(0, 300));
}

// ========== PHASE 7: UI ==========
console.log('\n=== Phase 7: UI ===');

{
  const r = run(ws, 'em ui add page --name Booking-Page');
  assert(r !== null, 'ui add page succeeds');
}

{
  const r = run(ws, 'em ui add form --name Booking-Form --parent ui.page.booking-page');
  assert(r !== null, 'ui add form succeeds');
}

{
  const r = run(ws, 'em ui bind-view --ui ui.form.booking-form --view hotel.view.booking-summary --fields booking_id,guest_name');
  assert(r !== null, 'ui bind-view succeeds');
  assert(r?.data?.edge?.type === 'viewModelConsumedByUiOrProcessor', 'ui bind-view creates a view model consumption edge');
  assert(r?.data?.edge?.toNodeId === 'ui.form.booking-form', 'ui bind-view points at the booking form');
}

{
  const r = run(ws, 'em role issues-cmd --role guest --via ui.form.booking-form --cmd hotel.cmd.book-room');
  assert(r !== null, 'role issues-cmd succeeds');
  assert(r?.data?.edge?.viaNodeId === 'ui.form.booking-form', 'role issues-cmd records the booking form as its surface');
}

{
  const r = run(ws, 'em ui tree');
  assert(r !== null, 'ui tree succeeds');
  console.log('  📋 UI tree:', JSON.stringify(r?.data?.tree, null, 2).slice(0, 300));
}

// ========== PHASE 8: Show, Neighbors, Walk, Trace, Graph ==========
console.log('\n=== Phase 8: Graph Commands ===');

{
  const r = run(ws, 'em show hotel.cmd.book-room');
  assert(r !== null, 'show BookRoom succeeds');
  assert(r?.data?.node?.canonicalId === 'hotel.cmd.book-room', 'show returns correct node');
  assert(r?.data?.relations?.outgoing?.length >= 1, 'BookRoom has at least 1 outgoing edge');
  console.log('  📊 show outgoing edges:', r?.data?.relations?.outgoing);
}

{
  const r = run(ws, 'em neighbors --node hotel.cmd.book-room --direction out');
  assert(r !== null, 'neighbors out succeeds');
  assert(r?.data?.neighbors?.length >= 1, 'BookRoom has at least 1 neighbor');
  console.log('  📊 neighbors:', r?.data?.neighbors?.map((n: any) => n.nodeId));
}

{
  const r = run(ws, 'em neighbors --node hotel.evt.room-booked --direction in');
  assert(r !== null, 'neighbors in for RoomBooked succeeds');
  const neighbors = r?.data?.neighbors?.map((n: any) => n.nodeId);
  assert(neighbors?.includes('hotel.cmd.book-room'), 'RoomBooked incoming includes BookRoom');
}

{
  const r = run(ws, 'em neighbors --node hotel.evt.room-booked --direction both');
  assert(r !== null, 'neighbors both succeeds');
  console.log('  📊 RoomBooked neighbors (both):', r?.data?.neighbors?.map((n: any) => `${n.direction}:${n.nodeId}`));
}

{
  const r = run(ws, 'em walk --from hotel.cmd.book-room --direction forward');
  assert(r !== null, 'walk forward succeeds');
  assert(r?.data?.subgraph?.branches?.length >= 1 || r?.data?.subgraph?.forwardBranches?.length >= 1, 'walk returns branches');
  console.log('  📊 walk forward branches:', JSON.stringify(r?.data?.subgraph).slice(0, 500));
}

{
  const r = run(ws, 'em walk --from hotel.view.booking-summary --direction backward');
  assert(r !== null, 'walk backward succeeds');
  console.log('  📊 walk backward branches:', JSON.stringify(r?.data?.subgraph).slice(0, 500));
}

{
  const r = run(ws, 'em walk --from hotel.cmd.book-room --direction both');
  assert(r !== null, 'walk both succeeds');
}

{
  const r = run(ws, 'em trace --from hotel.cmd.book-room --to hotel.view.booking-summary');
  assert(r !== null, 'trace succeeds');
  assert(r?.data?.paths?.length >= 1, 'trace finds at least 1 path');
  console.log('  📊 trace paths:', JSON.stringify(r?.data?.paths));
}

{
  const r = run(ws, 'em trace --from hotel.cmd.cancel-booking --to hotel.view.room-availability');
  assert(r !== null, 'trace CancelBooking -> RoomAvailability succeeds');
  assert(r?.data?.paths?.length >= 1, 'trace finds path CancelBooking -> RoomAvailability');
}

{
  const r = run(ws, 'em graph');
  assert(r !== null, 'graph succeeds');
  assert(r?.data?.graph?.includes('graph TD'), 'graph output contains mermaid header');
  console.log('  📊 graph:\n' + r?.data?.graph);
}

{
  const r = run(ws, 'em graph --focus hotel.cmd.book-room --depth 2');
  assert(r !== null, 'graph with focus succeeds');
  console.log('  📊 focused graph:\n' + r?.data?.graph);
}

{
  const r = run(ws, 'em layout --focus hotel.view.booking-summary --direction forward --hops 1 --include-truncated-paths --format json');
  assert(r !== null, 'layout from BookingSummary succeeds');
  assert(
    r?.data?.occurrences?.some((occurrence: any) => occurrence.canonicalNodeId === 'ui.form.booking-form'),
    'layout includes the UI form that consumes BookingSummary',
  );
}

{
  const r = run(ws, 'em layout --focus ui.form.booking-form --direction backward --hops 2 --format json');
  assert(r !== null, 'layout from the UI form succeeds');
  assert(
    r?.data?.occurrences?.some((occurrence: any) => occurrence.canonicalNodeId === 'ui.form.booking-form'),
    'a truncated UI-form focus still renders the focus node',
  );
}

// ========== PHASE 9: Draft Status & Validate ==========
console.log('\n=== Phase 9: Draft Status & Validate ===');

{
  const r = run(ws, 'em draft status');
  assert(r !== null, 'draft status succeeds');
  console.log('  📊 draft summary:', JSON.stringify(r?.data?.summary));
}

{
  const r = run(ws, 'em draft diff');
  assert(r !== null, 'draft diff succeeds');
  console.log('  📊 diff nodes added:', r?.data?.diff?.nodesAdded);
  console.log('  📊 diff edges added:', r?.data?.diff?.edgesAdded);
}

{
  const r = run(ws, 'em validate');
  assert(r !== null, 'validate succeeds');
  console.log('  📊 valid:', r?.data?.valid);
  if (r?.data?.errors?.length > 0) {
    console.log('  ⚠️  validation errors:', JSON.stringify(r?.data?.errors, null, 2));
  }
}

// ========== PHASE 10: Submit & Versions ==========
console.log('\n=== Phase 10: Submit & Versions ===');

{
  const r = run(ws, 'em submit --m Add-hotel-booking-flow-v1');
  assert(r !== null, 'submit succeeds');
  assert(r?.data?.newRevision?.id, 'submit creates a revision');
  console.log('  📊 revision:', r?.data?.newRevision);
}

{
  const r = run(ws, 'em versions');
  assert(r !== null, 'versions succeeds');
  assert(r?.data?.revisions?.length >= 1, 'has at least 1 revision');
  console.log('  📊 revisions:', r?.data?.revisions?.map((rev: any) => rev.id));
}

// ========== PHASE 11: Check generated files ==========
console.log('\n=== Phase 11: Check Generated Files ===');

const projectDir = path.join(tmpDir, 'projects', 'hotel-booking');
assert(fs.existsSync(projectDir), 'project dir exists');
assert(fs.existsSync(path.join(projectDir, 'mp.yaml')), 'mp.yaml (manifest) exists');
assert(fs.existsSync(path.join(projectDir, 'nodes')), 'nodes dir exists');
assert(fs.existsSync(path.join(projectDir, 'edges')), 'edges dir exists');
assert(fs.existsSync(path.join(projectDir, 'view-model-schemas')), 'view-model-schemas dir exists');
assert(fs.existsSync(path.join(projectDir, 'revisions')), 'revisions dir exists');

const nodeFiles = fs.readdirSync(path.join(projectDir, 'nodes'));
console.log(`  📁 node files (${nodeFiles.length}):`, nodeFiles);
assert(nodeFiles.length >= 10, `expected >=10 node files, got ${nodeFiles.length}`);
assert(nodeFiles.includes('ui.page.booking-page.yaml'), 'UI page node file exists');
assert(nodeFiles.includes('ui.form.booking-form.yaml'), 'UI form node file exists');

const edgeFiles = fs.readdirSync(path.join(projectDir, 'edges'));
console.log(`  📁 edge files (${edgeFiles.length}):`, edgeFiles);
assert(edgeFiles.length >= 8, `expected >=8 edge files, got ${edgeFiles.length}`);

const bookRoomYaml = fs.readFileSync(path.join(projectDir, 'nodes', 'hotel.cmd.book-room.yaml'), 'utf-8');
assert(bookRoomYaml.includes('kind: cmd'), 'BookRoom YAML has kind: cmd');
assert(bookRoomYaml.includes('canonicalId: hotel.cmd.book-room'), 'BookRoom YAML has correct canonicalId');
console.log('  📄 hotel.cmd.book-room.yaml:\n' + bookRoomYaml.split('\n').map(l => '    ' + l).join('\n'));

const vmSchemaDir = path.join(projectDir, 'view-model-schemas');
const schemaFiles = fs.readdirSync(vmSchemaDir);
console.log(`  📁 view-model-schema files (${schemaFiles.length}):`, schemaFiles);

const bookingSchema = fs.readFileSync(path.join(vmSchemaDir, 'hotel.view.booking-summary.schema.yaml'), 'utf-8');
assert(bookingSchema.includes('booking_id'), 'schema has booking_id field');
assert(bookingSchema.includes('guest_name'), 'schema has guest_name field');
assert(bookingSchema.includes('room_number'), 'schema has room_number field');
console.log('  📄 BookingSummary schema:\n' + bookingSchema.split('\n').map(l => '    ' + l).join('\n'));

const revFiles = fs.readdirSync(path.join(projectDir, 'revisions'));
console.log(`  📁 revision files (${revFiles.length}):`, revFiles);
assert(revFiles.length >= 1, 'has at least 1 revision file');

const contextYaml = fs.readFileSync(path.join(tmpDir, '.mp-cache', 'context.yaml'), 'utf-8');
assert(contextYaml.includes('proj_hotel-booking'), 'context has project reference');
console.log('  📄 context.yaml:\n' + contextYaml.split('\n').map(l => '    ' + l).join('\n'));

// ========== PHASE 12: Review ==========
console.log('\n=== Phase 12: Review ===');

{
  const r = run(ws, 'em review impact evt hotel.evt.room-booked');
  assert(r !== null, 'review impact evt succeeds');
  console.log('  📊 RoomBooked impact:', JSON.stringify(r?.data, null, 2));
  assert(r?.data?.affectedViewModels?.length >= 1, 'RoomBooked affects at least 1 viewModel');
  assert(
    r?.data?.affectedViewModels?.includes('hotel.view.booking-summary') ||
    r?.data?.affectedViewModels?.includes('hotel.view.room-availability'),
    'RoomBooked affects BookingSummary or RoomAvailability'
  );
}

{
  const r = run(ws, 'em review impact field hotel.view.booking-summary booking_id');
  assert(r !== null, 'review impact field succeeds');
  console.log('  📊 booking_id field impact:', JSON.stringify(r?.data, null, 2));
}

// ========== CLEANUP ==========
console.log('\n=== Summary ===');
if (failures === 0) {
  console.log('🎉 All checks passed! Hotel booking event model is complete and correct.');
} else {
  console.error(`\n❌ ${failures} failure(s) found.`);
  process.exit(1);
}

if (process.env.EM_KEEP_SMOKE_WORKSPACE === '1') {
  console.log(`\nWorkspace kept at: ${tmpDir}`);
} else {
  fs.rmSync(tmpDir, { recursive: true });
}
