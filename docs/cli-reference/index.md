# CLI Command Reference

<aside>
🧭

This page is the command reference hub for the ModelingProject CLI.

Each child page documents **one CLI command** with:

- purpose
- syntax
- expected output format
- one concrete example
</aside>

<aside>
🧭

**Direction classification**: this command hub now corresponds to **Option A / Embedded Schema Management**.

That means schema-related commands remain inside `em`, including command/event field management.

If you want the split-CLI direction, use the parallel hub here:

[Option B CLI Command Reference](../architecture/embedded-workspaces.md)

</aside>

### Shared output envelope

All commands should return a consistent top-level envelope.

#### Success

```json
{
  "ok": true,
  "command": "em ...",
  "projectId": "proj_...",
  "draftId": "draft_...",
  "revisionId": "rev_...",
  "data": {},
  "warnings": []
}
```

#### Failure

```json
{
  "ok": false,
  "command": "em ...",
  "projectId": "proj_...",
  "draftId": "draft_...",
  "error": {
    "code": "ERR_CODE",
    "message": "Human-readable explanation",
    "details": {}
  },
  "warnings": []
}
```

### Conventions

- `projectId` is present when a project context exists.
- `draftId` is present when the command runs inside a draft.
- `revisionId` is present when the command resolves or creates a revision.
- `data` is command-specific and documented on each child page.
- `warnings` is always an array.
- Mutating model commands require an open draft. Run `em draft start --n "..."` before creating or changing nodes, edges, schemas, fields, or proposals.
- A project can have only one open draft at a time. `em draft start` returns `DRAFT_ALREADY_OPEN` until the existing draft is submitted.

### Command groups

- Project / Draft / Versions
- Story
- UI
- Schema
- ViewModel fields
- Automation
- Explore / Review

[Embedded workspaces](../architecture/embedded-workspaces.md)

[em show](em-show.md)

[em neighbors](em-neighbors.md)

[em walk](em-walk.md)

[em graph](em-graph.md)

[em trace](em-trace.md)

[em validate](em-validate.md)

[em review](em-review.md)

[em review impact draft](review-impact-draft.md)

[em review impact evt](em-review-impact-evt.md)

[em review impact field](em-review-impact-field.md)

[em story add](em-story-add.md)

[em story tree](em-story-tree.md)

[em story suggest-bind](em-story-suggest-bind.md)

[em story revise-bind](em-story-revise-bind.md)

[em story confirm-bind](em-story-confirm-bind.md)

[em story bind](em-story-bind.md)

[em ui add](em-ui-add.md)

[em ui tree](em-ui-tree.md)

[em ui bind-view](em-ui-bind-view.md)

[em role issues-cmd](em-role-issues-cmd.md)

[em cmd new](em-cmd-new.md)

[em cmd schema management](command-schema-management.md)

[em evt new](em-evt-new.md)

[em evt schema management](event-schema-management.md)

[em view new](em-view-new.md)

[em project init](em-project-init.md)

[em project open](em-project-open.md)

[em ctx](em-ctx.md)

[em draft start](em-draft-start.md)

[em draft status](em-draft-status.md)

[em draft diff](em-draft-diff.md)

[em submit](em-submit.md)

[em versions](em-versions.md)

[em checkout](em-checkout.md)

[em link cmd->evt](em-link-cmd-to-evt.md)

[em link evt->view](em-link-evt-to-view.md)

[em view field add](em-view-field-add.md)

[em view field edit](em-view-field-edit.md)

[em view field rm](em-view-field-rm.md)

[em view schema show](em-view-schema-show.md)

[em proc new](em-proc-new.md)

[em proc bind-view](em-proc-bind-view.md)

[em trigger new](em-trigger-new.md)

[em trigger issues-cmd](em-trigger-issues-cmd.md)
