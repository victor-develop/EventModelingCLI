# em story tree

### Purpose

Render the story hierarchy.

This tree shows the **story container hierarchy** only. Each story still resolves to one or more subgraphs in the main modeling graph.

### Syntax

```bash
em story tree
```

### Expected `data`

```json
{
  "tree": [
    {
      "id": "node_100",
      "kind": "story.epic",
      "displayName": "Payments",
      "children": [
        {
          "id": "node_201",
          "kind": "story.story",
          "displayName": "Add refund status"
        }
      ]
    }
  ]
}
```

### Example

```bash
em story tree
```

```json
{
  "ok": true,
  "command": "em story tree",
  "projectId": "proj_payments",
  "data": {
    "tree": [
      {
        "id": "node_100",
        "kind": "story.epic",
        "displayName": "Payments",
        "children": [
          {
            "id": "node_201",
            "kind": "story.story",
            "displayName": "Add refund status"
          }
        ]
      }
    ]
  },
  "warnings": []
}
```