# Draft review and implementation reconciliation

Use this checklist at the Draft checkpoint and again before submission.

## Model review

- Is the requirement represented by a bounded flow from trigger to observable outcome?
- Are transport, Command, Event, projection/ViewModel, and UI/external consumers distinguished?
- Does `em draft diff --format json` describe the net change rather than temporary add/remove operations?
- Does `em review impact draft` show all changed seeds, affected nodes and edges, schema relationships, and compatibility warnings?
- Are inferred consumers labeled as candidates instead of certain dependencies?
- Is the impact bounded with explicit hops/limits when the graph is large?
- Does `em validate` pass with no unresolved field source or graph invariant error?

## Code review

- Does every confirmed map entry touched by the impact point to the current route, symbol, mapper, producer, consumer, and test?
- Were request validation, command construction, processor/service behavior, persistence, event publication, projection/read model, and client code checked as applicable?
- Are authorization, idempotency, retries, ordering, and failure behavior preserved or modeled when the change affects them?
- Are old and new payload compatibility tests present for a shared Event contract?
- Are unrelated refactors excluded from the change?

## Reconciliation gate

Do not submit while any answer is “unknown”:

- Does each intended model change have a corresponding code/test change or an explicit model-only reason?
- Does each behavior or contract change in the code have a corresponding Draft operation?
- Are all remaining code-map candidates either verified or called out to the user?
- Are validation, focused tests, and repository checks green?
- Has the user approved the Draft when a review gate applies?
