# em evt schema management

Manage the payload schema for an event node.

These commands mutate the model and require an open draft.

## Commands

```bash
em evt schema init <evtId>
em evt field add <evtId> --field-id <fieldId> --name "..." --type "..." [--required|--optional] [--description "..."]
em evt field edit <evtId> <fieldId> [--name "..."] [--type "..."] [--required|--optional] [--description "..."]
em evt field rm <evtId> <fieldId>
em evt schema show <evtId>
```

Event schemas are stored as YAML under `schemas/<evtId>.schema.yaml`.

When an event schema exists, `em validate` checks that view model field sources such as `--path payload.status` resolve to a declared event payload field.

## Example

```bash
em evt field add returns.evt.return-requested --field-id returnId --name returnId --type string
em evt field add returns.evt.return-requested --field-id status --name status --type string
em evt schema show returns.evt.return-requested
```

Output shape:

```json
{
  "eventId": "returns.evt.return-requested",
  "version": 1,
  "payload": {
    "fields": [
      {
        "fieldId": "status",
        "name": "status",
        "type": "string",
        "required": true
      }
    ]
  }
}
```
