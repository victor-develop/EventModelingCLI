# Event Modeling CLI

Event Modeling CLI is a file-based modeling tool for describing flows, Commands, Events, ViewModels, schemas, Drafts, diffs, impact review, validation, and embedded workspaces in existing repositories.

## Repository layout

- [`packages/cli`](packages/cli/README.md) — the `em` CLI and the published npm package.
- [`apps/viewer`](apps/viewer/README.md) — the local React/XYFlow viewer.
- [`skills/develop-legacy-with-event-modeling`](skills/develop-legacy-with-event-modeling/SKILL.md) — the model-first legacy development workflow.
- [`docs/cli-reference`](docs/cli-reference/index.md) — CLI command reference.
- [`docs/architecture`](docs/architecture/implementation-summary.md) — architecture and workspace design notes.
- [`examples`](examples) — runnable examples and smoke flows.

## Development

```bash
npm ci
npm run build
npm run test:cli
```

The CLI package exposes the `em` executable. The viewer is a separate local workspace application and consumes the CLI's public viewer-contract API.
