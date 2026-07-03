---
title: "Output — ASCII Graph"
notion_id: 7f20c1ca-08e6-4945-8f2c-a830dd77b976
synced_at: 2026-07-03T13:43:24.911Z
---


```plain text
PROJECT: Order Management
FOCUS: cmd.submit-order

STAGES
0 -> 1 -> 2 -> 3

LANE shared
[stage 0 row 0] ui.checkout
name: Checkout UI
out: cmd.submit-order

[stage 0 row 1] ui.admin
name: Admin UI
out: cmd.approve-order

LANE command / viewModel
[stage 1 row 0] cmd.submit-order
name: Submit Order
in: ui.checkout
out: evt.order-confirmed

[stage 1 row 1] cmd.approve-order
name: Approve Order
in: ui.admin
out: evt.order-confirmed

[stage 3 row 0] vm.order-status
name: Order Status
in: evt.order-confirmed

LANE event
[stage 2 row 0] evt.order-confirmed
name: Order Confirmed
in: cmd.approve-order, cmd.submit-order
out: vm.order-status

GRAPH
ui.admin --shared-to-cmd--> cmd.approve-order
cmd.approve-order --cmd-to-evt--> evt.order-confirmed
evt.order-confirmed --evt-to-viewModel--> vm.order-status
cmd.submit-order --cmd-to-evt--> evt.order-confirmed
ui.checkout --shared-to-cmd--> cmd.submit-order

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

