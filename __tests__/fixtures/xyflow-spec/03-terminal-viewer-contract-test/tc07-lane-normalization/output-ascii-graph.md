---
title: "Output — ASCII Graph"
notion_id: 8a31fa93-3fb8-409c-9de3-78133466be38
synced_at: 2026-07-03T13:43:35.288Z
---


```plain text
PROJECT: Order Management
FOCUS: cmd.refresh-order

STAGES
0 -> 1

LANE shared
[stage 0 row 0] role.customer
name: Customer
out: cmd.refresh-order

[stage 0 row 1] trigger.clock
name: Clock Trigger
out: cmd.refresh-order

LANE command / viewModel
[stage 1 row 0] cmd.refresh-order
name: Refresh Order
in: role.customer, trigger.clock

LANE event

GRAPH
trigger.clock --shared-to-cmd--> cmd.refresh-order
role.customer --shared-to-cmd--> cmd.refresh-order

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

