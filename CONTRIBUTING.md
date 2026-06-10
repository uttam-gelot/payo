# Contributing to Payo

Thanks for your interest in improving Payo! New frameworks, ORMs, AI-tool
providers, bug fixes, and docs are all welcome.

## Getting started

```bash
git clone https://github.com/uttam-gelot/payo.git
cd payo
bun install
bun dev          # run the CLI from source (no build step)
```

`bun dev` runs `src/index.ts` directly, so you can iterate on the questionnaire
and generators without rebuilding.

## Project layout

```
src/
├── cli/         # entry point + run orchestration (banner, resume, generate)
├── questions/   # the questionnaire: flow definition + engine + runner
├── stack/       # tech modules (frameworks, ORMs, databases) + registry
│   ├── modules/ # one file per technology, grouped by category
│   ├── predicates.ts  # appliesTo helpers (isTsJs, hasModeledDb, …)
│   └── commands.ts    # pm/scaffold command helpers (pmCreate, pmRun, …)
├── generator/   # turns answers into files (AI agent runs or static templates)
├── providers/   # per-AI-tool file format + output location
└── state/       # .payo/ session: save answers + resume progress
```

## Dev scripts

| Script                 | What it does                          |
| ---------------------- | ------------------------------------- |
| `bun dev`              | Run the CLI from source (no build)    |
| `bun run typecheck`    | Type-check with `tsc --noEmit`        |
| `bun run lint`         | Lint `src` and `tests` with ESLint    |
| `bun run format`       | Format with Prettier                  |
| `bun run format:check` | Check formatting without writing      |
| `bun test`             | Run the test suite                    |
| `bun run test:watch`   | Run tests in watch mode               |
| `bun run test:coverage`| Run tests with coverage               |
| `bun run build`        | Bundle to `dist/`                     |

## How to add a stack module

A "stack module" is a single technology — a framework, ORM, or database. Each
one is a `TechModule` object. Use an existing module as a template;
[`src/stack/modules/framework/hono.ts`](src/stack/modules/framework/hono.ts) is
a good, compact reference:

```ts
import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';
import { pmCreate, pmRun } from '../../commands';

export const hono: TechModule = {
  id: 'hono',
  title: 'Hono',
  category: 'framework',                 // 'framework' | 'orm' | 'db' | …
  appliesTo: (a) =>                       // when is this module offered?
    isTsJs(a) && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'hono', label: 'Hono' }],
  questions: () => [                      // stack-specific follow-up questions
    { id: 'hono.runtime', type: 'select', summary: 'Runtime', message: 'Target runtime?', options: [/* … */] },
  ],
  scaffold: (a) => pmCreate(a, 'hono'),   // official create command
  devCommand: (a) => pmRun(a, 'dev'),
  testCommand: (a) => pmRun(a, 'test'),
  buildCommand: (a) => pmRun(a, 'build'),
};
```

Steps:

1. **Create the file** under the right category folder
   (`src/stack/modules/framework/`, `/orm/`, or `/db/`).
2. **Implement the `TechModule`** — see the `TechModule` shape in
   [`src/stack/types.ts`](src/stack/types.ts). Reuse the predicates in
   [`src/stack/predicates.ts`](src/stack/predicates.ts) for `appliesTo`, and the
   command helpers in [`src/stack/commands.ts`](src/stack/commands.ts) for the
   scaffold/dev/test/build commands rather than hardcoding shell strings.
3. **Register it** by importing and adding it to the array in
   [`src/stack/modules/index.ts`](src/stack/modules/index.ts).
4. **Run `bun dev`** and walk the questionnaire to confirm your module shows up
   and its follow-up questions appear, then `bun run typecheck && bun test`.

ORM and database modules follow the same pattern — just set `category`
accordingly and gate `appliesTo` on language/db predicates.

## Adding a new AI tool / provider

Each supported assistant has a provider in
[`src/providers/`](src/providers/) defining the file format and output location
it writes (e.g. `CLAUDE.md`, `.cursorrules`). Add a new provider there and wire
it into [`src/providers/registry.ts`](src/providers/registry.ts).

## Before opening a PR

Make sure these pass locally — CI (`.github/workflows/ci.yml`) runs the same
checks on every pull request:

```bash
bun run typecheck && bun run lint && bun test
```

- Match the existing **Conventional Commits** style for PR titles
  (`feat: …`, `fix: …`, `docs: …`).
- Keep changes focused; add or update tests under `tests/` when you change
  behavior.

## Reporting bugs & ideas

Open an issue at <https://github.com/uttam-gelot/payo/issues>. For bugs, include
your OS, Bun version, the AI tool you selected, and the answers (or stack) that
triggered the problem.
