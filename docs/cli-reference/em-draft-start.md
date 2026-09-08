# em draft start

### Purpose

Create a new draft from the current head revision.

Only one draft may be open for a project at a time. If an open draft already exists, this command fails with `DRAFT_ALREADY_OPEN` so pending model changes cannot be hidden from draft diff/review.

### Syntax

```bash
em draft start -n "<message>"
```

### Expected `data`

```json
{
  "draft": {
    "id": "draft_008",
    "baseRevisionId": "rev_003",
    "status": "open",
    "message": "Add refund status to payment detail"
  }
}
```

### Example

```bash
em draft start -n "Add refund status to payment detail"
```

```json
{
  "ok": true,
  "command": "em draft start",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "revisionId": "rev_003",
  "data": {
    "draft": {
      "id": "draft_008",
      "baseRevisionId": "rev_003",
      "status": "open",
      "message": "Add refund status to payment detail"
    }
  },
  "warnings": []
}
```
