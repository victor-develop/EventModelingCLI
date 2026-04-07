# em story revise-bind

### Purpose

Revise a story binding proposal without mutating the modeling graph.

This command operates on a previously generated proposal and returns a **new proposal snapshot**. It does not create `storyOwnsCommand` edges and does not persist story membership.

### Syntax

```bash
em story revise-bind --proposal <proposalId> --op <atomic-op> ...
```

### Atomic operations

Each invocation applies **exactly one** atomic revision operation.

1. **Add a root command**

```bash
em story revise-bind --proposal <proposalId> --op add-root --cmd <cmdId>
```

1. **Remove a root command**

```bash
em story revise-bind --proposal <proposalId> --op remove-root --cmd <cmdId>
```

1. **Switch expansion mode**

```bash
em story revise-bind --proposal <proposalId> --op set-mode --mode core|full
```

1. **Force-include a boundary node**

```bash
em story revise-bind --proposal <proposalId> --op include-boundary --node <nodeId>
```

1. **Force-exclude a boundary node**

```bash
em story revise-bind --proposal <proposalId> --op exclude-boundary --node <nodeId>
```

1. **Expand downstream automation from one processor boundary**

```bash
em story revise-bind --proposal <proposalId> --op expand-downstream-from --node <procId>
```

1. **Collapse previously expanded downstream automation**

```bash
em story revise-bind --proposal <proposalId> --op collapse-downstream-from --node <procId>
```

1. **Force-include one explicit path**

```bash
em story revise-bind --proposal <proposalId> --op include-path --path <nodeId,edgeId,nodeId,...> --reason "..."
```

1. **Force-exclude one explicit path**

```bash
em story revise-bind --proposal <proposalId> --op exclude-path --path <nodeId,edgeId,nodeId,...> --reason "..."
```

### Expected `data`

```json
{
  "proposal": {
    "id": "proposal_002",
    "previousProposalId": "proposal_001",
    "storyId": "node_201",
    "appliedOperation": {
      "op": "include-path",
      "path": [
        "role.customer",
        "edge_451",
        "order.refund.cmd.create-refund",
        "edge_501",
        "order.refund.evt.refund.created"
      ],
      "reason": "Keep the primary user-facing command path inside the story boundary."
    },
    "mode": "full",
    "candidateRootCommandIds": ["order.refund.cmd.create-refund"],
    "resolvedSubgraph": {
      "coreNodes": [
        "order.refund.cmd.create-refund",
        "order.refund.evt.refund.created",
        "order.payment.view.charge.detail"
      ],
      "interfaceNodes": [
        "role.customer",
        "ui.screen.payment.detail"
      ],
      "boundaryNodes": [
        "order.payment.proc.charge.reconcile"
      ]
    },
    "overrides": [
      {
        "type": "include-path",
        "path": [
          "role.customer",
          "edge_451",
          "order.refund.cmd.create-refund",
          "edge_501",
          "order.refund.evt.refund.created"
        ],
        "reason": "Keep the primary user-facing command path inside the story boundary.",
        "createdBy": "agent",
        "createdAt": "2026-03-11T10:35:00+08:00"
      }
    ]
  }
}
```

### Semantics

- `revise-bind` changes the **proposal inputs or derivation knobs**, not the underlying graph.
- The command should not be used to hand-edit arbitrary membership. It should only adjust:
    - root commands
    - expansion mode
    - boundary treatment
    - downstream automation expansion
    - explicit path overrides in exceptional cases
- `include-path` and `exclude-path` are **proposal overrides**, not graph edits.
- Every path override must carry a reason and be recorded in proposal override metadata.
- This keeps proposal revision deterministic where possible, and auditable when exceptions are necessary.

### LLM usage guidance

- Use `em story suggest-bind ...` first.
- If the proposal boundary is wrong, revise **one thing at a time**.
- Prefer this order:
    1. root commands
    2. mode (`core` vs `full`)
    3. boundary include/exclude
    4. downstream automation expansion
    5. path overrides (`include-path` / `exclude-path`) only if the normal semantic knobs still do not express the intended boundary
- After each revise call, inspect the returned proposal before issuing the next revise.
- When using `include-path` or `exclude-path`, always provide a concise reason tied to user-visible story scope.
- If multiple path overrides become necessary, treat that as a signal that the underlying modeling graph or story root selection may be wrong.
- Do **not** jump to `em story confirm-bind ...` until the proposal matches the intended story scope.
- For a **new story / new requirement**:
    1. explore existing graph
    2. create or update modeling components if needed
    3. run `em story suggest-bind ...`
    4. iterate with `em story revise-bind ...`
    5. confirm only after review

### Example

```bash
em story revise-bind --proposal proposal_001 --op include-path --path role.customer,edge_451,order.refund.cmd.create-refund,edge_501,order.refund.evt.refund.created --reason "Keep the primary user-facing command path inside the story boundary"
```

```json
{
  "ok": true,
  "command": "em story revise-bind",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "proposal": {
      "id": "proposal_002",
      "previousProposalId": "proposal_001",
      "storyId": "node_201",
      "appliedOperation": {
        "op": "include-path",
        "path": [
          "role.customer",
          "edge_451",
          "order.refund.cmd.create-refund",
          "edge_501",
          "order.refund.evt.refund.created"
        ],
        "reason": "Keep the primary user-facing command path inside the story boundary"
      },
      "mode": "full",
      "candidateRootCommandIds": ["order.refund.cmd.create-refund"],
      "resolvedSubgraph": {
        "coreNodes": [
          "order.refund.cmd.create-refund",
          "order.refund.evt.refund.created",
          "order.payment.view.charge.detail"
        ],
        "interfaceNodes": [
          "role.customer",
          "ui.screen.payment.detail"
        ],
        "boundaryNodes": [
          "order.payment.proc.charge.reconcile"
        ]
      },
      "overrides": [
        {
          "type": "include-path",
          "path": [
            "role.customer",
            "edge_451",
            "order.refund.cmd.create-refund",
            "edge_501",
            "order.refund.evt.refund.created"
          ],
          "reason": "Keep the primary user-facing command path inside the story boundary",
          "createdBy": "agent",
          "createdAt": "2026-03-11T10:35:00+08:00"
        }
      ]
    }
  },
  "warnings": []
}
```