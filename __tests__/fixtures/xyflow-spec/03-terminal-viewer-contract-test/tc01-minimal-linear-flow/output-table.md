---
title: "Output — Table"
notion_id: 83dc39a0-31f5-4afb-9260-709af223435e
synced_at: 2026-07-03T13:43:21.792Z
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.submit-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-ui-checkout | ui.checkout | shared | shared | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-cmd-submit-order | cmd.submit-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | none
occ-evt-order-submitted | evt.order-submitted | evt | event | 2 | 0 | 800 | 400 | 220 | 56 | none
occ-vm-order-detail | vm.order-detail | viewModel | commandViewModel | 3 | 0 | 1200 | 200 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-ui-to-cmd | occ-ui-checkout | occ-cmd-submit-order | shared-to-cmd | 2 | LTR
edge-cmd-to-evt | occ-cmd-submit-order | occ-evt-order-submitted | cmd-to-evt | 2 | LTR
edge-evt-to-vm | occ-evt-order-submitted | occ-vm-order-detail | evt-to-viewModel | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 1500 | 136
commandViewModel | -40 | 160 | 1500 | 136
event | -40 | 360 | 1500 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

