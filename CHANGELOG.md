# Changelog

All notable changes to Payo are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
