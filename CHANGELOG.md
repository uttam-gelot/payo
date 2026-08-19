# Changelog

All notable changes to Payo are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **New "AI writing conventions" question.** Previously the only choice about
  AI-generated text was whether commits/PRs got an attribution trailer, asked
  as a lone yes/no buried in the git-workflow questions. It's now a multiselect
  covering that same choice plus two new options — no em dash (—) in written
  text, and ASD-STE100 Simplified Technical English — and lives with the other
  Conventions questions rather than under Git Workflow, since it applies to all
  generated prose, not just commits.
- **You now see and can trim the exact skill list before Payo writes anything.**
  Previously the set of `.agents/skills/` files Payo would generate was decided
  entirely by your interview answers, with no chance to review or drop one —
  the only lever was answering an earlier question differently, which meant
  losing that answer everywhere, not just for one skill. Right before
  generation, Payo now shows the computed list (every skill preselected) and
  lets you uncheck any you don't want a file for. Skipped automatically when
  there's only zero or one skill to decide between.
- **You now choose which git hook runner Payo sets up.** A repo with no hooks
  always got a `lefthook.yml`, whether or not lefthook was a tool your team
  wanted to install. Payo now asks, offering **Lefthook**, **Husky**,
  **pre-commit**, plain **`.githooks/`** scripts, or **none at all**, and writes
  that runner's own config — `.husky/pre-push`, a fresh `.pre-commit-config.yaml`
  with its `repos:` key, or executable `.githooks/` scripts. No option is marked
  recommended: which runner a team wants is a convention, not a property of the
  stack. Picking none writes no hook config, and the generated skills keep asking
  the assistant to run the checks by hand. The question only appears on a repo
  that has no runner yet — one that already has hooks is still asked the existing
  "leave them alone / add what's missing" question instead.
- Each fresh hook config carries a header naming the runner, how to install it,
  and the one command that activates it; the post-run note repeats that command
  and skips the install line when the binary is already on your PATH.

### Fixed

- **A hook that ran several checks could pass despite one of them failing.**
  Husky and native `.githooks/` hooks are shell scripts, which exit with the
  status of their last line — so a failing secret scan was swallowed whenever
  the format check after it passed. Every check Payo writes now carries its own
  `|| exit 1`.
- The post-generation "Git hooks" note went silent about the setup commands
  whenever Payo had just written a hook config: the plan was recomputed after
  the write, so the runner Payo had added looked like one the repo already had.
- `payo --help` advertised a 120000 ms agent timeout two releases after the real
  default moved to 420000, and still described the retired per-tool output
  formats (`.cursorrules`, …) instead of the universal layout. Both corrected,
  and a test now asserts the printed defaults against `src/config.ts`.

## [2.3.1] - 2026-07-28

### Added

