<div align="center">

# Payo

**Generate project-tailored AI assistant rules & skills in under two minutes.**

Payo interviews you about your stack, then writes the guidance files your AI
coding assistant reads — so Claude, Cursor, Copilot, and friends follow _your_
project's conventions instead of guessing.

[![CI](https://github.com/uttam-gelot/payo/actions/workflows/ci.yml/badge.svg)](https://github.com/uttam-gelot/payo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#license)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-black?logo=bun)](https://bun.sh)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Quick Start

No install required — run it in any project directory:

```bash
npx payo
# or
bunx payo
```

Answer a short questionnaire about your stack, and Payo drops tailored AI
guidance files straight into your repo.

## What is Payo?

AI coding assistants are only as good as the context they're given. Payo is an
interactive CLI that **interviews you about your project** — language, framework,
database, auth, testing, conventions — and then **generates the guidance files
your assistant actually reads.**

It supports **Claude, Cursor, GitHub Copilot, Codex, Windsurf, and Antigravity**.
Where the assistant ships a headless CLI, Payo drives that tool's own AI to
write rich, project-specific docs; where it doesn't, Payo falls back to solid
templates — so you always end up with usable output.

## How it works

1. **Answer the questionnaire.** A focused set of questions about your stack and
   conventions. Smart defaults mean you can accept recommendations and move fast.
2. **Payo generates the guidance.** It runs your AI tool's headless CLI in
   parallel to write tailored rules/skills — or writes static templates if the
   CLI isn't available.
3. **(Optional) Get a bootstrap prompt.** Payo can write a paste-ready
   `bootstrap-prompt.md` you hand to any LLM to scaffold a runnable project that
   honors the guidance it just generated.

## Supported AI tools

Each tool gets files in its own native format and location:

| Tool                 | Files generated                                                  |
| -------------------- | --------------------------------------------------------------- |
| Claude (Anthropic)   | `CLAUDE.md` · `.claude/skills/**`                               |
| Cursor               | `.cursorrules` · `.cursor/rules/**`                             |
| GitHub Copilot       | `.github/copilot-instructions.md` · `.github/instructions/**`  |
| Codex CLI            | `AGENTS.md`                                                      |
| Antigravity (Google) | `AGENTS.md` · `.agents/skills/**`                               |
| Windsurf             | `.windsurfrules`                                                 |
| Other / generic      | `AI_RULES.md`                                                    |

> Rich AI generation needs the selected tool's CLI on your `PATH`. Without it,
> Payo writes well-structured template defaults instead.

## What it asks about

Payo understands **25 frameworks, 24 ORMs, and 4 databases** across
**TypeScript/JavaScript, Python, Go, and Rust** — and tailors its follow-up
questions to whatever you pick. Dimensions covered:

- **Project** — type (frontend / backend / full-stack) and a short description
- **Language & framework** — plus framework-specific conventions
- **API** — REST, GraphQL, gRPC, tRPC
- **Frontend** — styling and state management
- **Data** — database and ORM/data-layer, with naming & migration conventions
- **Auth** — approach, session strategy, RBAC
- **Validation & logging** — stack-appropriate libraries
- **Testing** — unit / integration / component / E2E and runners
- **Tooling** — package manager, runtime, formatter, linter
- **TypeScript** — `tsconfig` strictness, target, module resolution, path aliases
- **Conventions** — folder structure, coding standards, docs, git workflow

## AI vs. template generation

Payo always leaves you with output. When the chosen assistant's headless CLI
is installed, it generates each guidance file in parallel from your answers —
richer and more specific. When the CLI is missing, or every run fails, it falls
back to static templates.

A few environment variables tune AI generation:

| Variable                   | Default  | Purpose                              |
| -------------------------- | -------- | ------------------------------------ |
| `PAYO_CONCURRENCY`      | `4`      | Max parallel agent subprocesses      |
| `PAYO_RETRIES`          | `1`      | Extra attempts after a failed run    |
| `PAYO_AGENT_TIMEOUT_MS` | `120000` | Wall-clock cap per file (ms)         |

## Bootstrap prompt

An empty repo with great guidance is still an empty repo. After generating, Payo
offers to write a **`bootstrap-prompt.md`** — a paste-ready prompt that tells any
LLM to scaffold a runnable project using the stack's **official tooling** (the
framework's own `create` command / CLI), honor the generated conventions, and
iterate with you until it runs.

## Resume anytime

Interrupt a run and pick up where you left off. Payo saves your questionnaire
answers and generation progress under `.payo/`; rerun and it resumes, only
generating what's missing. Finished runs clean the directory up automatically.

## Requirements

- [Bun](https://bun.sh) **>= 1.1.0**

## Development & Contributing

Contributions are welcome.

```bash
git clone https://github.com/uttam-gelot/payo.git
cd payo
bun install
bun dev          # run the CLI from source
```

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `bun dev`           | Run the CLI from source (no build)    |
| `bun run typecheck` | Type-check with `tsc --noEmit`        |
| `bun run lint`      | Lint `src` and `tests` with ESLint    |
| `bun run format`    | Format with Prettier                  |
| `bun test`          | Run the test suite                    |
| `bun run build`     | Bundle to `dist/`                      |

CI runs `typecheck`, `lint`, and `test` on every pull request — please make sure
they pass locally before opening one.

## License

[MIT](#license)
