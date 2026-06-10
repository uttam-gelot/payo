<div align="center">

<img src="https://raw.githubusercontent.com/uttam-gelot/payo/main/assets/logo.png" alt="Payo" width="200" />

**Generate project-tailored AI assistant rules & skills in under two minutes.**

Payo interviews you about your stack, then writes the guidance files your AI
coding assistant reads — so Claude, Cursor, Copilot, and friends follow _your_
project's conventions instead of guessing.

[![CI](https://github.com/uttam-gelot/payo/actions/workflows/ci.yml/badge.svg)](https://github.com/uttam-gelot/payo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-black?logo=bun)](https://bun.sh)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Contents

- [What is Payo?](#what-is-payo)
- [Who is this for?](#who-is-this-for)
- [Quick Start](#quick-start)
- [How to use — a walkthrough](#how-to-use--a-walkthrough)
- [What gets generated](#what-gets-generated)
- [What it asks about](#what-it-asks-about)
- [AI vs. template generation](#ai-vs-template-generation)
- [Bootstrap prompt](#bootstrap-prompt)
- [Resume anytime](#resume-anytime)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)

## What is Payo?

AI coding assistants are only as good as the context they're given. Payo is an
interactive CLI that **interviews you about your project** — language, framework,
database, auth, testing, conventions — and then **generates the guidance files
your assistant actually reads.**

It supports **Claude, Cursor, GitHub Copilot, Codex, Windsurf, and Antigravity**.
Where the assistant ships a headless CLI, Payo drives that tool's own AI to
write rich, project-specific docs; where it doesn't, Payo falls back to solid
templates — so you always end up with usable output.

## Who is this for?

- **Devs starting a new repo** who want their AI assistant productive from
  commit #1, not after a dozen "actually, we do it this way" corrections.
- **Teams enforcing conventions** who need every contributor's assistant to
  follow the same folder structure, naming, testing, and git rules.
- **Multi-tool users** who switch between Claude, Cursor, and Copilot and want
  the _same_ project guidance expressed in each tool's native format.
- **Anyone bootstrapping a stack** they haven't wired up before — Payo encodes
  sensible, framework-specific defaults and can scaffold a runnable project.

If you've ever pasted the same "here's how this project works" preamble into a
chat for the third time, Payo is for you.

## Quick Start

No install required — run it in any project directory:

```bash
npx @uge/payo
# or
bunx @uge/payo
```

> The command you run after install is still `payo`. Install globally with
> `npm i -g @uge/payo` (or `bun add -g @uge/payo`), then just run `payo`.

Answer a short questionnaire about your stack, and Payo drops tailored AI
guidance files straight into your repo.

## How to use — a walkthrough

1. **Run Payo from your project root.** `npx @uge/payo` — it writes into the
   current directory, so `cd` into the repo first.
2. **Answer the questionnaire.** Pick your AI tool, project type, language,
   framework, and so on. Questions **adapt to your answers** — choose Next.js
   and you get Next.js-specific follow-ups; choose Postgres and you're asked
   about migrations and naming. Most prompts ship a **recommended default**, so
   you can blast through with <kbd>Enter</kbd>.
3. **Review your stack.** Before writing anything, Payo shows a summary of every
   answer and asks you to confirm. Say no and your answers are kept — rerun to
   edit them.
4. **Payo generates the guidance.** It writes each tool's files in their native
   format and location (see the table below). With the tool's CLI installed,
   files are generated in parallel by the AI; otherwise solid templates are used.
5. **(Optional) Get a bootstrap prompt.** Payo offers to write a paste-ready
   `bootstrap-prompt.md` you hand to any LLM to scaffold a runnable project that
   honors the guidance it just generated.
6. **Interrupted? Just rerun.** Progress lives under `.payo/`; Payo resumes and
   only generates what's missing.

## What gets generated

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

| Variable                | Default  | Purpose                              |
| ----------------------- | -------- | ------------------------------------ |
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

## Contributing

Contributions are welcome — new frameworks, ORMs, AI tools, and fixes. See
**[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, the project layout, how to add
a stack module, and the pre-PR checklist.

## License

[MIT](LICENSE)
