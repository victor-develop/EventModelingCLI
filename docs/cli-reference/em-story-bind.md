# em story bind

### Purpose

Bind a story or scenario to a command using `storyOwnsCommand`.

This binding anchors one root of the story's derived subgraph collection.

This is the **low-level direct mutation command**. Agent-safe workflow should normally use **suggest first, confirm second**.

### Syntax

```bash
em story bind --story <id> --cmd <cmdId>
```

### Expected `data`

```json
{
  "edge": {
    "id": "edge_301",
    "type": "storyOwnsCommand",
    "fromNodeId": "node_201",
    "toNodeId": "order.refund.cmd.create-refund"
  },
  "storySubgraphPreview": {
    "rootCommandIds": ["order.refund.cmd.create-refund"],
    "reachableNodeKinds": ["cmd", "evt", "viewModel"]
  }
}
```

### Semantics

- `storyOwnsCommand` does not mean the story only contains that command.
- It means the story subgraph derivation starts from that command and expands through the connected graph according to story reachability rules.
- Use this command when the root binding is already explicitly decided.
- If the goal is to bind a story to an **existing modeling subgraph**, the safer workflow is:
    1. `em story suggest-bind ...`
    2. human or agent reviews the preview
    3. `em story confirm-bind ...`

### Example

```bash
em story bind --story node_201 --cmd order.refund.cmd.create-refund
```

```json
{
  "ok": true,
  "command": "em story bind",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "edge": {
      "id": "edge_301",
      "type": "storyOwnsCommand",
      "fromNodeId": "node_201",
      "toNodeId": "order.refund.cmd.create-refund"
    }
  },
  "warnings": [
    "Prefer em story suggest-bind + em story confirm-bind for agent workflows."
  ]
}
```