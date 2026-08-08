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
├── providers/   # one entry per AI tool: id, display name, detection artifacts
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
| `bun run build:binaries`| Cross-compile the standalone binaries to `release/` |
| `bun run embed:assets` | Regenerate `src/cli/logo.data.ts` from `assets/` |

### Distribution

Payo ships two ways, from the same source:

- **npm** (`@uge/payo`) — `bun run build` produces the Node-targeted
  `dist/index.js`. This is what `npx @uge/payo` runs.
- **Standalone binaries** — `bun run build:binaries` compiles macOS
  (arm64/x64), Linux (x64/arm64) and Windows x64 executables into `release/`
  with a `SHA256SUMS`. The release workflow uploads them as GitHub Release
  assets, and `docs/install.sh` / `docs/install.ps1` download them. Pass a
  target name to build just one, e.g. `bun run build:binaries linux-x64`.

Because the binaries embed everything, the CLI must never read a file that
ships alongside it. The logo is handled by `scripts/embed-assets.ts`, which
bakes `assets/logo.ans` and `assets/logo.inline.png` into the committed
`src/cli/logo.data.ts`. Change either asset and you must re-run
`bun run embed:assets` — CI fails if that file is stale.

The install scripts accept `PAYO_API_URL` and `PAYO_RELEASE_BASE` overrides so
you can point them at a local server and test without cutting a release.

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

Each supported assistant has a provider in [`src/providers/`](src/providers/).
Output is universal — an `AGENTS.md` entrypoint plus `.agents/skills/` — so a
provider no longer owns a file format. It declares its id and display name, the
`knownArtifacts` used to detect an existing config, and an optional `agent` for
tools that ship a headless CLI (omit it for static-only tools like Windsurf and
Zed, which are then excluded from Q1 automatically).

Add the file, then register it by importing it and adding one
`registerProvider(...)` call in
[`src/providers/index.ts`](src/providers/index.ts) — registration order drives
the picker order. A tool that does not read `.agents/skills/` natively also
needs an entry in `SHIM_TOOLS`
([`src/generator/shims.ts`](src/generator/shims.ts)); most tools do read it and
need nothing. A tool with a script-executing pre-tool hook needs an entry in
`ASK_TOOLS` ([`src/generator/hooks.ts`](src/generator/hooks.ts)).

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
