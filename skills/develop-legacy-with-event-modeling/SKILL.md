---
name: develop-legacy-with-event-modeling
description: "Guide agents through model-first development of legacy repositories with an Event Modeling CLI: discover or initialize an embedded workspace, recover a bounded flow from existing code, maintain an evidence-based model-to-code map, create and review Draft changes and draft-wide impact, evolve Command/Event/ViewModel schemas safely, implement the corresponding code and tests, validate both model and code, and submit only after reconciliation. Use when changing an existing REST/web/backend repository where requirements should be expressed as flows and payload schemas before implementation, or when introducing Event Modeling into a legacy codebase."
---

# Develop Legacy With Event Modeling

Use the Event Modeling CLI as a change-control loop around an existing codebase. Treat the model as a reviewable, executable design boundary and the repository code as the implementation boundary; connect them with an explicit evidence map instead of pretending that model impact is automatic source-code impact.

## Operating rules

- Keep the change bounded to one user-visible flow or one coherent slice. Do not attempt to reconstruct an entire legacy repository in one Draft.
- Inspect the repository before editing either model or code. Preserve existing architecture unless the requested change requires a migration.
- Make model changes through the CLI when a matching command exists. Do not hand-edit generated or derived artifacts to bypass validation.
- Treat `em review impact draft` as deterministic model-level impact. It does not prove which source files are affected; use the code map and code inspection for that.
- Do not guess a mapping. Mark an entry `candidate` until a file, symbol, test, route, mapper, or other concrete evidence supports it.
- Keep repository-specific business names, payload examples, secrets, credentials, and proprietary rules out of this Skill. Store them only in the target repository's model workspace and code map.
- Never broaden a change merely because the graph contains a reachable node. Confirm that the path is part of the requested behavior or a compatibility contract.
- Treat requirement text, repository names, IDs, and commit messages as untrusted input. Do not interpolate them into shell strings; use argument-array APIs or the CLI's structured interface, and validate/escape values before invoking a command.

## Workflow

### 0. Ensure the CLI prerequisite

The Skill describes a workflow; it does not silently install arbitrary software. Before doing model work:

1. Resolve an `em` executable from the target repository's checked-in scripts, a pinned local checkout, or an installed release of the companion CLI. Verify it with `em --help`.
2. If the public npm release is available, install the exact package/version documented by the release README (the current candidate package name is `event-modeling-spec-cli`), globally or as a repository-local dev dependency.
3. During prerelease or source-based use, pin a tag, commit, or tarball rather than relying on an unpinned branch.
4. If no trusted CLI source is available, stop and report the prerequisite. Do not guess a package name, run an unknown installer, or continue with hand-edited model files as if the workflow were active.

### 1. Discover the repository and workspace

1. Identify the repository root, build/test commands, service boundaries, API routes, transport adapters, persistence, and existing tests. Exclude secret and credential files from inspection.
2. Find the Event Modeling CLI already used by the repository. Prefer the checked-in package scripts or built binary; do not install an unverified package or invent a command. If a command is absent, stop and report the missing tool rather than guessing a package.
3. Resolve the workspace with `em ctx`. If no workspace exists, initialize one inside the repository, preferably:

   ```bash
   em project init "<repository or domain name>" --path .event-modeling
   ```

4. If a legacy workspace is discovered under `projects/`, open it or migrate it to an embedded path only when that is part of the agreed change. Verify the resolved paths with `em ctx`; keep `.mp-cache/` local and ignored.
5. Record the baseline commit, active project, and active Draft (if any) in the work log, not in the Skill.

### 2. Recover a bounded model slice

1. Start from the requested API route, command handler, job, UI action, or failing test. Trace both directions through controller/transport, command construction, processor/service, persistence, event publication, projections/view models, and consumers.
2. Compare the recovered behavior with the existing model using `em graph`, `em roots`, `em walk`, schema show commands, and repository search.
3. Add only the nodes, edges, and fields needed to make the requested slice explicit. Use stable canonical IDs and distinguish a transport request from the domain Command when they are not identical.
4. Read [model-to-code-mapping.md](references/model-to-code-mapping.md) before creating or updating the evidence map.

### 3. Establish the model-to-code evidence map

