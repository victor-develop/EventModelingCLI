---
title: "Output — ASCII Graph"
---


```plain text
PROJECT: Order Management
FOCUS: cmd.create-order

STAGES
0 -> 1 -> 2 -> 3 -> 5 -> 6 -> 7

LANE shared
[stage 0 row 0] ui.checkout
name: Checkout UI
out: cmd.create-order

LANE command / viewModel
[stage 1 row 0] cmd.create-order
name: Create Order
in: ui.checkout
out: evt.order-created

[stage 3 row 0] vm.order-detail
name: Order Detail
in: evt.order-created
out: cmd.pay-order

[stage 5 row 0] cmd.pay-order
name: Pay Order
in: vm.order-detail
out: evt.order-paid

[stage 7 row 0] vm.order-detail
name: Order Detail
in: evt.order-paid

LANE event
[stage 2 row 0] evt.order-created
name: Order Created
in: cmd.create-order
out: vm.order-detail

[stage 6 row 0] evt.order-paid
name: Order Paid
in: cmd.pay-order
out: vm.order-detail

GRAPH
evt.order-created --evt-to-viewModel--> vm.order-detail
cmd.create-order --cmd-to-evt--> evt.order-created
evt.order-paid --evt-to-viewModel--> vm.order-detail
cmd.pay-order --cmd-to-evt--> evt.order-paid
ui.checkout --shared-to-cmd--> cmd.create-order
vm.order-detail --viewModel-to-shared--> cmd.pay-order

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

