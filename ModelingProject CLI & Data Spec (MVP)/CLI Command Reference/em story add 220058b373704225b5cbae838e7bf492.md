# em story add

### Purpose

Create an epic, story, or scenario node.

A story node acts as the semantic anchor for one or more derived subgraphs inside the ModelingProject.

### Syntax

```bash
em story add epic|story|scenario --title "..." [--parent <id>] [--role <roleId>]
```

### Expected `data`

```json
{
  "node": {
    "id": "node_201",
    "kind": "story.story",
    "canonicalId": "story.payment.refund.add-refund-status",
    "displayName": "Add refund status"
  }
}
```

### Semantics

- A story node does not manually enumerate every member node.
- Its subgraph membership is derived after commands are bound and graph reachability is resolved.

### Example

```bash
em story add story --title "Add refund status" --parent node_200 --role role.customer
```

```json
{
  "ok": true,
  "command": "em story add",
  "projectId": "proj_payments",
  "draftId": "draft_008",
  "data": {
    "node": {
      "id": "node_201",
      "kind": "story.story",
      "canonicalId": "story.payment.refund.add-refund-status",
      "displayName": "Add refund status"
    }
  },
  "warnings": []
}
```