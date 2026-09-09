---
title: "03 Terminal Viewer Contract Test"
---


## Purpose


This page defines the terminal/headless viewer contract test suite.


The test suite is organized as **one test case page per scenario**. Each test case owns separate child pages for input and output so the Markdown sync repository can treat each artifact as a standalone fixture.


## Page convention


Each test case must use this structure:


```plain text
TCxx Scenario Name
  ├── Input — VisualizationSnapshot
  ├── Output — ASCII Graph
  └── Output — Table
```


## Function interfaces


```typescript
export function renderLayoutAscii(snapshot: VisualizationSnapshot): string
export function renderLayoutTable(snapshot: VisualizationSnapshot): string
export function renderInvariantSummary(snapshot: VisualizationSnapshot): InvariantSummary
```


## Test cases


## Required coverage matrix


| Test case | Scenario                                            | Expected invariant result |
| --------- | --------------------------------------------------- | ------------------------- |
| TC01      | Minimal linear UI → command → event → view model    | PASS                      |
| TC02      | Event fan-out to multiple view models               | PASS                      |
| TC03      | Multiple commands into one event                    | PASS                      |
| TC04      | Same canonical node appears in multiple occurrences | PASS                      |
| TC05      | Invalid edge endpoint                               | FAIL                      |
| TC06      | Non-left-to-right route                             | FAIL                      |
| TC07      | `nonRole` and `role:*` lanes normalize to `shared`  | PASS                      |
| TC08      | Locked occurrence appears and remains stable        | PASS                      |


## Per-test acceptance


Each test case passes only when:

- input fixture is valid JSON.
- ASCII output exactly matches `renderLayoutAscii(input)`.
- table output exactly matches `renderLayoutTable(input)`.
- output is deterministic across repeated runs.
- line breaks are stable.
- ordering rules are explicit.
- invariant expectations are explicit.

## Ordering rules


Occurrences are ordered by:


```plain text
lane order ASC, then stageIndex ASC, then rowIndex ASC, then occurrenceId ASC
```


Lane order is fixed:


```plain text
shared
commandViewModel
event
```


Edges are ordered by:


```plain text
displayEdgeId ASC
```


## ASCII graph style


ASCII output must be deterministic and easy to test with exact string comparison.


Use a structured lane listing, not a compact drawing. The format is intentionally more verbose because it is the contract surface for LLM agents.


Required section order:


```plain text
PROJECT
FOCUS
STAGES
LANE shared
LANE command / viewModel
LANE event
GRAPH
INVARIANTS
```


Example:


```plain text
PROJECT: Order Management
FOCUS: cmd.submit-order

STAGES
0 -> 1 -> 2 -> 3

LANE shared
[stage 0 row 0] ui.checkout
name: Checkout UI
out: cmd.submit-order

LANE command / viewModel
[stage 1 row 0] cmd.submit-order
name: Submit Order
in: ui.checkout
out: evt.order-submitted

LANE event
[stage 2 row 0] evt.order-submitted
name: Order Submitted
in: cmd.submit-order

GRAPH
ui.checkout --shared-to-cmd--> cmd.submit-order
cmd.submit-order --cmd-to-evt--> evt.order-submitted

INVARIANTS
left-to-right edges: PASS
all occurrences have lanes: PASS
all edges have endpoints: PASS
all edges have route points: PASS
visible lanes valid: PASS
```


Rendering rules:

- each lane is a section.
- each occurrence is one block.
- each occurrence block starts with `[stage N row M] canonicalNodeId`.
- use `name:` only when `domainNodes[canonicalNodeId].name` exists.
- use `in:` for incoming canonical ids.
- use `out:` for outgoing canonical ids.
- when multiple incoming or outgoing ids exist, join them with `,` .
- `GRAPH` lines use `source --kind--> target`.
- `INVARIANTS` lines are machine-checkable.
