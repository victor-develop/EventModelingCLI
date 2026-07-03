---
title: "Output — Table"
notion_id: 46258d5d-b09c-4f3d-9300-1b361a3d10d7
synced_at: 2026-07-03T13:43:27.970Z
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.create-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-ui-checkout | ui.checkout | shared | shared | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-cmd-create-order | cmd.create-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | none
occ-evt-order-created | evt.order-created | evt | event | 2 | 0 | 800 | 400 | 220 | 56 | none
occ-vm-order-detail-after-created | vm.order-detail | viewModel | commandViewModel | 3 | 0 | 1200 | 200 | 220 | 56 | none
occ-cmd-pay-order | cmd.pay-order | cmd | commandViewModel | 5 | 0 | 2000 | 200 | 220 | 56 | none
occ-evt-order-paid | evt.order-paid | evt | event | 6 | 0 | 2400 | 400 | 220 | 56 | none
occ-vm-order-detail-after-paid | vm.order-detail | viewModel | commandViewModel | 7 | 0 | 2800 | 200 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-created-to-vm1 | occ-evt-order-created | occ-vm-order-detail-after-created | evt-to-viewModel | 2 | LTR
edge-create-to-created | occ-cmd-create-order | occ-evt-order-created | cmd-to-evt | 2 | LTR
edge-paid-to-vm2 | occ-evt-order-paid | occ-vm-order-detail-after-paid | evt-to-viewModel | 2 | LTR
edge-pay-to-paid | occ-cmd-pay-order | occ-evt-order-paid | cmd-to-evt | 2 | LTR
edge-ui-to-create | occ-ui-checkout | occ-cmd-create-order | shared-to-cmd | 2 | LTR
edge-vm1-to-pay | occ-vm-order-detail-after-created | occ-cmd-pay-order | viewModel-to-shared | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 3100 | 136
commandViewModel | -40 | 160 | 3100 | 136
event | -40 | 360 | 3100 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

