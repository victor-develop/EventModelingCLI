# ModelingProject CLI & Data Spec (MVP)

<aside>
📌

**Scope**: MVP spec for a ModelingProject-based Event Modeling CLI + backing DB.

This spec standardizes:

- Entities (Nodes) and relations (Edges)
- Versioning workflow (Draft → Revision)
- Canonical ID naming + lint rules
- ViewModel schema fields with event-level provenance
- Validation/review surfaces for human + LLM usage
</aside>

<aside>
🧭

**Direction classification**: this main spec now belongs to **Option A / Embedded Schema Management**.

That means command schema, event schema, and viewModel schema are all managed **inside the Event Modeling CLI** itself.

The parallel alternative is **Option B / Composable Schema Management CLI**, documented here:

[Option B：组合式 Schema Management CLI 方案](ModelingProject%20CLI%20&%20Data%20Spec%20(MVP)/Option%20B%EF%BC%9A%E7%BB%84%E5%90%88%E5%BC%8F%20Schema%20Management%20CLI%20%E6%96%B9%E6%A1%88%20767753c7f8b641deaa7b625234d439a2.md)

</aside>

### 1) Glossary

- **ModelingProject**: 1 project = 1 complete set of event modeling elements (stories, UI IA tree, commands/events/viewModels, automation).
- **Revision**: immutable published snapshot of a project.
- **Draft**: mutable change set based on a base revision, later submitted into a new revision.
- **Story**: a semantic container that resolves to a collection of one or more subgraphs inside the ModelingProject.
- **Node**: a typed entity in the model graph.
- **Edge**: a typed relationship between nodes.

---

### 2) Data model (conceptual)

#### 2.1 Workflow layer

- **ModelingProject**
    - id
    - name
    - description
    - headRevisionId
- **Revision**
    - id
    - projectId
    - parentRevisionId
    - message
    - createdAt
    - author
- **Draft (ChangeSet)**
    - id
    - projectId
    - baseRevisionId
    - status: open | submitted | abandoned
    - ops[]: append-only operations (add/update/delete) on Nodes/Edges/ViewModelSchema

#### 2.2 Domain layer (graph)

- **Node**
    - id
    - projectId
    - kind (enum)
    - canonicalId (unique within project)
    - displayName
    - description
    - tags[]
    - domains[]
    - owner (optional)
- **Edge**
    - id
    - projectId
    - type (enum)
    - fromNodeId
    - toNodeId
    - viaNodeId (optional, used only by roleUsesUIToIssueCommand)
    - meta (optional JSON)

#### 2.3 Schema layer (strongly structured)

- **CommandSchema** (keyed by commandNodeId)
    - commandNodeId
    - version
    - input.fields[] (ordered)
        - fieldId (stable)
        - name
        - type
        - required
        - description
- **EventSchema** (keyed by eventNodeId)
    - eventNodeId
    - version
    - payload.fields[] (ordered)
        - fieldId (stable)
        - name
        - type
        - required
        - description
