# em project open

### Purpose

Open an existing project and make it the current context.

### Syntax

```bash
em project open [<id|name>] [--path <repository-relative-directory>]
```

### Expected `data`

```json
{
  "project": {
    "id": "proj_payments",
    "name": "Payments Modeling",
    "headRevisionId": "rev_003"
  },
  "currentRevision": {
    "id": "rev_003",
    "message": "Add refund timeline"
  }
}
```

### Example

```bash
em project open proj_payments

# Open a known embedded workspace explicitly
em project open --path .event-modeling
```

```json
{
  "ok": true,
  "command": "em project open",
  "projectId": "proj_payments",
  "revisionId": "rev_003",
  "data": {
    "project": {
      "id": "proj_payments",
      "name": "Payments Modeling",
      "headRevisionId": "rev_003"
    },
    "currentRevision": {
      "id": "rev_003",
      "message": "Add refund timeline"
    }
  },
  "warnings": []
}
```
