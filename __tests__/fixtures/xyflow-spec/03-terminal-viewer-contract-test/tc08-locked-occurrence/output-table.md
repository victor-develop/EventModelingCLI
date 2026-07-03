---
title: "Output — Table"
notion_id: e376e4d8-fdf7-4a0c-8154-30d9b52ca6b1
synced_at: 2026-07-03T13:43:38.044Z
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.submit-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-ui-checkout | ui.checkout | shared | shared | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-cmd-submit-order | cmd.submit-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | hard
occ-evt-order-submitted | evt.order-submitted | evt | event | 2 | 0 | 800 | 400 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-cmd-to-evt | occ-cmd-submit-order | occ-evt-order-submitted | cmd-to-evt | 2 | LTR
edge-ui-to-cmd | occ-ui-checkout | occ-cmd-submit-order | shared-to-cmd | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 1100 | 136
commandViewModel | -40 | 160 | 1100 | 136
event | -40 | 360 | 1100 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

