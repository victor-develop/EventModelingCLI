# Shared schema and Event evolution

Treat Command, Event, and ViewModel fields differently according to their compatibility boundary. A REST request often carries a Command-shaped payload, but it is not automatically the domain Command. A response is usually a projection/read model or query result, not an Event.

## Safe default

For a published or replayable Event, prefer this sequence:

1. Add the replacement or additional field.
2. Keep the old field while producers, consumers, replayers, and external clients migrate.
3. Emit both fields if a bridge period is required.
4. Mark the old field deprecated in the contract and code.
5. Remove it only at an explicit compatibility boundary, normally with a new or versioned Event contract.

Changing a field's type, removing it, renaming it, or changing optional to required can break persisted events and consumers even when the compiler passes. Model the compatibility decision in the Draft and test both old and new payloads where coexistence is required.

## CLI guard handling

Event field edit/remove operations may return `EVENT_SCHEMA_EVOLUTION_CONFIRMATION_REQUIRED` before writing anything. In an interactive terminal, the user can confirm with `y` or `yes`. In Agent or CI execution:

- inspect the structured warning and before/after field details;
- explain the compatibility boundary and check the Draft impact;
- prefer an additive or versioned design;
- use `--suppress-warning` only with explicit approval and a recorded rationale.

The warning must remain visible in `em review impact draft`; suppression acknowledges a deliberate decision and does not make the change safe by itself.

## Review questions

- Can old events be replayed after deployment?
- Can old consumers receive the new payload?
- Are there external clients, queues, caches, or data exports outside the repository?
- Is the semantic meaning changing even if the primitive type stays the same?
- Is a new Event name/version clearer than mutating the existing contract?

If any answer is unknown, keep the old contract, mark the mapping/impact as uncertain, and ask for the missing compatibility decision rather than silently forcing the edit.
