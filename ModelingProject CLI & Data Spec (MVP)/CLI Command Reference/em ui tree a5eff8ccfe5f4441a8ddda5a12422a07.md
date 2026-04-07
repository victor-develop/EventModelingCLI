# em ui tree

### Purpose

Render the current UI IA tree.

### Syntax

```bash
em ui tree
```

### Expected `data`

```json
{
  "tree": [
    {
      "id": "node_410",
      "kind": "ui.screen",
      "displayName": "Payment Detail",
      "children": [
        {
          "id": "node_401",
          "kind": "ui.section",
          "displayName": "Refund Status"
        }
      ]
    }
  ]
}
```

### Example

```bash
em ui tree
```

```json
{
  "ok": true,
  "command": "em ui tree",
  "projectId": "proj_payments",
  "data": {
    "tree": [
      {
        "id": "node_410",
        "kind": "ui.screen",
        "displayName": "Payment Detail",
        "children": [
          {
            "id": "node_401",
            "kind": "ui.section",
            "displayName": "Refund Status"
          }
        ]
      }
    ]
  },
  "warnings": []
}
```