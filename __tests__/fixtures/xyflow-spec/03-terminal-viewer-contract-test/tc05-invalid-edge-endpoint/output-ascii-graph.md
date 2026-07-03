---
title: "Output — ASCII Graph"
notion_id: 83a67dfc-82f2-4f8b-b890-d3f762df7a5a
synced_at: 2026-07-03T13:43:31.736Z
---


```plain text
PROJECT: Order Management
FOCUS: cmd.submit-order

STAGES
0 -> 1

LANE shared
[stage 0 row 0] ui.checkout
name: Checkout UI
out: cmd.submit-order

LANE command / viewModel
[stage 1 row 0] cmd.submit-order
name: Submit Order
in: ui.checkout
out: UNKNOWN(occ-missing-event)

LANE event

GRAPH
ui.checkout --shared-to-cmd--> cmd.submit-order
cmd.submit-order --cmd-to-evt--> UNKNOWN(occ-missing-event)

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: FAIL
all edges have route points: PASS
visible lanes valid: PASS
```

