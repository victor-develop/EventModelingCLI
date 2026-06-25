import { Workspace } from '../src/workspace/workspace';
import { routeCommand } from '../src/cli/router';
import { LayoutEngine } from '../src/layout/layout-engine';
import { NormalizedPathEnvelope, Occurrence, RenderedEdge } from '../src/layout/types';
import { EdgeType } from '../src/domain/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

function em(ws: Workspace, ...args: string[]) {
  const r = routeCommand(ws, args);
  if (!r.ok) { console.error(`FAIL: em ${args.join(' ')} — ${r.error?.message}`); process.exit(1); }
  return r;
}

const tmpDir = fs.mkdtempSync('/tmp/em-hotel-render-');
const ws = new Workspace(tmpDir);

em(ws, 'project', 'init', 'Hotel-Booking');
em(ws, 'draft', 'start', '--n', 'Hotel-booking-flow');
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

em(ws, 'link', 'cmd->evt', 'hotel.cmd.BookRoom', 'hotel.evt.RoomBooked');
em(ws, 'link', 'cmd->evt', 'hotel.cmd.CancelBooking', 'hotel.evt.BookingCancelled');
em(ws, 'link', 'cmd->evt', 'hotel.cmd.Checkout', 'hotel.evt.CheckoutCompleted');
em(ws, 'link', 'evt->view', 'hotel.evt.RoomBooked', 'hotel.view.BookingSummary');
em(ws, 'link', 'evt->view', 'hotel.evt.RoomBooked', 'hotel.view.RoomAvailability');
em(ws, 'link', 'evt->view', 'hotel.evt.BookingCancelled', 'hotel.view.RoomAvailability');
em(ws, 'link', 'evt->view', 'hotel.evt.BookingCancelled', 'hotel.view.BookingSummary');
em(ws, 'link', 'evt->view', 'hotel.evt.CheckoutCompleted', 'hotel.view.BookingSummary');
em(ws, 'view', 'field', 'add', 'hotel.view.BookingSummary', '--field-id', 'booking_id', '--name', 'bookingId', '--type', 'string', '--from-event', 'hotel.evt.RoomBooked', '--path', 'bookingId');
em(ws, 'view', 'field', 'add', 'hotel.view.BookingSummary', '--field-id', 'guest_name', '--name', 'guestName', '--type', 'string', '--from-event', 'hotel.evt.RoomBooked', '--path', 'guestName');
em(ws, 'view', 'field', 'add', 'hotel.view.RoomAvailability', '--field-id', 'room_id', '--name', 'roomId', '--type', 'string', '--from-event', 'hotel.evt.RoomBooked', '--path', 'roomId');
em(ws, 'ui', 'add', 'page', '--name', 'Booking-Page');
em(ws, 'ui', 'add', 'form', '--name', 'Booking-Form', '--parent', 'ui.page.booking-page');
em(ws, 'ui', 'bind-view', '--ui', 'ui.form.booking-form', '--view', 'hotel.view.BookingSummary', '--fields', 'booking_id,guest_name');
em(ws, 'ui', 'expose-cmd', '--role', 'guest', '--ui', 'ui.form.booking-form', '--cmd', 'hotel.cmd.BookRoom');
em(ws, 'trigger', 'issues-cmd', '--trigger', 'hotel.trigger.CheckoutReminder', '--cmd', 'hotel.cmd.Checkout');
em(ws, 'proc', 'bind-view', '--proc', 'hotel.proc.BookingValidator', '--view', 'hotel.view.RoomAvailability', '--fields', 'room_id');

