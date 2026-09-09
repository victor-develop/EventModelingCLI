---
title: "Output — Table"
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.refresh-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-role-customer | role.customer | shared | role:role.customer | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-nonrole-clock | trigger.clock | shared | shared | 0 | 0 | 0 | 200 | 220 | 56 | none
occ-cmd-refresh-order | cmd.refresh-order | cmd | commandViewModel | 1 | 0 | 400 | 400 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-clock-to-cmd | occ-nonrole-clock | occ-cmd-refresh-order | shared-to-cmd | 2 | LTR
edge-role-to-cmd | occ-role-customer | occ-cmd-refresh-order | shared-to-cmd | 2 | LTR

SWIMLANES
lane | x | y | width | height
role:role.customer | -40 | -40 | 900 | 136
shared | -40 | 160 | 900 | 136
commandViewModel | -40 | 360 | 900 | 136
event | -40 | 560 | 900 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```
