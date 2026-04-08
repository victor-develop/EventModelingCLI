# Event Modeling CLI + Layout Program — Implementation Summary

## Project Overview

This project implements a complete Event Modeling CLI tool (`em`) and an Infinite Canvas Layout Program based on the ModelingProject CLI & Data Spec (MVP). The CLI enables teams to model event-sourced systems using structured, file-based YAML workflows. The Layout Program transforms CLI subgraph outputs into stable, 3-lane infinite canvas layouts with incremental exploration support.

## Architecture

The implementation follows a layered architecture with clear separation of concerns:

- **Domain Layer** (`src/domain/types.ts`): Core types — Node, Edge, NodeKind, EdgeType, Draft, Revision, Proposal, CLIResult.

- **Storage Layer** (`src/fs-model/`): File-based YAML persistence with YAML serialization, file I/O, and path conventions. Each project stores nodes, edges, schemas, revisions, drafts, and proposals as individual YAML files under `projects/<slug>/`.

- **Workspace Layer** (`src/workspace/workspace.ts`): Project lifecycle management, CRUD operations, sequential ID generation via `mp.yaml` counters.

- **Graph Layer** (`src/graph/graph-builder.ts`): In-memory adjacency index with neighbor lookup, forward/backward walking, path tracing, and Mermaid export.

- **Validation Layer** (`src/validation/`): Lint rules (LINT-001/002/003, LINT-CMD/EVT/VIEW/PROC/TRIGGER-001, LINT-EVT-002) and validation rules (EMV-001/010/020/030/031/040/050).

- **Layout Layer** (`src/layout/`): Independent layout program implementing the spec's 4-phase stage-based x-axis model with 3 swim lanes (shared, commandViewModel, event). Modules: `types.ts` (type system + config), `semantic-lift.ts` (canonical edge → display edge mapping), `occurrence.ts` (canonical node → render occurrence + merge), `stage.ts` (4k/4k+1/4k+2/4k+3 stage assignment from anchor), `row-solver.ts` (lane-local row assignment with barycenter sweep), `edge-router.ts` (orthogonal polyline routing), `layout-engine.ts` (initLayout / appendExploreResult / prependExploreResult API). Exported as both a library (`src/layout/index.ts`) and a CLI command (`em layout --focus <node> --direction <both|forward|backward>`).

- **CLI Layer** (`src/cli/`): Command router parsing `em <group> [subgroup] <action> [--flags]` dispatching to 30+ command handlers.

## Test-Driven Development

Built using strict TDD methodology with 118 tests across 13 test suites:

| Suite | Tests | Coverage |
|-------|-------|----------|
| cli.test.ts | 41 | All CLI commands + E2E + layout command |
| layout-engine.test.ts | 6 | initLayout, append, prepend, stability, full hotel flow |
| layout-occurrence.test.ts | 10 | Build occurrences, merge policy, lane mapping |
| layout-stage.test.ts | 5 | 4-phase stage assignment, multi-branch consistency |
| layout-row-solver.test.ts | 5 | Row assignment, lock levels, barycenter sweep |
| layout-edge-router.test.ts | 5 | Orthogonal routing, port positions, fan-out |
| layout-semantic-lift.test.ts | 9 | All 6 edge type mappings + uniqueness |
| layout-types.test.ts | 11 | Display lane/nodeKind mapping helpers |
| lint.test.ts | 10 | All lint rules |
| validate.test.ts | 5 | Validation rules |
| graph-builder.test.ts | 5 | Graph building, neighbors, walk, trace, Mermaid |
| storage.test.ts | 5 | YAML utils and file I/O |
| types.test.ts | 3 | Domain helper functions |

All 118 tests pass. TypeScript compiles cleanly with strict mode.

## Technology Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Testing**: Jest with ts-jest
- **Storage**: File-based YAML (no database)
- **Dependencies**: `yaml` (parsing), `uuid` (ID generation)

## Key Design Decisions

1. **4-phase stage x-axis**: `shared=4k`, `cmd=4k+1`, `evt=4k+2`, `viewModel=4k+3` guarantees all arrows flow left-to-right with +1 per display edge.
2. **Occurrence model**: Canonical nodes can have multiple render occurrences across branches, stages, and roles — essential for shared-lane elements.
3. **Incremental layout**: `appendExploreResult` / `prependExploreResult` output patches, not full relayouts, preserving stable node positions.
4. **Semantic lifting**: 6 canonical edge types map to 5 display edge kinds, reducing the layout problem to a strict unidirectional stage progression.
5. **Synchronous file I/O** for simplicity and reliability in a CLI context.
6. **YAML storage** ensures all data is version-control friendly and human-inspectable.
