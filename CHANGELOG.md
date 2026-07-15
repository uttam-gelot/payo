# Changelog

All notable changes to Payo are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  symlinks are unavailable, e.g. Windows without Developer Mode).
- The AI-tool question is reframed and rephrased ("Which AI CLI should Payo use
  to write your skills?"): it picks which agent CLI authors the content (the
  output works with every skills-compatible tool). Its options list only
  providers with a CLI runner, with no "recommended" tag.
- The welcome banner now describes the universal Agent Skills layout and the
  8-language stack detection.
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
  high-level stack" is unchanged (conventions still interviewed).
- Providers shrank to identity, `knownArtifacts` (kept for detection and the
  overwrite guard), and an optional CLI runner (`binary` + `buildArgs`); output
  paths and per-tool frontmatter are gone. `buildArgs` — the agent permission
  boundary — is unchanged.

### Added

- **Git convention detection.** Payo now infers your branch-naming and
  commit-message conventions by parsing recent **local** git history (branch
  names and commit subjects) — Conventional Commits, gitmoji, ticket-prefixed, or
  free-form; `feature/`-style, ticket-keyed, or kebab-case branches. The parse
  stays on your machine and is never placed in any AI prompt. New
  `branchNaming` / `commitConvention` questions carry it into the generated
  git-workflow guidance, each with an "Other" option for a custom format.
- `AGENTS.md` now opens its skills index with a directive telling the agent to
  consult and follow the applicable skills before writing or changing code — so
  the generated guidance is used, not merely listed. Written on both the
  AI-authored and static-template paths.
- Opt-in **change-audit** skill. The questionnaire (every project) asks whether
  to add it and, if so, when it runs — before every commit or before pushing.
  When enabled, Payo writes `.agents/skills/change-audit/SKILL.md`: a minimal,
  token-frugal skill the agent invokes at that point to read the pending change,
  smartly select only the relevant project skills (not every skill), and report
  anything that conflicts. Model-invoked only — no git hooks or runtime tooling.
- Monorepo workspace detection. On existing projects Payo now enumerates
  workspace members across pnpm / npm / yarn / lerna, Cargo, `go.work`, and
  Maven / Gradle, detects each package's stack, and surfaces the real app stack
  as the primary answers (the root manifest is usually just workspace config +
  shared tooling). The generated `AGENTS.md` gains a **Monorepo Structure**
  guidance section plus a **Workspace Packages** list naming each member and its
  stack. Single-package repos are unaffected.
- A "which AI tools should the skills support?" multiselect scopes shim output
  to the tools you actually use: only Claude Code (`.claude/skills` + `CLAUDE.md`)
  and Windsurf (`.windsurf/skills`) produce shim artifacts; tools that read
  `.agents/skills` natively (Codex, Cursor, Copilot, Antigravity) add nothing
  extra. It defaults to the generator CLI's own tool. `AGENTS.md` and
  `.agents/skills/**` are always written.
- On regeneration, Payo offers to remove retired per-tool config the universal
  layout supersedes (`.cursorrules`, `.windsurfrules`, `.cursor/rules`,
  `.github/instructions`, `.github/copilot-instructions.md`, `AI_RULES.md`) —
  opt-in, only after a successful write.
- Koa support on both paths: the questionnaire offers Koa (framework) with
  follow-ups for routing (`@koa/router`), body parsing, and security middleware,
  and detection reads `package.json` to recognize the `koa` dependency.
- PHP / Laravel support on both paths: the questionnaire offers Laravel
  (framework), Eloquent (ORM), Laravel Sanctum / Breeze / Passport (auth), and
  PHP-ecosystem tooling (Pint, PHPStan/Psalm, Monolog, PHPUnit/Pest, Symfony
  Console), and detection reads `composer.json` to pre-fill them.
- C# / .NET support on both paths: the questionnaire offers ASP.NET Core
  (framework), Entity Framework Core and Dapper (ORMs), SQL Server (database),
  and .NET-ecosystem tooling (dotnet format / CSharpier, Roslynator / StyleCop,
  Serilog / NLog, xUnit / NUnit / MSTest, FluentValidation, ASP.NET Core
  Identity / JWT Bearer, System.CommandLine / Spectre.Console), and detection
  reads `*.csproj` package references to pre-fill them.
- Java / Spring Boot support on both paths: the questionnaire offers Spring Boot
  (framework, Spring MVC / WebFlux), Spring Data JPA / Hibernate (ORM), Maven /
  Gradle build tools, and JVM-ecosystem tooling (Spotless / google-java-format,
  Checkstyle / PMD / SpotBugs, SLF4J+Logback / Log4j2, JUnit 5 / TestNG,
  Hibernate Validator, Spring Security / OAuth2, Picocli / Spring Shell), and
  detection reads `pom.xml` and `build.gradle(.kts)` to pre-fill them.
- Ruby / Rails support on both paths: the questionnaire offers Ruby on Rails
  (framework, Hotwire / jsbundling / API-only), Active Record (ORM), Devise /
  OmniAuth (auth), and Ruby-ecosystem tooling (RuboCop / StandardRB, Lograge /
  Semantic Logger, RSpec / Minitest, dry-validation, Thor / GLI), and detection
  reads the `Gemfile` to pre-fill them.

### Fixed

- The Antigravity provider wrote skills as flat `.agents/skills/<id>.md` files,
  which the Agent Skills spec — and every `.agents/skills` reader — cannot
  discover (it requires a `<id>/SKILL.md` directory whose name matches the
  `name` frontmatter). The universal layout fixes this by construction.

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

[Unreleased]: https://github.com/uttam-gelot/payo/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/uttam-gelot/payo/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/uttam-gelot/payo/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/uttam-gelot/payo/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/uttam-gelot/payo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/uttam-gelot/payo/compare/v0.3.5...v1.0.0
