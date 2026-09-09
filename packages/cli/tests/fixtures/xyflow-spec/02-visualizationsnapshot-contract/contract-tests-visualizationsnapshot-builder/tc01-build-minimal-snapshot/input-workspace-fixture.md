---
title: "Input — Workspace Fixture"
---


```yaml
# workspace-fixture.yml
projectName: Order Management
nodes:
  - id: ui.checkout
    kind: ui
    name: Checkout UI
  - id: cmd.submit-order
    kind: cmd
    name: Submit Order
  - id: evt.order-submitted
    kind: evt
    name: Order Submitted
  - id: vm.order-detail
    kind: viewModel
    name: Order Detail
edges:
  - id: domain-edge-ui-to-cmd
    from: ui.checkout
    to: cmd.submit-order
    kind: shared-to-cmd
  - id: domain-edge-cmd-to-evt
    from: cmd.submit-order
    to: evt.order-submitted
    kind: cmd-to-evt
  - id: domain-edge-evt-to-vm
    from: evt.order-submitted
    to: vm.order-detail
    kind: evt-to-viewModel
request:
  focus: cmd.submit-order
  direction: both
  hops: 2
```