- **Payo now reads what your existing git hooks already cover.** Hook detection
  returns a per-stage capability map (secret scan / verify / lint / format)
  instead of matching one regex over the whole file, so a repo already running
  trufflehog counts as having a secret scan and lint-staged counts as lint.
  Three runners that were previously missed are recognized: lefthook configured
  inside `package.json`, **simple-git-hooks**, and a committed `.githooks/`
  directory. What was found is shown in the detection summary. (#55)
- **A new question decides what happens to an existing hook runner — and the
  default flipped to leaving it alone.** Payo used to append to your
  husky/lefthook/pre-commit setup without asking. It now **leaves it completely
  untouched** unless you explicitly choose to merge, and only asks at all when
  the repo has an extendable runner *and* a check you enabled that nothing
  covers. `simple-git-hooks` is never written to (its config maps a stage to a
  single command string, so appending would clobber yours). (#55)
- **The linter and a format check are now actually enforced.** The
  verify-before-commit/push guardrail promised "the formatter, linter, and
  tests" but only ever wrote the test command. All three are emitted now, with
  formatters always in **check-only** form so a hook never rewrites files behind
  you. Tools with no standalone hook command (Checkstyle, PMD, SpotBugs) are
  deliberately left out rather than faked. (#55)

### Fixed

- **The agent and the git hook no longer do the same work twice.** The hook
  writer emitted commands while the generated prose separately told the
  assistant to run the same ones by hand — so the agent scanned, linted and
  tested, then the hook ran everything again on push. A single hook plan is now
  computed once per run and every check lands in exactly one bucket: written
  into the hook, covered by a hook already in the repo, or deferred to the
  agent. `AGENTS.md`, the git-workflow skill and change-audit all read that plan
  and tell the assistant **not** to re-run what a hook runs — commit or push,
  and fix what the hook reports. (#55)
- **The change-audit gate denies once instead of asking.** A confirm prompt goes
  to the *human*, and its reason never reaches the model — approving it simply
  skipped the audit. The gate now **denies the command once per change set**
  (keyed on HEAD / the staged-tree hash, stored inside the git dir) with an
  instruction back to the agent; the retry for that same change goes through.
  Confirm-push and DB-safety still raise a prompt for you. Also fixes a second
  gate on `git push` being dropped entirely, and shell-quotes the interpolated
  message. (#55)
- **Hook edits are idempotent per check, not per file.** Any `payo:` marker
  anywhere in the config used to make Payo skip the whole merge, so enabling
  gitleaks on one run and verify-before-push on the next silently dropped the
  second. Matching is now per `payo:<name>` marker. Native gates **upsert** —
  earlier Payo entries are replaced, yours are preserved — and are compared on
  the command rather than the serialized file, so a differently indented config
  is never reformatted. (#55)

### Changed

- The post-generation report now names the checks you enabled that **nothing**
  runs — the real outcome of keeping an existing hook setup — instead of
  implying coverage Payo didn't write. (#55)

## [2.3.0] - 2026-07-27

### Added

- **Install without Node.js.** Payo can now be installed with a one-line script
  on macOS, Linux, and Windows — `curl -fsSL https://payo.uttamgelot.com/install.sh | sh`
  or `irm https://payo.uttamgelot.com/install.ps1 | iex` — so developers in
  ecosystems Payo supports but that don't ship a JavaScript runtime (Rust, C#,
  Go, Java, PHP, Ruby, Python) no longer need `npx`/`bunx`. The installer prefers
  a runtime you already have (`bun`, then `npm` with node >= 20.12, a ~300 KB
  download) and only falls back to a self-contained binary when there is none.
  It is safe to re-run: it reports when you are already current, upgrades when
  you are not, verifies every download against the release `SHA256SUMS`, removes
  older copies left in other install locations so nothing shadows the new one on
  `PATH`, and never invokes `sudo`. Override with `PAYO_VERSION`,
  `PAYO_INSTALL_DIR`, `PAYO_INSTALL_METHOD`, or `PAYO_FORCE`. `npx @uge/payo`
  and `bunx @uge/payo` are unchanged.
- **Standalone binaries on every release.** Self-contained executables for
  macOS (arm64/x64), Linux (x64/arm64), and Windows x64 are built with
  `bun build --compile` and published as GitHub Release assets alongside a
  `SHA256SUMS`. They embed the runtime and need nothing installed. Alpine/musl
  and Windows on ARM have no binary; the installer detects both and points at
  npm rather than producing something that cannot start. Two new scripts back
  this: `bun run build:binaries` cross-compiles the five targets and writes the
  checksums, and `bun run embed:assets` inlines the logo before the build.

### Changed

- `payo --help` now shows `payo` in its usage lines instead of `npx @uge/payo`,
  matching how the CLI is invoked once installed by any method.
- The logo assets are baked into the bundle at build time
  (`bun run embed:assets` → `src/cli/logo.data.ts`) rather than read from disk
  at startup, which is what allows a single-file binary. The banner renders
  identically; the npm tarball no longer ships `assets/`.

## [2.2.1] - 2026-07-26

### Fixed

- **Headless skill generation on current Codex and Antigravity CLIs.** Both
  CLIs changed under Payo's frozen argv and both failure modes ended in exit 0,
  so generation silently produced nothing. `codex exec` now runs with
  `--sandbox workspace-write --skip-git-repo-check` and a writable-root override
  for `.agents` (its sandbox denies writes to dot-directories, where every
  `SKILL.md` lives), and `agy` is pinned to the project with `--add-dir <cwd>`
  instead of writing into its own scratch dir. Both flag sets are gated on the
  installed CLI's own help output, so older versions keep their previous
  invocation. (#53)
- Every failed skill attempt now writes the full transcript (argv, prompt,
  stdout, stderr) to `.payo/logs/<skill>-attempt<N>.log` and the reported reason
  cites the path — enough to tell a sandbox denial from a quota error from a
  refusal. Output streams are retained as tails rather than heads, because these
  CLIs open with a session banner and report the real failure last. (#53)
- Account-level failures (usage limit, rate limit, 401/429, not logged in) now
  short-circuit the batch instead of every remaining skill burning its retries
  against a limit that is already exhausted. (#53)
- Each skill's target directory is created before the run, since sandboxed
  agents are routinely allowed to write a file but not to create the
  dot-directory holding it. (#53)
- Hook writing dedupes against the runner already in the repo, matching on
  capability rather than Payo's own marker, so re-running into a configured
  husky/lefthook/pre-commit repo adds nothing. A frameworkless stack now falls
  back to the package manager's test script, so `lefthook.yml` gets a verify
  check instead of none. (#53)

### Changed

- The per-run agent timeout goes from 120s to 420s. Prompts have grown and
  several agents run at once, which was killing healthy runs. (#53)
- The lefthook banner reads "Created by Payo" and spells out how to install the
  lefthook binary (brew/npm/go) before `lefthook install`. (#53)

## [2.2.0] - 2026-07-26

### Added

- **Skill-enforcement hooks.** Guardrail skills are markdown an agent can skip,
  so Payo now writes the hooks that make them fire. When you enable the gitleaks
  scan or verify-before-commit/push, Payo writes a **`lefthook.yml`** — or, if the
  repo already uses **husky**, **pre-commit**, or native `.git/hooks`, merges into
  that runner instead of clobbering it — that runs gitleaks and your test command
  at the stage you chose and **hard-blocks** the commit/push on failure (covering
  humans too). For **Claude, Cursor, and Copilot**, it also writes a native
  `PreToolUse` **soft-confirm** hook that prompts right when the agent runs
  `git commit` / `git push` (change-audit, confirm-push) or a destructive query
  (DB-safety); Codex, Antigravity, and Windsurf are covered by the git hook. Every
  edit is idempotent, and hooks are written only for the guardrails you enabled.
  Payo writes config only — you run `lefthook install` once (it installs nothing).
  This reverses the earlier "model-invoked skill, no git hooks" stance
  (see [2.0.0]) in favor of an enforcement guarantee.

## [2.1.3] - 2026-07-21

### Added

- **Database safety guardrail.** A new confirm question (asked whenever a database
  is selected) has the assistant require explicit confirmation before running any
  destructive SQL or database migration. It's a safe policy — recommended on and
  applied in "Detect everything" — and surfaces in the generated data-layer skill
  and the static AGENTS.md Data section.
- **Gitleaks secret-scan convention.** A new git-workflow confirm question adds a
  convention to the generated skills that scans for leaked secrets with gitleaks
  before every push. Payo installs nothing — when enabled, the generated
  git-workflow guidance tells the assistant to run gitleaks before pushing (and to
  install it if missing). Recommended on and carried through "Detect everything".

## [2.1.2] - 2026-07-18

### Changed

- AI skill generation now surfaces the agent's own failure reason when a run
  fails. Instead of a generic "generation failed", the CLI reports the
  underlying cause reported by the agent CLI (timeout, permission denial,
  non-zero exit, empty output), so a failed file is easier to diagnose and
  retry. (#49)

## [2.1.1] - 2026-07-18

### Fixed

- Synthetic detection facts (values inferred rather than read verbatim from a
  manifest) were dropped when the detection result was reconciled with the
  questionnaire answers. They now survive reconcile, so a detected-but-inferred
  stack fact is no longer silently lost before generation. (#48)

## [2.1.0] - 2026-07-17

### Added

- **Hybrid / polyglot project detection.** A monorepo mixing stacks (e.g. a
  React frontend next to a Rust backend) is now detected as one: the repo's
  `projectType` is aggregated across packages (frontend + backend members →
  full-stack), extra languages are reported as **Additional languages** in the
  generated Tech Stack (with the dirs that carry them) and as an "Also
  detected" line in the detection summary, and root `package.json` scripts
  (`cargo build`, a dedicated e2e vitest config, playwright/cypress) serve as
  fill-only signals for stacks the manifests hide.
- **Nested workspace enumeration.** Workspace roots that are not declared as
  members of the root workspace — a Cargo `[workspace]` at `services/`, a
  nested `go.work` or `pnpm-workspace.yaml` — are found by a depth-2 scan and
  their members enumerated, along with undeclared manifest-bearing dirs once
  the repo already reads as a monorepo. Large same-language workspaces render
  collapsed (`services — rust workspace (8 packages)`).
- **Stage 2 reads your docs and every manifest.** The optional LLM pass now
  receives every root manifest (labeled, size-capped) plus the manifest of
  each distinct-language workspace root, and capped excerpts of `README.md`,
  `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and
  `docs/*.md` — fenced as untrusted project data. When the evidence
  contradicts a deterministic answer, the agent reports it on a validated
  `__conflicts` channel instead of overriding: the CLI shows the conflict and
  (in stack-only mode) re-asks that question with the suggestion pre-selected.

### Fixed

- A monorepo whose primary stack came from a workspace member discarded the
  root detection wholesale, losing repo-level facts — `packageManager: bun`,
  `runtime: bun`, `testRunner`, `formatter` — that live at the root of a
  hoisted monorepo (Stage 2 would then guess `npm`). Root repo-level facts now
  survive the merge, and a TypeScript root corrects a hoisted member that
  reads as javascript.
- A successful Stage-2 pass dropped the monorepo package list (and secondary
  languages) from the detection result.

## [2.0.2] - 2026-07-17

### Changed

- **"Detect everything" is now recommended** as the default path for existing
  projects, and the change-audit skill defaults to running **before push**.
  Both are still shown up front and editable — the recommendation just matches
  what most existing-project runs want. (#46)

## [2.0.1] - 2026-07-15

### Added

- **Git convention detection.** Payo now infers your branch-naming and
  commit-message conventions by parsing recent **local** git history (branch
  names and commit subjects) — Conventional Commits, gitmoji, ticket-prefixed, or
  free-form; `feature/`-style, ticket-keyed, or kebab-case branches. The parse
  stays on your machine and is never placed in any AI prompt. New
  `branchNaming` / `commitConvention` questions carry it into the generated
  git-workflow guidance, each with an "Other" option for a custom format.

### Changed

- **"Detect everything" now treats the existing code as the source of truth.**
  It records exactly what it detects (stack, conventions, and git branch/commit
  style) and **skips anything it can't find** — no skill is created for it and it
  is not mentioned. Undetected topics are no longer filled with recommended
  defaults, so it no longer fabricates testing, API versioning, folder structure,
  or auth the project doesn't have. Only a small set of safe assistant policies
  (no AI attribution, task-scoped/atomic commits, confirm-before-push,
  verify-before-push, `.env.example`-only, DRY/modular standards) are applied
  without detection — shown explicitly up front and editable on the review screen.
  The generated skills document the conventions actually present in the code
  (e.g. no `/v1` versioning is prescribed unless the API is versioned). "Just the
  high-level stack" is unchanged (conventions still interviewed). (#45)

### Fixed

- The bootstrap prompt, git-workflow skill, and generated rules mentioned
  tests for projects whose testing was skipped ("run the formatter, linter,
  and tests…"). All test commands and test prose are now gated on testing
  actually being selected, and only the chosen tools are named.

## [2.0.0] - 2026-07-14

### Changed

- **Universal output layout (breaking).** Payo now emits one tool-agnostic
  layout regardless of the selected CLI — an `AGENTS.md` entrypoint, a
  `CLAUDE.md` `@AGENTS.md` import shim, and one Agent Skills file per topic at
  `.agents/skills/<id>/SKILL.md` (spec frontmatter: `name` == directory,
  `description`, custom fields under `metadata`). The per-tool formats
  (`.cursorrules`, `.cursor/rules/*.mdc`, `.github/instructions/*`,
  `.windsurfrules`, `AI_RULES.md`, and the single-file `AGENTS.md` merge) are
  retired. Claude Code and Windsurf are covered by `.claude/skills` and
  `.windsurf/skills` shims (relative symlinks; recursive directory copies where
  symlinks are unavailable, e.g. Windows without Developer Mode). (#41)
- The AI-tool question is reframed and rephrased ("Which AI CLI should Payo use
  to write your skills?"): it picks which agent CLI authors the content (the
  output works with every skills-compatible tool). Its options list only
  providers with a CLI runner, with no "recommended" tag.
- The welcome banner now describes the universal Agent Skills layout and the
  8-language stack detection.
- Providers shrank to identity, `knownArtifacts` (kept for detection and the
  overwrite guard), and an optional CLI runner (`binary` + `buildArgs`); output
  paths and per-tool frontmatter are gone. `buildArgs` — the agent permission
  boundary — is unchanged.

### Added

- `AGENTS.md` now opens its skills index with a directive telling the agent to
  consult and follow the applicable skills before writing or changing code — so
  the generated guidance is used, not merely listed. Written on both the
  AI-authored and static-template paths. (#44)
- Opt-in **change-audit** skill. The questionnaire (every project) asks whether
  to add it and, if so, when it runs — before every commit or before pushing.
  When enabled, Payo writes `.agents/skills/change-audit/SKILL.md`: a minimal,
  token-frugal skill the agent invokes at that point to read the pending change,
  smartly select only the relevant project skills (not every skill), and report
  anything that conflicts. Model-invoked only — no git hooks or runtime tooling. (#44)
- Monorepo workspace detection. On existing projects Payo now enumerates
  workspace members across pnpm / npm / yarn / lerna, Cargo, `go.work`, and
  Maven / Gradle, detects each package's stack, and surfaces the real app stack
  as the primary answers (the root manifest is usually just workspace config +
  shared tooling). The generated `AGENTS.md` gains a **Monorepo Structure**
  guidance section plus a **Workspace Packages** list naming each member and its
  stack. Single-package repos are unaffected. (#43)
- A "which AI tools should the skills support?" multiselect scopes shim output
  to the tools you actually use: only Claude Code (`.claude/skills` + `CLAUDE.md`)
  and Windsurf (`.windsurf/skills`) produce shim artifacts; tools that read
  `.agents/skills` natively (Codex, Cursor, Copilot, Antigravity) add nothing
  extra. It defaults to the generator CLI's own tool. `AGENTS.md` and
  `.agents/skills/**` are always written. (#41)
- On regeneration, Payo offers to remove retired per-tool config the universal
  layout supersedes (`.cursorrules`, `.windsurfrules`, `.cursor/rules`,
  `.github/instructions`, `.github/copilot-instructions.md`, `AI_RULES.md`) —
  opt-in, only after a successful write. (#41)

### Fixed

- Bootstrap generation is skipped on existing projects (there's already a
  project to bootstrap), and the questionnaire lets you choose when the
  verify/change-audit step runs. (#42)
- The Antigravity provider wrote skills as flat `.agents/skills/<id>.md` files,
  which the Agent Skills spec — and every `.agents/skills` reader — cannot
  discover (it requires a `<id>/SKILL.md` directory whose name matches the
  `name` frontmatter). The universal layout fixes this by construction. (#41)

## [1.4.0] - 2026-07-11

### Added

- Ruby / Rails support on both paths: the questionnaire offers Ruby on Rails
  (framework, Hotwire / jsbundling / API-only), Active Record (ORM), Devise /
  OmniAuth (auth), and Ruby-ecosystem tooling (RuboCop / StandardRB, Lograge /
  Semantic Logger, RSpec / Minitest, dry-validation, Thor / GLI), and detection
  reads the `Gemfile` to pre-fill them. (#40)
- Java / Spring Boot support on both paths: the questionnaire offers Spring Boot
  (framework, Spring MVC / WebFlux), Spring Data JPA / Hibernate (ORM), Maven /
  Gradle build tools, and JVM-ecosystem tooling (Spotless / google-java-format,
  Checkstyle / PMD / SpotBugs, SLF4J+Logback / Log4j2, JUnit 5 / TestNG,
  Hibernate Validator, Spring Security / OAuth2, Picocli / Spring Shell), and
  detection reads `pom.xml` and `build.gradle(.kts)` to pre-fill them. (#39)
- Koa support on both paths: the questionnaire offers Koa (framework) with
  follow-ups for routing (`@koa/router`), body parsing, and security middleware,
  and detection reads `package.json` to recognize the `koa` dependency. (#38)
- C# / .NET support on both paths: the questionnaire offers ASP.NET Core
  (framework), Entity Framework Core and Dapper (ORMs), SQL Server (database),
  and .NET-ecosystem tooling (dotnet format / CSharpier, Roslynator / StyleCop,
  Serilog / NLog, xUnit / NUnit / MSTest, FluentValidation, ASP.NET Core
  Identity / JWT Bearer, System.CommandLine / Spectre.Console), and detection
  reads `*.csproj` package references to pre-fill them. (#37)

## [1.3.0] - 2026-07-09

### Added

- PHP / Laravel support on both paths: the questionnaire offers Laravel
  (framework), Eloquent (ORM), Laravel Sanctum / Breeze / Passport (auth), and
  PHP-ecosystem tooling (Pint, PHPStan/Psalm, Monolog, PHPUnit/Pest, Symfony
  Console), and detection reads `composer.json` to pre-fill them. (#36)

## [1.2.0] - 2026-07-03

### Security

- Spawned agent CLIs run with the narrowest write permission each tool supports:
  Copilot now uses `--allow-tool write` (shell stays denied) instead of
  `--allow-all-tools`, and Antigravity adds `--sandbox` alongside its
  permission skip.
- Untrusted text (free-text answers, values detected from repository files) is
  fenced between explicit `PROJECT DATA` markers in every agent prompt, with an
  instruction that it is data, never directives.

### Fixed

- Agent runs are verified by an actual write: a pre-existing file left
  untouched by a no-op run, an empty file, or a directory no longer counts as
  success, and partial output from failed attempts is removed before retrying.
- Serverless/compatible databases (Neon, Supabase, CockroachDB, MariaDB, Turso)
  now get their wire-compatible engine's follow-up questions, guidance, and
  migrate command instead of name-only output.
- A repo containing both a UI framework and a server framework (e.g. React +
  Express) is detected as full-stack instead of frontend.
- Stack values guessed by the optional LLM pass are pre-selected but still
  asked, instead of being recorded as hard facts the interview skips.
- Editing an answer now also drops dependent answers whose stored value fell
  out of the narrowed option set (e.g. `rust` after switching to a frontend
  project).
- On the multiselect "Customize" path, options tagged `recommended` start
  checked.
- Python dependency names are PEP 503-normalized (`psycopg2_binary` now
  matches), Cargo per-crate sub-tables and `[workspace.dependencies]` are
  parsed, `.github`/`.gitignore` are no longer dropped from the detection tree,
  and JSONC parsing no longer corrupts `//` inside string values.

### Changed

- The npm package no longer ships the demo GIF and full-size logo — the
  tarball drops from 8.3 MB to about 250 KB.
- `package.json` now declares the actual runtime requirement (`node >= 20.12`,
  set by `@clack/prompts`' use of `util.styleText` — the previous "Node >= 18"
  claim crashed at startup); Bun remains a development-only requirement.
- The primary-language question is a closed set — every downstream option list
  is keyed by the supported languages.

## [1.1.2] - 2026-07-03

### Fixed

- AI-mode output correctness: generated skill files always carry the
  provider-required frontmatter, the tool's canonical entrypoint
  (`CLAUDE.md` / `AGENTS.md` / …) is always written in AI mode, backups touch
  only the files the current run will write, and the Stage-2 detection prompt
  receives the manifest matching the detected ecosystem. (#33)

## [1.1.1] - 2026-07-01

### Fixed

- Honest Stage-2 progress reporting, false-positive hardening in detection, and
  ecosystem parity fixes. (#32)

## [1.1.0] - 2026-06-30

### Added

- Improved stack auto-detection flow: intent gates (existing project vs fresh
  start, stack-only vs everything), detection summary, and seeded convention
  pre-fills. (#31)

### Fixed

- P0 stack-detection bugs: crash guard around detection, detected ORMs no
  longer dropped, stale Tier-1 facts no longer leak into generation. (#30)

## [1.0.0] - 2026-06-29

### Added

- Stack auto-detection for existing projects: reads `package.json`,
  `pyproject.toml`, `go.mod`, `Cargo.toml`, lockfiles, tool configs, and the
  folder layout across TypeScript/JavaScript, Python, Go, and Rust, then
  pre-fills the questionnaire. Optional second pass drives the user's own AI
  CLI to fill gaps. (#29)

### Fixed

- Static-fallback targets are included in overwrite prediction, so a
  pre-existing `CLAUDE.md` can no longer be clobbered outside the overwrite
  prompt. (#28)

[Unreleased]: https://github.com/uttam-gelot/payo/compare/v2.3.1...HEAD
[2.3.1]: https://github.com/uttam-gelot/payo/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/uttam-gelot/payo/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/uttam-gelot/payo/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/uttam-gelot/payo/compare/v2.1.3...v2.2.0
[2.1.3]: https://github.com/uttam-gelot/payo/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/uttam-gelot/payo/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/uttam-gelot/payo/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/uttam-gelot/payo/compare/v2.0.2...v2.1.0
[2.0.2]: https://github.com/uttam-gelot/payo/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/uttam-gelot/payo/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/uttam-gelot/payo/compare/v1.4.0...v2.0.0
[1.4.0]: https://github.com/uttam-gelot/payo/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/uttam-gelot/payo/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/uttam-gelot/payo/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/uttam-gelot/payo/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/uttam-gelot/payo/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/uttam-gelot/payo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/uttam-gelot/payo/compare/v0.3.5...v1.0.0
