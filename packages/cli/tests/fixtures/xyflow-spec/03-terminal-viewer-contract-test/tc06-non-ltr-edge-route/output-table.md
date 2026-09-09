---
title: "Output — Table"
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.submit-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-cmd-submit-order | cmd.submit-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | none
occ-evt-order-submitted | evt.order-submitted | evt | event | 2 | 0 | 800 | 400 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-cmd-to-evt-rtl | occ-cmd-submit-order | occ-evt-order-submitted | cmd-to-evt | 2 | RTL

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 1000 | 136
commandViewModel | -40 | 160 | 1000 | 136
event | -40 | 360 | 1000 | 136

INVARIANTS
left-to-right edges: FAIL
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

