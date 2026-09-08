# em draft status

### Purpose

Show draft metadata and a summary of pending changes.

### Syntax

```bash
em draft status
```

### Expected `data`

```json
{
  "draft": {
    "id": "draft_008",
    "status": "open",
    "baseRevisionId": "rev_003"
  },
  "summary": {
    "nodesAdded": 2,
    "nodesUpdated": 1,
    "edgesAdded": 3,
    "fieldsAdded": 1
  }
}
```

### Example

```bash
em draft status
```

```json
{
  "ok": true,
  "command": "em draft status",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "draft": {
      "id": "draft_008",
      "status": "open",
      "baseRevisionId": "rev_003"
    },
    "summary": {
      "nodesAdded": 2,
      "nodesUpdated": 1,
      "edgesAdded": 3,
      "fieldsAdded": 1
    }
  },
  "warnings": []
}
```