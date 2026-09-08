# Embedded workspaces in an existing repository

Use an embedded workspace when model specifications and implementation code should be reviewed together in one Git change.

```text
repository/
  .event-modeling/              # version-controlled model files
    mp.yaml
    nodes/
    edges/
    schemas/
    view-model-schemas/
    revisions/
    drafts/
    proposals/
  .mp-cache/                    # local runtime state; do not commit
    context.yaml
  services/
  web/
```

`.mp-cache/` stores the active project, draft, and checked-out revision; it is not an authoritative model artifact. On `project init` and `project migrate`, the CLI maintains an idempotent `.mp-cache/` rule in the repository `.gitignore` when Git metadata is present. The project directory contains the authoritative YAML model and may live at another repository-relative location such as `docs/event-modeling/`.

## Initialize or open an embedded workspace

```bash
em project init "Order Management" --path .event-modeling
em project open --path .event-modeling
```

`--path` is repository-relative, takes precedence over discovery, and rejects absolute paths and `..` traversal. From a nested directory, the CLI locates the nearest Git repository boundary and then discovers the configured local workspace. `em serve` uses the same resolution path as all other commands.

Run `em ctx` to inspect the resolved `repositoryRoot`, `projectPath`, `cachePath`, and `contextPath`.

## Discovery rules

Without `--path`, discovery considers only the current directory and its ancestors up to the repository boundary. At each level it recognizes:

- a direct project directory containing `mp.yaml`;
- `.event-modeling/`;
- `docs/event-modeling/`;
- legacy `projects/*/` project directories; and
- an explicit local selection in `.mp-cache/context.yaml`.

When more than one discoverable workspace exists at the same level and no local context selects one, the CLI returns `WORKSPACE_AMBIGUOUS`; it does not choose silently. For arbitrary non-standard locations on a fresh clone, open once with `--path` to establish local context.

## Existing legacy layout

Existing `projects/<slug>/` workspaces and their root `context.yaml` remain readable. New context writes go to `.mp-cache/context.yaml`.

To copy the currently active legacy project into a Git-friendly embedded location without deleting its source:

```bash
em project migrate --path .event-modeling
```

Migration copies all project artifacts (including nodes, edges, schemas, revisions, drafts, and proposals), switches local context to the target, and refuses an existing target. It never overwrites or deletes the legacy workspace.

Generated CLI builds (`packages/cli/dist/`) and Viewer builds (`apps/viewer/dist/`) remain generated output, separate from the version-controlled model directory.
