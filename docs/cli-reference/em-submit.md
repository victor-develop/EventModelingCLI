# em submit

### Purpose

Publish the current draft as a new revision.

Submit validates the current model, verifies that the draft is still based on the current head revision, and checks that recorded draft operations still match the current model files. It fails without closing the draft when validation fails, the draft base is stale, or the draft/model consistency check fails.

### Syntax

```bash
em submit -m "<message>"
```

### Expected `data`

```json
{
  "submittedDraftId": "draft_008",
  "newRevision": {
    "id": "rev_004",
    "message": "Add refund status to payment detail"
  }
}
```

### Example

```bash
em submit -m "Add refund status to payment detail"
```

```json
{
  "ok": true,
  "command": "em submit",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "revisionId": "rev_004",
  "data": {
    "submittedDraftId": "draft_008",
    "newRevision": {
      "id": "rev_004",
      "message": "Add refund status to payment detail"
    }
  },
  "warnings": []
}
```