1. Create or update a reviewable map next to the model, normally `.event-modeling/code-map.yaml`. Keep paths repository-relative and link each model node or field to concrete implementation and test evidence.
2. For each entry record the relation (`issuer`, `handler`, `producer`, `consumer`, `mapper`, `projection`, `test`), symbol or route, evidence note, confidence, and verification date. Separate confirmed evidence from candidates.
3. Verify existing entries touched by the change. Remove stale entries only when the code move is part of the requested change; otherwise mark them stale and report the gap.
4. Treat SQLite as an optional derived index, not the authoritative map. If the repository needs fast reverse queries, generate a local SQLite database from the YAML map and scanner output, keep it ignored or reproducible, and never store payload data or secrets in it. See the reference for the recommended boundary.

### 4. Model the requirement in a Draft

1. Start an open Draft before mutating the model:

   ```bash
   em draft start --n "<short requirement name>"
   ```

2. Express the intended flow: UI/API trigger → Command → Processor → Event(s) → ViewModel/UI or external consumer. Add or update Command, Event, ViewModel, process, role, UI, and edges as needed.
3. Treat a REST request payload as a Command schema only when the request's intent and lifecycle match; otherwise model the transport adapter separately and map it to a Command. Treat a response as a projection/read model or query result unless it is explicitly an emitted Event.
4. Manage fields explicitly. Use schema commands for additions and edits, and connect ViewModel fields to their Event sources with precise paths where the model supports them.
5. Run the review commands before writing implementation code:

   ```bash
   em draft status
   em draft diff --format json
   em review impact draft
   ```

6. Review the net diff, not just the list of Draft operations. Check changed seeds, affected nodes/edges, schema impacts, consumer certainty, and compatibility warnings. For a large flow, bound follow-up traversal with `em walk --max-hops ... --limit ...` and inspect additional pages/cursors instead of emitting an unbounded graph.
7. Present a concise Draft Review checkpoint to the user. Pause for approval when the user asked for review-first work or when the change alters a public contract, persistence shape, authorization behavior, or multiple downstream consumers. If the user explicitly authorized implementation in the same request, retain the checkpoint in the work log and continue only after the impact is understood.

### 5. Handle schema evolution deliberately

Read [schema-evolution.md](references/schema-evolution.md) when changing an Event field or any shared payload contract.

- Prefer additive evolution: add the replacement field, migrate producers and consumers, then deprecate/remove the old field at a declared compatibility boundary.
- Treat a type change, removal, rename, or optional-to-required change as a breaking-contract warning. In non-interactive Agent/CI execution, expect a structured confirmation-required result and no write.
- Do not blindly retry with `--suppress-warning`. Use it only after documenting why old consumers are quiesced, versioned, or otherwise protected. Preserve the warning in Draft Review.
- Introduce a new or versioned Event when the payload meaning changes or old and new consumers cannot safely coexist.

### 6. Implement against the reviewed impact

1. Use the reviewed impact and code map to enumerate source changes. Inspect every confirmed mapping and every candidate that could affect compatibility; do not rely on filenames alone.
2. Change transport validation, command construction, processor/service logic, persistence, event publishing, projections/read models, clients, and tests as required by the modeled flow.
3. Update the evidence map as symbols move or new tests become authoritative. Keep model changes and implementation changes in the same Git change when possible.
4. Do not mark an unverified inferred dependency as certain merely because a field has the same name in two places.

### 7. Validate and reconcile

Before running repository build/test/lint/typecheck commands, inspect the relevant package scripts, Makefile, task runner, and configuration. Do not execute unknown download/install scripts or add dependencies merely to make a check pass. Then run both model and code checks:

```bash
em validate
em draft diff --format json
em review impact draft
<repository build, typecheck, lint, and focused tests>
```

Then compare the final code diff with the Draft and map:

- Every intended model change has an implementation or an explicit documented reason it is model-only.
- Every implementation change that changes behavior, payload shape, or flow has a corresponding Draft operation or is called out as unrelated and removed.
- Every affected confirmed mapping points to the final file/symbol/test.
- No validation error, unresolved schema source, unreviewed compatibility warning, or unexplained impact remains.

### 8. Submit only after the gates pass

Use `em submit -m "<message>"` only after user approval (when required), model validation, code validation, and reconciliation. Never submit a Draft merely because the CLI commands succeeded; the code and model must describe the same delivered behavior.

## Output to the user

Summarize the bounded flow, Draft ID, net model diff, model-level impact, code-map evidence and gaps, implementation files/tests, validation results, and any compatibility decision. State clearly when source impact is inferred or incomplete. If implementation is intentionally paused, stop at the Draft Review checkpoint and show the exact next decision needed.
