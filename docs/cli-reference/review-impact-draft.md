# em review impact draft

Review the semantic impact of the complete net change in an open draft. It compares the draft's persisted base snapshot with its projected after snapshot; it does not count raw operations. An add followed by a remove therefore produces no impact seed.

```text
em review impact draft [draftId]
```

If `draftId` is omitted, the active draft is reviewed. The command uses only event-modeling edges and returns deterministic JSON suitable for a reviewer, Viewer, or development agent.

It follows changed commands, events, view models, and edges through the model. It also examines modeled schema relationships: Event fields to ViewModel sources, ViewModel fields to UI/processor consumers, and Command fields to issuers. Consumers without `fieldRefs` are reported as review candidates, not certain field dependencies.

Example:

```text
em review impact draft draft_003
```

```json
{
  "ok": true,
  "command": "em review impact draft",
  "data": {
    "impact": {
      "draftId": "draft_003",
      "baseRevisionId": "rev_012",
      "seeds": [
        { "id": "field:changed:event:evt.order.created:orderId", "entityType": "field", "status": "changed", "graph": "both" }
      ],
      "affectedNodes": {
        "events": [{ "canonicalId": "evt.order.created", "kind": "evt", "traversalDepth": 0 }],
        "viewModels": [{ "canonicalId": "vm.order.detail", "kind": "viewModel", "traversalDepth": 1 }]
      },
      "affectedEdges": [],
      "schemaImpacts": [
        {
          "relationship": "eventFieldToViewModelField",
          "certainty": "explicit",
          "source": { "schemaKind": "event", "nodeId": "evt.order.created", "fieldId": "orderId" }
        }
      ],
      "compatibilityWarnings": [
        { "code": "EVENT_FIELD_TYPE_CHANGED", "severity": "warning" }
      ],
      "summary": { "seedCount": 1 },
      "warnings": []
    }
  }
}
```

The same result is available to clients through:

```text
GET /api/drafts/:draftId/impact
```

This is model-level review, not source-code impact analysis. It does not scan repositories, create model-to-code bindings, or claim complete field lineage where the model lacks explicit relationships.