- **ViewModelSchema** (keyed by viewModelNodeId)
    - viewModelNodeId
    - fields[] (ordered)
        - fieldId (stable)
        - name
        - type
        - nullable
        - description
        - source (required)
            - eventNodeId
            - eventFieldPath (e.g. [payload.order.id](http://payload.order.id))

---

### 3) Node kinds (enum)

#### 3.1 Story layer

- story.epic
- story.story
- story.scenario

Story nodes are **not** just labels in a tree. Each story or scenario should resolve to a **collection of subgraphs** inside the ModelingProject.

#### 3.2 Actors

- role

#### 3.3 UI IA tree (Option A)

UI nodes are **information architecture + behavior bindings only**. They do not carry layout/props/rendering specs.

- [ui.app](http://ui.app)
- ui.area
- ui.screen
- ui.section
- ui.component

#### 3.4 Schema

- cmd
- evt
- viewModel

#### 3.5 Automation

- proc (Processor)
- trigger

---

### 4) Edge types (enum)

#### 4.1 Tree

- parentOf
    - Used for Story tree and UI tree.

#### 4.2 Traceability

- storyOwnsCommand (story/scenario → cmd)

#### 4.2.1 Story as subgraph collection

- A story is modeled as a **derived collection of subgraphs**, not as a flat list of attached nodes.
- `storyOwnsCommand` is the primary anchor edge.
- Starting from the commands bound to a story, the system derives the relevant connected subgraphs across UI, commands, events, viewModels, processors, and triggers.
- The effective story boundary is therefore computed from graph reachability rules, rather than manually duplicating membership on every node.

#### 4.2.2 Story reachability rules (hardcoded expected behavior)

The following behavior is **written into the rule engine** and should be deterministic.

- **Root rule**: a story starts from one or more commands connected by `storyOwnsCommand`.
- **Forward expansion rule**: from each root command, include nodes reachable through:
    - `commandCausesEvent`
    - `eventRefreshesViewModel`
    - `eventUpdatesProcessor`
- **Reverse backfill rule**: after forward expansion, backfill explanation nodes by including:
    - roles and UI entry points that issue the reachable commands through `roleUsesUIToIssueCommand`
    - UI and processors that consume the reachable viewModels through `uiOrProcessorConsumesViewModel`
- **Excluded edges by default**:
    - `parentOf` never affects story membership
    - `storyOwnsCommand` is only used to find roots, not to jump across stories
    - `processorOrTriggerIssuesCommand` is not expanded transitively by default
- **Default processor behavior**:
    - a processor reached through `eventUpdatesProcessor` is included as a **boundary node**
    - its downstream commands are **not** automatically pulled into the story unless the caller explicitly asks for downstream automation expansion
- **Determinism rule**: same project graph + same story roots + same expansion mode must produce the same resolved story subgraph

This means story resolution is mostly executable code, not a case-by-case human judgment.

#### 4.2.3 Proposal path overrides

- Path overrides are **explicit proposal-level exceptions** applied after deterministic reachability resolution.
- Supported override operations are:
    - `include-path`
    - `exclude-path`
- A path override must use an explicit alternating sequence of node ids and edge ids, for example:
    - `role.customer,edge_451,order.refund.cmd.create-refund,edge_501,order.refund.evt.refund.created`
- Path overrides affect the **proposal snapshot only**. They do not mutate the underlying ModelingProject graph.
- They are intended for exceptional boundary correction when root, mode, boundary treatment, and downstream expansion are still insufficient.

#### Proposal override metadata schema

```json
{
  "overrides": [
    {
      "type": "include-path",
      "path": [
        "role.customer",
        "edge_451",
        "order.refund.cmd.create-refund",
        "edge_501",
        "order.refund.evt.refund.created"
      ],
      "reason": "This user-facing command path must remain inside the story boundary.",
      "createdBy": "user|agent",
      "createdAt": "2026-03-11T10:30:00+08:00"
    }
  ]
}
```

#### 4.3 Event Modeling 6 connection types

1. **roleUsesUIToIssueCommand**
    - role → cmd, with viaNodeId = ui.*
2. **processorOrTriggerIssuesCommand**
    - proc/trigger → cmd
3. **commandCausesEvent**
    - cmd → evt
4. **eventRefreshesViewModel**
    - evt → viewModel
5. **eventUpdatesProcessor**
    - evt → proc
6. **uiOrProcessorConsumesViewModel**
    - ui.* / proc → viewModel
    - Edge.meta may contain fieldRefs[] to declare which ViewModel fields are consumed.

#### Edge.meta for uiOrProcessorConsumesViewModel

- fieldRefs[]: list of ViewModelSchema.fieldId that this UI/proc actually reads.

---

### 5) Canonical ID naming spec (with lint)

#### 5.1 Global rules

- canonicalId is the machine identifier used by CLI and DB.
- canonicalId MUST be unique within a ModelingProject (across all Node kinds).
- Lowercase only.
- Segments use: a-z, 0-9, and hyphen `-`.
- Domain path is dot-separated and can be multi-segment:
    - `<domainPath> = <seg>(.<seg>)*`
    - `<seg> = [a-z][a-z0-9-]*`

#### 5.2 Type-specific canonicalId patterns

#### Command

- **`<domainPath>.cmd.<verb-object>`**
- `<verb-object>` is a single segment using hyphens.
- Examples:
    - order.payment.cmd.capture-charge
    - order.refund.cmd.create-refund

#### Event

- **`<domainPath>.evt.<noun>.<state>`**
- Examples:
    - order.payment.evt.charge.succeeded
    - order.payment.evt.charge.failed
    - tracking.timeline.evt.timeline.refreshed

#### ViewModel

- **`<domainPath>.view.<noun>.<projection>`**
- Examples:
    - order.payment.view.charge.detail
    - order.payment.view.charge.list

#### Processor

- **`<domainPath>.proc.<noun>.<verb>`**
- Examples:
    - [order.payment.proc.reconciliation.run](http://order.payment.proc.reconciliation.run)
    - order.payment.proc.charge.reconcile

#### Trigger

- **`<domainPath>.trigger.<source>.<name>`**
- Examples:
    - order.payment.trigger.webhook.stripe-event
    - order.payment.trigger.schedule.daily-reconcile

#### UI / Story / Role

- Allowed to have canonicalId too (recommended for stable refs), but lint can be less strict.

#### 5.3 Lint rules (MVP)

- LINT-001 invalidCanonicalId: violates the allowed character/segment rules.
- LINT-002 canonicalIdNotUnique: duplicates within the same ModelingProject.
- LINT-003 reservedWord: disallow segments: new, edit, delete, list, show, diff, submit, draft, project, init, open, ctx.
- LINT-EVT-001 eventIdMustMatchDomainEvtNounState.
- LINT-CMD-001 commandIdMustMatchDomainCmdVerbObject.
- LINT-VIEW-001 viewIdMustMatchDomainViewNounProjection.
- LINT-PROC-001 procIdMustMatchDomainProcNounVerb.
- LINT-EVT-002 eventStateTooVague (warning): updated/changed/done etc.

---

### 6) CLI contract (MVP)

> The CLI operates on the **current ModelingProject** context (like a repo). Most commands default to the currently opened project and draft.
> 

#### 6.1 Project / Draft / Versions

- em project init <name>
- em project open <id|name>
- em ctx
- em draft start -n "message"
- em draft status
- em draft diff [--format text|json|mermaid]
- em submit -m "message"
- em versions
- em checkout <revId>

#### 6.2 Story

- em story add epic|story|scenario --title "..." [--parent <id>] [--role <roleId>]
- em story tree
- em story suggest-bind --story <id> [--from-cmd <cmdId> ...] [--mode core|full]
- em story revise-bind --proposal <proposalId> --op <atomic-op> ...
    - Non-mutating proposal revision step. Each invocation applies exactly one atomic revision operation and returns a new proposal snapshot.
    - Atomic ops:
        - `add-root --cmd <cmdId>`
        - `remove-root --cmd <cmdId>`
        - `set-mode --mode core|full`
        - `include-boundary --node <nodeId>`
        - `exclude-boundary --node <nodeId>`
        - `expand-downstream-from --node <procId>`
        - `collapse-downstream-from --node <procId>`
        - `include-path --path <nodeId,edgeId,nodeId,...> --reason "..."`
        - `exclude-path --path <nodeId,edgeId,nodeId,...> --reason "..."`
- em story confirm-bind --story <id> --proposal <proposalId>
- em story bind --story <id> --cmd <cmdId>
    - Low-level direct mutation. Recommended for explicit/manual use, not the default agent workflow.

#### 6.3 UI IA tree (to section/component)

- em ui add app|area|screen|section|component --name "..." [--parent <id>]
- em ui tree
- em ui bind-view --ui <uiId> --view <viewModelId> [--fields <fieldId,fieldId,...>]
- em ui expose-cmd --role <roleId> --ui <uiId> --cmd <cmdId>

#### 6.4 Schema

- em cmd new <canonicalId> [--name "displayName"]
- em evt new <canonicalId> [--name "displayName"]
- em view new <canonicalId> [--name "displayName"]
- em cmd schema init <cmdId>
- em cmd field add <cmdId> --field-id <fieldId> --name "..." --type "..." [--required]
- em cmd field edit <cmdId> <fieldId> ...
- em cmd field rm <cmdId> <fieldId>
- em cmd schema show <cmdId>
- em evt schema init <evtId>
- em evt field add <evtId> --field-id <fieldId> --name "..." --type "..." [--required]
- em evt field edit <evtId> <fieldId> ...
- em evt field rm <evtId> <fieldId>
- em evt schema show <evtId>
- em link cmd->evt <cmdId> <evtId>
- em link evt->view <evtId> <viewModelId>

#### 6.5 ViewModel fields

- em view field add <viewModelId> --field-id <fieldId> --name "..." --type "..." --from-event <evtId> --path "payload...." [--nullable]
- em view field edit <viewModelId> <fieldId> ...
- em view field rm <viewModelId> <fieldId>
- em view schema show <viewModelId>

#### 6.6 Processor / Trigger

- em proc new <canonicalId>
- em proc bind-view --proc <procId> --view <viewModelId> [--fields ...]
- em trigger new <canonicalId>
- em trigger issues-cmd --trigger <triggerId> --cmd <cmdId>

</tr>

#### 6.7 Explore / Review

- em show <nodeId|canonicalId>
- em neighbors --node <nodeId|canonicalId> [--direction in|out|both] [--edge-type <type> ...] [--limit N]
- em walk --from <nodeId|canonicalId> [--direction forward|backward|both] [--edge-type <type> ...] [--max-hops N] [--limit N] [--cursor <cursorId>]
- em graph [--focus <id>] [--depth N] [--format mermaid]
- em trace --from <id> --to <id> [--max-hops N]
- em validate
- em review
- em review impact evt <evtId>
- em review impact field <viewModelId> <fieldId>

---

### 7) Validate rules (MVP) + error codes

#### EMV-001 missingStoryRoleOrCommand

- Each story.story / story.scenario must reference a role and bind at least one command.

#### EMV-010 storyHasNoEndToEndLoop

- For each story-bound command, there must exist at least one end-to-end loop:
    - UI path (role->ui->cmd) and feedback path (ui consumes viewModel) and (cmd->evt->viewModel)
    - OR automation path (proc/trigger issues cmd) plus (cmd->evt->viewModel) or (cmd->evt->proc)

#### EMV-020 commandProducesNoEvent

- Each cmd must cause at least one event.

#### EMV-030 fieldMissingSourceEvent

- Each viewModel field must declare source.eventNodeId and source.eventFieldPath.

#### EMV-031 fieldSourceEventDoesNotRefreshView

- If a field’s source event is E, then E must refresh that viewModel (evt->viewModel edge).

#### EMV-040 invalidFieldRefInConsumesEdge

- If consumes edge declares fieldRefs, every fieldRef must exist in the viewModel schema.

#### EMV-050 processorHasNoUpdateSource

- Each proc must be updated by at least one event (evt->proc), unless explicitly marked as external.

---

### 8) Minimal example (for end-to-end CLI test)

#### Entities

- role.customer
- [ui.app](http://ui.app).tracking
- ui.screen.tracking.detail
- ui.section.tracking.detail.timeline
- ui.component.tracking.detail.timeline-list
- tracking.refresh.cmd.refresh-tracking
- tracking.timeline.evt.timeline.refreshed
- tracking.timeline.view.timeline.detail

#### ViewModel schema (tracking.timeline.view.timeline.detail)

- f.tracking-id: string from tracking.timeline.evt.timeline.refreshed.payload.trackingId
- f.latest-status: string from tracking.timeline.evt.timeline.refreshed.payload.latestStatus
- [f.events](http://f.events): array<StatusEvent> from [tracking.timeline.evt.timeline.refreshed.payload.events](http://tracking.timeline.evt.timeline.refreshed.payload.events)

#### Edges

- parentOf (UI tree)
- storyOwnsCommand (scenario -> tracking.refresh.cmd.refresh-tracking)
- roleUsesUIToIssueCommand (role.customer -> cmd, via ui.screen.tracking.detail)
- commandCausesEvent (cmd -> tracking.timeline.evt.timeline.refreshed)
- eventRefreshesViewModel (evt -> tracking.timeline.view.timeline.detail)
- uiOrProcessorConsumesViewModel (ui.component.tracking.detail.timeline-list -> viewModel, meta.fieldRefs=[f.latest-status,[f.events](http://f.events)])

---

### 9) How an LLM agent uses this CLI to drive stable, continuous requirement iteration

This section describes an **operational loop** for an LLM agent working for a user. The goal is to make iteration stable, reviewable, and hard to regress by forcing every change through **Draft → Validate/Review → Submit**.

#### 9.1 Agent invariants (non-negotiables)

- The agent never edits head revisions directly. It always works in a **draft**.
- The agent never proposes free-form architecture changes. It expresses all changes as **Node/Edge/ViewModelSchema ops**.
- The agent treats `em validate` as a gate. If validation fails, it must fix the model before asking for user approval.
- The agent always produces a minimal diff: smallest set of new/updated nodes/edges/fields that satisfies the requested story.
- The agent should prefer **atomic proposal revision** over manual low-level binding changes whenever the boundary is still under review.
- The agent should treat `include-path` and `exclude-path` as **exception tools**, not default modeling tools.

#### 9.2 The iteration loop (every request)

1. **Open context**
    - `em project open <project>`
    - `em ctx`
    - `em versions` (optional: detect last revision intent)
2. **Create a draft**
    - `em draft start -n "<short intent>"`
3. **Explore current model** (build accurate local context)
    - start local when the graph is large:
        - `em neighbors --node <component|cmd|evt|view>`
        - `em walk --from <component|cmd|evt|view> --direction forward|backward|both`
            - `backward` follows incoming edges to explain where the current node comes from
            - `forward` follows outgoing edges to show downstream impact
            - `both` combines the two around the same root and returns a bounded path-oriented local subgraph
            - in `both` mode, backward and forward branches should be returned separately to keep the subgraph readable
    - then widen only if needed:
        - `em story tree`
        - `em ui tree`
        - `em graph --format mermaid` (optional for visual sanity)
        - `em show <canonicalId>` for relevant cmd/evt/view
        - `em trace --from <story|ui|cmd> --to <viewModel|evt>` to find existing loops
4. **Design/update** (apply minimal ops)
    - **If the story should bind to an existing modeling subgraph**:
        - run `em story suggest-bind ...`
        - inspect the proposed roots and resolved subgraph preview
        - if the proposal is not yet acceptable, use `em story revise-bind ...` with one atomic operation at a time
        - prefer revising in this order: roots → mode → boundary treatment → downstream expansion → path overrides
        - use `include-path` / `exclude-path` only when the normal semantic knobs still cannot express the intended boundary
        - repeat revise → inspect until the proposal matches the intended story boundary
        - only then ask for confirmation and persist with `em story confirm-bind ...`
    - **If the user gives a brand new story / new requirement**:
        - explore whether an existing subgraph already covers part of it using `em show`, `em graph`, and `em trace`
        - decide whether to **reuse**, **extend**, or **create** modeling components
        - create or update the story node with `em story add ...` when needed
        - add or update only the necessary IA nodes, commands, events, viewModels, and fields
        - then run `em story suggest-bind ...` so the agent can preview how the new/updated story resolves against the graph
        - if needed, use `em story revise-bind ...` to tune proposal roots, mode, boundary inclusion, downstream automation expansion, or explicit path overrides
        - only after review/approval, persist with `em story confirm-bind ...`
    - Add/adjust IA nodes only where needed:
        - `em ui add ...`
        - `em ui expose-cmd ...`
        - `em ui bind-view ... --fields ...`
    - Add/adjust schema:
        - `em cmd new ...` / `em evt new ...` / `em view new ...`
        - `em link cmd->evt ...` / `em link evt->view ...`
        - `em view field add ... --from-event <evtId> --path ...`
    - For automation changes (if requested):
        - `em trigger new <domainPath>.trigger.<source>.<name>`
        - `em trigger issues-cmd ...`
        - `em proc new ...` / `em proc bind-view ...`
        - `em link evt->proc ...` (eventUpdatesProcessor)
5. **Self-review + gating**
    - `em validate`
    - `em review`
    - `em review impact evt <evtId>` / `em review impact field <viewModelId> <fieldId>` for non-trivial changes
6. **Produce review artifacts for the user**
    - `em draft diff --format mermaid` (graph)
    - `em draft diff --format text|json` (machine-readable)
    - A short written summary:
        - What user story changed
        - What UI entry point changed
        - What commands/events/viewModels/fields changed
        - Any new triggers/procs
7. **User approval checkpoint**
    - `em story suggest-bind` is only a **suggestion**. The resolved subgraph must still be revised if necessary and then confirmed.
    - `em story revise-bind` is also non-mutating. It only produces a better proposal snapshot.
    - If user accepts the final proposed story binding and model changes: proceed to `em story confirm-bind ...` and then submit.
    - If user requests adjustment: loop back to step 4 in the same draft.
8. **Submit**
    - `em submit -m "<what changed and why>"`
    - Optionally: `em versions` and reference the new revision id in the summary.

#### 9.3 How the agent stays stable over time (anti-drift mechanisms)

- **Canonical IDs + lint** prevent naming drift and make retrieval deterministic.
- **Stories as derived subgraph collections** prevent scope drift, because story membership is resolved from graph structure instead of maintained as a second disconnected taxonomy.
- **Field-level provenance** (ViewModelSchema.source.eventNodeId + eventRefreshesViewModel) prevents “ghost fields” and keeps read models explainable.
- **UI fieldRefs** enables precise impact analysis when schemas evolve.
- **Validation rules** (EMV-001/010/020/030/031/040/050) enforce:
    - story → cmd binding
    - end-to-end feedback loops
    - command → event causality
    - viewModel fields must be backed by events
    - processors must have update sources

#### 9.4 Example: agent handles a new requirement

User: “Add refund status to payment detail screen.”

- Explore: find existing `order.payment.view.charge.detail` and its consuming UI component.
- Draft changes:
    - Add `order.refund.evt.refund.status-updated` (if absent)
    - Link evt → viewModel
    - Add fields `f.refund-status` sourced from the refund event payload
    - Update UI consumes edge to include `f.refund-status` in fieldRefs
- Gate: validate + impact review
- Submit: new revision with minimal, reviewable diff

---

### 10) Open decision to finalize

- **Trigger canonicalId grammar**: **`<domainPath>.trigger.<source>.<name>`**

Add lint rule:

- LINT-TRIGGER-001 triggerIdMustMatchDomainTriggerSourceName

[CLI Command Reference](ModelingProject%20CLI%20&%20Data%20Spec%20(MVP)/CLI%20Command%20Reference%20343bf01a4d754d91bfaaca36e61b8730.md)
