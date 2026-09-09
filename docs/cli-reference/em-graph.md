# em graph

### Purpose

Render a graph view of the current project or a focused subgraph.

### Syntax

```bash
em graph [--focus <id>] [--depth N] [--format mermaid]
```

### Expected `data`

```json
{
  "format": "mermaid",
  "graph": "graph TD\nA[story] --> B[cmd]\nB --> C[evt]\nC --> D[view]"
}
```

### Example

```bash
em graph --focus order.payment.view.charge.detail --depth 2 --format mermaid
```

```json
{
  "ok": true,
  "command": "em graph",
  "projectId": "proj_payments",
  "data": {
    "format": "mermaid",
    "graph": "graph TD\nA[order.refund.cmd.create-refund] --> B[order.refund.evt.refund.created]\nB --> C[order.payment.view.charge.detail]"
  },
  "warnings": []
}
```