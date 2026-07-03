---
title: "Output — Table"
notion_id: 0a3b9a21-08bb-410c-b664-ab000f9723b5
synced_at: 2026-07-03T13:43:35.586Z
---


```plain text
PROJECT
name: Order Management
focusNodeId: cmd.refresh-order

OCCURRENCES
occurrenceId | canonicalNodeId | nodeKind | lane | stageIndex | rowIndex | x | y | width | height | lockLevel
occ-role-customer | role.customer | shared | shared | 0 | 0 | 0 | 0 | 220 | 56 | none
occ-nonrole-clock | trigger.clock | shared | shared | 0 | 1 | 0 | 80 | 220 | 56 | none
occ-cmd-refresh-order | cmd.refresh-order | cmd | commandViewModel | 1 | 0 | 400 | 200 | 220 | 56 | none

EDGES
displayEdgeId | fromOccurrenceId | toOccurrenceId | kind | pointCount | direction
edge-clock-to-cmd | occ-nonrole-clock | occ-cmd-refresh-order | shared-to-cmd | 2 | LTR
edge-role-to-cmd | occ-role-customer | occ-cmd-refresh-order | shared-to-cmd | 2 | LTR

SWIMLANES
lane | x | y | width | height
shared | -40 | -40 | 900 | 216
commandViewModel | -40 | 160 | 900 | 136
event | -40 | 360 | 900 | 136

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```

