# em neighbors

### Purpose

Inspect the immediate graph neighborhood of any node.

Use this when the graph is large and you need a **1-hop local view** before deciding where to traverse next.

### Syntax

```bash
em neighbors --node <nodeId|canonicalId> [--direction in|out|both] [--edge-type <type> ...] [--limit N]
```

### Expected `data`

```json
{
  "center": "ui.component.payment.detail.refund-status",
  "direction": "both",
  "neighbors": [
    {
      "edgeId": "edge_450",
      "edgeType": "uiOrProcessorConsumesViewModel",
      "direction": "out",
      "nodeId": "order.payment.view.charge.detail",
      "nodeKind": "viewModel"
    },
    {
      "edgeId": "edge_700",
      "edgeType": "parentOf",
      "direction": "in",
      "nodeId": "ui.section.payment.detail.refund-status",
      "nodeKind": "ui.section"
    }
  ],
  "hasMore": false
}
```

### Semantics

- `neighbors` is a **localized inspection command**.
- It should be the default starting point when an agent only knows one component and cannot load the whole graph.
- The command returns direct neighbors only. It does not recurse.
- `parentOf` may be included here for navigation, even though it does not affect story reachability.

### LLM usage guidance

- Start with `em neighbors` when given an arbitrary component, screen, command, event, or ViewModel.
- Use the result to choose the next focused command:
    - another `em neighbors`
    - `em walk`
    - `em show`
    - `em trace`
- Prefer this over broad graph reads when the graph is large.

### Example

```bash
em neighbors --node ui.component.payment.detail.refund-status --direction both --limit 20
```

```json
{
  "ok": true,
  "command": "em neighbors",
  "projectId": "proj_payments",
  "data": {
    "center": "ui.component.payment.detail.refund-status",
    "direction": "both",
    "neighbors": [
      {
        "edgeId": "edge_450",
        "edgeType": "uiOrProcessorConsumesViewModel",
        "direction": "out",
        "nodeId": "order.payment.view.charge.detail",
        "nodeKind": "viewModel"
      },
      {
        "edgeId": "edge_700",
        "edgeType": "parentOf",
        "direction": "in",
        "nodeId": "ui.section.payment.detail.refund-status",
        "nodeKind": "ui.section"
      }
    ],
    "hasMore": false
  },
  "warnings": []
}
```