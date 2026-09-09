# em validate

### Purpose

Run model validation rules.

### Syntax

```bash
em validate
```

### Expected `data`

```json
{
  "valid": false,
  "errors": [
    {
      "code": "EMV-031",
      "message": "Field source event does not refresh the target view",
      "details": {
        "fieldId": "f.refund-status"
      }
    }
  ]
}
```

### Example

```bash
em validate
```

```json
{
  "ok": true,
  "command": "em validate",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "valid": false,
    "errors": [
      {
        "code": "EMV-031",
        "message": "Field source event does not refresh the target view",
        "details": {
          "fieldId": "f.refund-status"
        }
      }
    ]
  },
  "warnings": []
}
```