const envelope: NormalizedPathEnvelope = {
  anchor: { nodeId: 'hotel.cmd.BookRoom' },
  branches: [
    { branchId: 'book_summary', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
      { type: 'edge', edgeId: 'e1', edgeType: 'commandCausesEvent' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
      { type: 'edge', edgeId: 'e4', edgeType: 'eventRefreshesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
    ]},
    { branchId: 'book_avail', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
      { type: 'edge', edgeId: 'e1b', edgeType: 'commandCausesEvent' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.evt.RoomBooked', nodeKind: 'evt' },
      { type: 'edge', edgeId: 'e5', edgeType: 'eventRefreshesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
    ]},
    { branchId: 'cancel_summary', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
      { type: 'edge', edgeId: 'e2', edgeType: 'commandCausesEvent' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
      { type: 'edge', edgeId: 'e7', edgeType: 'eventRefreshesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
    ]},
    { branchId: 'cancel_avail', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.cmd.CancelBooking', nodeKind: 'cmd' },
      { type: 'edge', edgeId: 'e2b', edgeType: 'commandCausesEvent' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.evt.BookingCancelled', nodeKind: 'evt' },
      { type: 'edge', edgeId: 'e6', edgeType: 'eventRefreshesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
    ]},
    { branchId: 'checkout_flow', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.trigger.CheckoutReminder', nodeKind: 'trigger' },
      { type: 'edge', edgeId: 'e10', edgeType: 'processorOrTriggerIssuesCommand' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.cmd.Checkout', nodeKind: 'cmd' },
      { type: 'edge', edgeId: 'e3', edgeType: 'commandCausesEvent' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.evt.CheckoutCompleted', nodeKind: 'evt' },
      { type: 'edge', edgeId: 'e8', edgeType: 'eventRefreshesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.BookingSummary', nodeKind: 'viewModel' },
    ]},
    { branchId: 'ui_backward', direction: 'backward', path: [
      { type: 'node', nodeId: 'ui.form.booking-form', nodeKind: 'ui.form' },
      { type: 'edge', edgeId: 'e_ui1', edgeType: 'roleUsesUIToIssueCommand' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.cmd.BookRoom', nodeKind: 'cmd' },
    ]},
    { branchId: 'proc_validator', direction: 'forward', path: [
      { type: 'node', nodeId: 'hotel.proc.BookingValidator', nodeKind: 'proc' },
      { type: 'edge', edgeId: 'e_proc1', edgeType: 'uiOrProcessorConsumesViewModel' as EdgeType, displayDirection: 'forward' },
      { type: 'node', nodeId: 'hotel.view.RoomAvailability', nodeKind: 'viewModel' },
    ]},
  ],
  frontier: {},
};

const engine = new LayoutEngine();
const state = engine.initLayout(envelope);
const allOccs = Object.values(state.occurrences);
const allEdges = Object.values(state.displayEdges);

const occsJson = JSON.stringify(allOccs.map(o => ({ ...o, displayName: shortName(o.canonicalNodeId), color: nodeColor(o.nodeKind) })));
const edgesJson = JSON.stringify(allEdges);
const lanesJson = JSON.stringify(state.swimlaneRects.map(r => ({
  key: r.lane,
  label: r.lane === 'shared' ? 'UI / Trigger / Processor' : r.lane === 'commandViewModel' ? 'Command / ViewModel' : 'Event',
  y: r.y,
  h: r.height,
})));
const pad = 180;
const offX = -(Math.min(...allOccs.map(o => o.x))) + pad;
const offY = -(Math.min(...allOccs.map(o => o.y))) + pad;

function shortName(id: string) { const p = id.split('.'); return p[p.length - 1] ?? id; }
function nodeColor(k: string) { return k === 'cmd' ? '#4A90D9' : k === 'evt' ? '#7B68EE' : k === 'viewModel' ? '#2ECC71' : '#F39C12'; }

const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hotel Booking — Event Modeling</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f1a;font-family:Inter,-apple-system,sans-serif;overflow:hidden}#C{display:block;cursor:grab}#C:active{cursor:grabbing}
#hd{position:fixed;top:20px;left:24px;z-index:10}#hd h1{color:#fff;font-size:20px;font-weight:700}#hd h1 span{color:#7B68EE}#hd p{color:#555;font-size:12px;margin-top:4px}
#lg{position:fixed;top:16px;right:16px;background:rgba(15,15,26,.94);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px 18px;color:#bbb;font-size:13px;z-index:10;backdrop-filter:blur(12px)}
#lg h3{margin-bottom:8px;color:#fff;font-size:14px}.li{display:flex;align-items:center;gap:10px;margin:4px 0}.ld{width:14px;height:14px;border-radius:4px}
#zi{position:fixed;bottom:20px;left:24px;color:#444;font-size:11px;z-index:10;font-family:monospace}
</style></head><body>
<div id="hd"><h1>🏨 Hotel Booking — <span>Event Modeling</span></h1><p>Infinite Canvas Layout • Drag to pan • Scroll to zoom</p></div>
<div id="lg"><h3>Node Types</h3>
<div class="li"><div class="ld" style="background:#4A90D9"></div>Command</div>
<div class="li"><div class="ld" style="background:#7B68EE"></div>Event</div>
<div class="li"><div class="ld" style="background:#2ECC71"></div>ViewModel</div>
<div class="li"><div class="ld" style="background:#F39C12"></div>UI / Trigger / Proc</div>
</div><div id="zi">zoom: 100%</div><canvas id="C"></canvas>
<script>
const O=${occsJson},E=${edgesJson},L=${lanesJson},OX=${offX},OY=${offY};
const c=document.getElementById('C'),x=c.getContext('2d');
let s=1,px=40,py=30,d=false,lx,ly;
function rs(){c.width=innerWidth;c.height=innerHeight;dr()}
function dr(){x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);x.setTransform(s,0,0,s,px,py);
lb();ls();de();dn()}
function lb(){for(const l of L){x.fillStyle=l.key==='shared'?'rgba(243,156,18,.03)':l.key==='event'?'rgba(123,104,238,.03)':'rgba(74,144,217,.03)';
x.fillRect(-500+OX,l.y+OY,15000,l.h);x.font='bold 11px monospace';x.fillStyle='rgba(255,255,255,.1)';x.textAlign='left';x.fillText(l.label.toUpperCase(),-100+OX,l.y+14+OY)}}
function ls(){x.strokeStyle='rgba(255,255,255,.04)';x.lineWidth=1;x.setLineDash([8,6]);
for(const l of L){x.beginPath();x.moveTo(-500+OX,l.y+l.h+OY);x.lineTo(14500+OX,l.y+l.h+OY);x.stroke()}x.setLineDash([])}
function dn(){for(const n of O){const nx=n.x+OX,ny=n.y+OY,w=n.width,h=n.height,r=8;
x.save();x.shadowColor=n.color;x.shadowBlur=16;
x.beginPath();x.moveTo(nx+r,ny);x.lineTo(nx+w-r,ny);x.arcTo(nx+w,ny,nx+w,ny+r,r);x.lineTo(nx+w,ny+h-r);x.arcTo(nx+w,ny+h,nx+w-r,ny+h,r);
x.lineTo(nx+r,ny+h);x.arcTo(nx,ny+h,nx,ny+h-r,r);x.lineTo(nx,ny+r);x.arcTo(nx,ny,nx+r,ny,r);x.closePath();
x.fillStyle=n.color+'33';x.fill();x.strokeStyle=n.color+'bb';x.lineWidth=1.5;x.stroke();x.restore();
x.font='bold 12px Inter,sans-serif';x.fillStyle='#eee';x.textAlign='center';x.textBaseline='middle';x.fillText(n.displayName,nx+w/2,ny+h/2-4);
x.font='9px monospace';x.fillStyle=n.color+'88';x.fillText(n.nodeKind,nx+w/2,ny+h-7)}}
function de(){for(const e of E){if(!e.points||e.points.length<2)continue;const cl=ec(e.kind);
x.beginPath();x.moveTo(e.points[0][0]+OX,e.points[0][1]+OY);for(let i=1;i<e.points.length;i++)x.lineTo(e.points[i][0]+OX,e.points[i][1]+OY);
x.strokeStyle=cl+'88';x.lineWidth=2;x.stroke();
const la=e.points[e.points.length-1],pv=e.points[e.points.length-2];if(la&&pv)ar(pv[0]+OX,pv[1]+OY,la[0]+OX,la[1]+OY,cl)}}
function ec(k){return k==='shared-to-cmd'?'#F39C12':k==='cmd-to-evt'?'#4A90D9':k==='evt-to-viewModel'?'#7B68EE':k==='viewModel-to-shared'?'#2ECC71':'#555'}
function ar(fx,fy,tx,ty,cl){const a=Math.atan2(ty-fy,tx-fx),l=10;x.beginPath();x.moveTo(tx,ty);x.lineTo(tx-l*Math.cos(a-Math.PI/7),ty-l*Math.sin(a-Math.PI/7));
x.moveTo(tx,ty);x.lineTo(tx-l*Math.cos(a+Math.PI/7),ty-l*Math.sin(a+Math.PI/7));x.strokeStyle=cl+'cc';x.lineWidth=2.5;x.stroke()}
c.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.08:.93,mx=e.offsetX,my=e.offsetY;px=mx-(mx-px)*f;py=my-(my-py)*f;s*=f;s=Math.max(.2,Math.min(4,s));
document.getElementById('zi').textContent='zoom: '+Math.round(s*100)+'%';dr()},{passive:false});
c.addEventListener('mousedown',e=>{d=true;lx=e.clientX;ly=e.clientY});
c.addEventListener('mousemove',e=>{if(!d)return;px+=e.clientX-lx;py+=e.clientY-ly;lx=e.clientX;ly=e.clientY;dr()});
c.addEventListener('mouseup',()=>{d=false});c.addEventListener('mouseleave',()=>{d=false});
addEventListener('resize',rs);rs();
</script></body></html>`;

fs.writeFileSync(path.join(process.cwd(), 'hotel-booking-canvas.html'), html);
console.log(`\n✅ Generated: hotel-booking-canvas.html`);
console.log(`   ${allOccs.length} nodes, ${allEdges.length} edges`);
fs.rmSync(tmpDir, { recursive: true });
