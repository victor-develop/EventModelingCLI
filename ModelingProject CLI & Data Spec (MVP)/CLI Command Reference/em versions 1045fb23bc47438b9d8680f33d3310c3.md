# em versions

### Purpose

List revisions for the current project.

### Syntax

```bash
em versions
```

### Expected `data`

```json
{
  "revisions": [
    {
      "id": "rev_004",
      "message": "Add refund status to payment detail",
      "createdAt": "2026-03-10T22:00:00+08:00"
    },
    {
      "id": "rev_003",
      "message": "Add refund timeline",
      "createdAt": "2026-03-09T15:00:00+08:00"
    }
  ]
}
```

### Example

```bash
em versions
```

```json
{
  "ok": true,
  "command": "em versions",
  "projectId": "proj_payments",
  "data": {
    "revisions": [
      {
        "id": "rev_004",
        "message": "Add refund status to payment detail",
        "createdAt": "2026-03-10T22:00:00+08:00"
      },
      {
        "id": "rev_003",
        "message": "Add refund timeline",
        "createdAt": "2026-03-09T15:00:00+08:00"
      }
    ]
  },
  "warnings": []
}
```