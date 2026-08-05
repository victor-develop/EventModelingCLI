# em cmd schema management

Manage the input schema for a command node.

These commands mutate the model and require an open draft.

## Commands

```bash
em cmd schema init <cmdId>
em cmd field add <cmdId> --field-id <fieldId> --name "..." --type "..." [--required|--optional] [--description "..."]
em cmd field edit <cmdId> <fieldId> [--name "..."] [--type "..."] [--required|--optional] [--description "..."]
em cmd field rm <cmdId> <fieldId>
em cmd schema show <cmdId>
```

Command schemas are stored as YAML under `schemas/<cmdId>.schema.yaml`.

## Example

```bash
em cmd field add returns.cmd.request-return --field-id orderId --name orderId --type string
em cmd field add returns.cmd.request-return --field-id email --name email --type string
em cmd schema show returns.cmd.request-return
```

Output shape:

```json
{
  "commandId": "returns.cmd.request-return",
  "version": 1,
  "input": {
    "fields": [
      {
        "fieldId": "orderId",
        "name": "orderId",
        "type": "string",
        "required": true
      }
    ]
  }
}
```
