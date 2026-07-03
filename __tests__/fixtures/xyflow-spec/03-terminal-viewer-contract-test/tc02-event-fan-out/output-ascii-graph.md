---
title: "Output — ASCII Graph"
notion_id: 8156fa7e-901a-47da-9857-ed42f07fea14
synced_at: 2026-07-03T13:43:23.213Z
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

LANE command / viewModel
[stage 1 row 0] cmd.submit-order
name: Submit Order
in: ui.checkout
out: evt.order-submitted

[stage 3 row 0] vm.order-summary
name: Order Summary
in: evt.order-submitted

[stage 3 row 1] vm.order-audit
name: Order Audit
in: evt.order-submitted

LANE event
[stage 2 row 0] evt.order-submitted
name: Order Submitted
in: cmd.submit-order
out: vm.order-audit, vm.order-summary

GRAPH
ui.checkout --shared-to-cmd--> cmd.submit-order
cmd.submit-order --cmd-to-evt--> evt.order-submitted
evt.order-submitted --evt-to-viewModel--> vm.order-audit
evt.order-submitted --evt-to-viewModel--> vm.order-summary

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

