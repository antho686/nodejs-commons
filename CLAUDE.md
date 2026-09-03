# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@antho686/nodejs-commons` is a private TypeScript library of shared utility modules for Node.js scripts and applications. It builds to CommonJS, ES modules, and standalone type declarations so consumers can import it either way.

## Commands

- `npm test` — run the full Jest suite (`--passWithNoTests`, coverage collected by default)
- `npx jest <path-to-spec>` — run a single spec file
- `npx jest -t '<test name>'` — run tests matching a name
- `npm run build` — full build: runs `build:cjs`, `build:mjs`, and `build:types` in sequence
- `npm run build:cjs` / `npm run build:mjs` / `npm run build:types` — build one output target only
- `npm run clean` — remove all build/test artifacts (`dist/`, `coverage/`, `node_modules/`)
- `npm run clean:dist` / `clean:cjs` / `clean:mjs` / `clean:types` / `clean:cov` / `clean:mod` — remove one artifact directory only

There is no separate lint script configured.

## Architecture

### Triple build output

Source lives only under `src/`. Four tsconfig files drive three separate `tsc` invocations against the same source tree, each targeting a different `dist/` subfolder:

- `tsconfig.json` — the shared base (strict mode, ES2022 target, `src/**/*` included, specs excluded). Not built directly.
- `tsconfig.cjs.json` extends the base with `module`/`moduleResolution: Node16` → `dist/cjs`
- `tsconfig.mjs.json` extends the base with `module`/`moduleResolution: NodeNext` → `dist/esm`
- `tsconfig.types.json` extends the base with `moduleResolution: bundler`, `emitDeclarationOnly` → `dist/types`

`package.json`'s `exports` map wires `require`/`import` consumers to the matching `dist/cjs` or `dist/esm` entry point, with `dist/types` supplying declarations for both. When changing module-resolution-sensitive code, keep in mind it must type-check under both `Node16` and `NodeNext` resolution.

There's also `src/tsconfig.json`, a separate no-emit config (extends `tsconfig.cjs.json`) — this is what editors/IDEs typically pick up for in-place type checking of `src/`, distinct from the three emit configs above.

### Public API surface

`src/index.ts` is the sole export barrel — everything a consumer can import must be re-exported from there. Each feature lives in its own subfolder under `src/` (e.g. `src/hash/`) with implementation and `*.spec.ts` colocated.

### Module documentation convention

Each module under `src/` has a corresponding usage guide under `documentation/<module>/usage.md`, linked from `documentation/README.md`. These docs are written as the contract for the module: they spell out business rules and the exact conditions under which the function throws, not just usage examples. When changing a module's behavior (especially error conditions or edge-case semantics), update its usage doc in the same change.

### Design pattern established by the hash module (`src/hash/deterministicObjectHash.ts`)

Modules in this library favor explicit, fully-specified behavior over convenience:
- Strict input validation with `TypeError` on any input outside the documented contract — no silent coercion or best-effort fallback.
- Distinct handling of `null` vs `undefined` vs an absent key, where that distinction is meaningful to callers.
- Output described as a locked contract: guaranteed stable for given inputs within a major version, with breaking changes to output only ever shipped as a major version bump.

Follow this pattern for new modules: define the exact input contract, reject anything outside it explicitly, and document the guarantees (not just the happy path) in the module's usage doc.

## Skills

This repo has skills installed via `skills-lock.json` (synced from `mattpocock/skills`). Notably `setup-ts-deep-modules` and `codebase-design` are relevant to how modules here should be shaped.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (antho686/nodejs-commons), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
