# em evt schema management

Manage the payload schema for an event node.

These commands mutate the model and require an open draft.

## Commands

```bash
em evt schema init <evtId>
em evt field add <evtId> --field-id <fieldId> --name "..." --type "..." [--required|--optional] [--description "..."]
em evt field edit <evtId> <fieldId> [--name "..."] [--type "..."] [--required|--optional] [--description "..."] [--suppress-warning]
em evt field rm <evtId> <fieldId> [--suppress-warning]
em evt schema show <evtId>
```

Event schemas are stored as YAML under `schemas/<evtId>.schema.yaml`.

## Evolving published Event contracts

Event payloads may be persisted, replayed, or consumed outside the current repository. Renaming or removing a field, changing its type, or making an optional field required therefore triggers a compatibility guard. In an interactive terminal, confirm the warning with `y` or `yes`. In Agent and CI usage, the command returns `EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED` without writing anything.

Prefer additive evolution:

1. add the replacement field;
2. keep the old field while producers and consumers migrate;
3. remove the old field only at an explicit compatibility boundary.

Use `--suppress-warning` only when the caller has reviewed and accepted that boundary. The acknowledgement is recorded in the Draft operation, and `em review impact draft` still reports the compatibility warning. If the payload meaning changes substantially or old and new consumers cannot safely coexist, introduce a new Event or an explicitly versioned Event contract instead of mutating the existing one in place.

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
