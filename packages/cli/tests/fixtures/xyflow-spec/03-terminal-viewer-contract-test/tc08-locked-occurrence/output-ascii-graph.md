---
title: "Output — ASCII Graph"
---


```plain text
PROJECT: Order Management
FOCUS: cmd.submit-order

STAGES
0 -> 1 -> 2

LANE shared
[stage 0 row 0] ui.checkout
name: Checkout UI
out: cmd.submit-order

LANE command / viewModel
[stage 1 row 0] cmd.submit-order
name: Submit Order
lockLevel: hard
in: ui.checkout
out: evt.order-submitted

LANE event
[stage 2 row 0] evt.order-submitted
name: Order Submitted
in: cmd.submit-order

GRAPH
cmd.submit-order --cmd-to-evt--> evt.order-submitted
ui.checkout --shared-to-cmd--> cmd.submit-order

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

