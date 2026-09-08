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
occ-cmd-submit-order | cmd.submit-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-cmd-to-missing-event | occ-cmd-submit-order | occ-missing-event | cmd-to-evt | 2 | LTR
edge-ui-to-cmd | occ-ui-checkout | occ-cmd-submit-order | shared-to-cmd | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 900 | 136
commandViewModel | -40 | 160 | 900 | 136
event | -40 | 360 | 900 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: FAIL
all edges have route points: PASS
visible lanes valid: PASS
```

