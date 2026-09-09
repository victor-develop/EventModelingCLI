# em ui add

### Purpose

Create a UI IA node under the UI tree.

### Syntax

```bash
em ui add app|area|screen|section|component --name "..." [--parent <id>]
```

### Expected `data`

```json
{
  "node": {
    "id": "node_401",
    "kind": "ui.section",
    "canonicalId": "ui.section.payment.detail.refund-status",
    "displayName": "Refund Status"
  }
}
```

### Example

```bash
em ui add section --name "Refund Status" --parent node_400
```

```json
{
  "ok": true,
  "command": "em ui add",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "node_401",
      "kind": "ui.section",
      "canonicalId": "ui.section.payment.detail.refund-status",
      "displayName": "Refund Status"
    }
  },
  "warnings": []
}
```