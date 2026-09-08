# em ctx

### Purpose

Show the current project, draft, and revision context.

### Syntax

```bash
em ctx
```

### Expected `data`

```json
{
  "project": {
    "id": "proj_payments",
    "name": "Payments Modeling"
  },
  "headRevision": {
    "id": "rev_003",
    "message": "Add refund timeline"
  },
  "draft": {
    "id": "draft_007",
    "status": "open"
  }
}
```

### Example

```bash
em ctx
```

```json
{
  "ok": true,
  "command": "em ctx",
  "projectId": "proj_payments",
  "draftId": "draft_007",
  "revisionId": "rev_003",
  "data": {
    "project": {
      "id": "proj_payments",
      "name": "Payments Modeling"
    },
    "headRevision": {
      "id": "rev_003",
      "message": "Add refund timeline"
    },
    "draft": {
      "id": "draft_007",
      "status": "open"
    }
  },
  "warnings": []
}
```