# Event Modeling Spec CLI

The `em` CLI manages file-based Event Modeling specifications: flows, Commands, Events, ViewModels, schemas, Drafts, diffs, impact review, validation, and embedded workspaces in existing repositories.

## Installation

Once the first public release is published:

```bash
npm install --global event-modeling-spec-cli
em --help
```

For a repository-local toolchain, install it as a development dependency and invoke the binary through your package manager:

```bash
npm install --save-dev event-modeling-spec-cli
npx --no-install em --help
```

The package name is a release candidate and must be checked for ownership immediately before publishing.

## Local development

```bash
npm ci
npm run build
node dist/cli/index.js --help
```

The package exposes the `em` executable. Before the first public release, verify the package name and npm ownership, then publish a tagged prerelease and test it from a clean temporary repository.

## Embedded legacy repository

From the target repository, initialize a version-controlled model workspace:

```bash
em project init "My Domain" --path .event-modeling
em ctx
```

The model files belong in the target repository. Runtime context is kept under `.mp-cache/` and should remain ignored.

## Release verification

```bash
npm pack --dry-run
npm pack
```

Inspect the generated tarball before publishing. It should contain the compiled `dist/` files and this README, and should not contain local caches, credentials, environment files, or unrelated repository artifacts.

The companion `develop-legacy-with-event-modeling` Skill describes the model-first workflow for applying this CLI to legacy codebases.
