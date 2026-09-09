# Model-to-code evidence map

Use a small, reviewable evidence ledger to connect the Event Modeling graph to a legacy implementation. Keep it beside the embedded model, normally `.event-modeling/code-map.yaml`. Do not put this repository-specific data in the Skill itself.

## Minimal shape

```yaml
version: 1
entries:
  - model:
      kind: command
      id: orders.cmd.place-order
    code:
      - path: src/orders/http/place-order-route.ts
        symbol: placeOrderRoute
        relation: issuer
        evidence: "POST /orders constructs the command"
      - path: src/orders/application/place-order.ts
        symbol: PlaceOrderHandler
        relation: handler
        evidence: "dispatch target for the command"
      - path: test/orders/place-order.test.ts
        symbol: "creates an order"
        relation: test
        evidence: "asserts the command outcome"
    confidence: confirmed
    verifiedAt: 2026-01-01

  - model:
      kind: event-field
      id: orders.evt.order-placed
      fieldId: orderId
    code:
      - path: src/orders/events/order-placed.ts
        symbol: OrderPlaced
        relation: producer
        evidence: "payload property orderId"
      - path: src/orders/read-model/order-view.ts
        symbol: applyOrderPlaced
        relation: consumer
        evidence: "reads event.orderId"
    confidence: probable
    verifiedAt: 2026-01-01
```

Use repository-relative POSIX paths. Prefer stable symbols and routes over line numbers; add a line hint only as a convenience because line numbers drift. Keep one entry per model node or field and allow multiple code records for adapters, producers, consumers, mappers, and tests.

## Evidence and confidence

Use `confirmed` only when source inspection establishes the relationship. Use `probable` when naming, call graph, or generated code strongly supports it but a direct read is incomplete. Use `candidate` for a search hit or inferred relationship that still needs verification. Record the exact evidence: route, call site, serializer, event constructor, field access, schema validator, or test assertion.

Treat missing or stale entries as review gaps. A map is not a claim that all source impact is known; it is a ledger of what has been inspected and what remains uncertain.

## Updating the map

After implementation, update entries for moved symbols, new adapters, new consumers, and authoritative tests. Keep the map in the same Git change as the model/code change when practical. Do not copy request payloads, customer data, credentials, tokens, or proprietary business explanations into the map.

## SQLite boundary

SQLite can help when reverse lookups become slow or the map is generated from several scanners, but it is a derived index:

1. Store the canonical evidence in YAML/JSON under Git.
2. Generate SQLite deterministically from that map and scanner output.
3. Keep the database in an ignored cache path (for example `.mp-cache/code-map.sqlite`) or regenerate it in CI; do not commit it unless the repository explicitly wants a reproducible binary artifact.
4. Use tables for `model_entities`, `code_symbols`, `relations`, and `evidence`, with unique keys on model ID/field ID and code path/symbol.
5. Store metadata and paths, not source contents or runtime payloads. Never index secret or credential files.
6. Rebuild or invalidate the index when the map version or source commit changes.

Do not add a SQLite dependency to every target repository just to start this workflow. Begin with the text map and repository search; add an index only after a measured query/review bottleneck appears.
