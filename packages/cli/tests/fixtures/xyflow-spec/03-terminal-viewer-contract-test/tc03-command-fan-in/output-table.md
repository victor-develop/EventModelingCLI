---
title: "Output — Table"
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.submit-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-ui-checkout | ui.checkout | shared | shared | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-ui-admin | ui.admin | shared | shared | 0 | 1 | 0 | 80 | 220 | 56 | none
occ-cmd-submit-order | cmd.submit-order | cmd | commandViewModel | 1 | 0 | 400 | 160 | 220 | 56 | none
occ-cmd-approve-order | cmd.approve-order | cmd | commandViewModel | 1 | 1 | 400 | 240 | 220 | 56 | none
occ-evt-order-confirmed | evt.order-confirmed | evt | event | 2 | 0 | 800 | 400 | 220 | 56 | none
occ-vm-order-status | vm.order-status | viewModel | commandViewModel | 3 | 0 | 1200 | 160 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-admin-to-approve | occ-ui-admin | occ-cmd-approve-order | shared-to-cmd | 2 | LTR
edge-approve-to-evt | occ-cmd-approve-order | occ-evt-order-confirmed | cmd-to-evt | 2 | LTR
edge-evt-to-vm | occ-evt-order-confirmed | occ-vm-order-status | evt-to-viewModel | 2 | LTR
edge-submit-to-evt | occ-cmd-submit-order | occ-evt-order-confirmed | cmd-to-evt | 2 | LTR
edge-ui-to-submit | occ-ui-checkout | occ-cmd-submit-order | shared-to-cmd | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 1500 | 216
commandViewModel | -40 | 120 | 1500 | 216
event | -40 | 360 | 1500 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

