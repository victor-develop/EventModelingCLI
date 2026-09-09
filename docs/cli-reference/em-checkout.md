# em checkout

### Purpose

Load a specific revision for inspection.

### Syntax

```bash
em checkout <revId>
```

### Expected `data`

```json
{
  "revision": {
    "id": "rev_003",
    "message": "Add refund timeline"
  },
  "project": {
    "id": "proj_payments",
    "name": "Payments Modeling"
  }
}
```

### Example

```bash
em checkout rev_003
```

```json
{
  "ok": true,
  "command": "em checkout",
  "projectId": "proj_payments",
  "revisionId": "rev_003",
  "data": {
    "revision": {
      "id": "rev_003",
      "message": "Add refund timeline"
    },
    "project": {
      "id": "proj_payments",
      "name": "Payments Modeling"
    }
  },
  "warnings": []
}
```