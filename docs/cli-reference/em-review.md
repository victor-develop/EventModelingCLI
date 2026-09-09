# em review

### Purpose

Produce a higher-level review summary for the current draft.

### Syntax

```bash
em review
```

### Expected `data`

```json
{
  "summary": {
    "riskLevel": "medium",
    "changedStories": 1,
    "changedCommands": 1,
    "changedEvents": 1,
    "changedViews": 1
  },
  "findings": [
    "New refund field is visible on payment detail.",
    "Impact limited to one screen and one processor."
  ]
}
```

### Example

```bash
em review
```

```json
{
  "ok": true,
  "command": "em review",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "summary": {
      "riskLevel": "medium",
      "changedStories": 1,
      "changedCommands": 1,
      "changedEvents": 1,
      "changedViews": 1
    },
    "findings": [
      "New refund field is visible on payment detail.",
      "Impact limited to one screen and one processor."
    ]
  },
  "warnings": []
}
```