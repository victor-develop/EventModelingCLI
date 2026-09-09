---
title: "Output — ASCII Graph"
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

[stage 3 row 0] vm.order-detail
name: Order Detail
in: evt.order-submitted

LANE event
[stage 2 row 0] evt.order-submitted
name: Order Submitted
in: cmd.submit-order
out: vm.order-detail

GRAPH
ui.checkout --shared-to-cmd--> cmd.submit-order
cmd.submit-order --cmd-to-evt--> evt.order-submitted
evt.order-submitted --evt-to-viewModel--> vm.order-detail

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

