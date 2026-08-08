# Zed editor support — RnD and implementation plan

> Research verified against the live Zed docs on 2026-08-07 (Zed 1.4.x). Every Zed claim
> below is linked to its source page; anything Zed does not document is called out as
> such rather than guessed at.
>
> **Implementation status.** Parts 1 (provider), 3 (precedence warning), 4 (docs) and 5
> (tests) have shipped. **Part 2 — the `.zed/settings.json` `agent.tool_permissions`
> writer — is deferred**, because Zed documents those keys only for the global
> `~/.config/zed/settings.json` and it is unverified whether they take effect in a
> project-level file. Until someone confirms that in a real Zed install, Payo writes no
> `.zed/` file at all and Zed's guardrails come from the mechanical git hook alone —
> the same posture as Windsurf. See "Scope hazard" under part 2.

## Context

Payo supports seven AI tools today — `claude`, `codex`, `antigravity`, `cursor`,
`copilot`, `windsurf`, `other` — registered in `src/providers/index.ts:15-21`. Zed is
missing. Zed ships a first-class Agent Panel that reads the exact universal layout Payo
already emits, so a Zed user gets no Payo entry in the tool picker despite Payo's output
being natively compatible with their editor.

Three researched facts shape the whole design:

1. **Zed reads `.agents/skills/` natively** — global `~/.agents/skills/`, project
   `<worktree>/.agents/skills/`, flat direct children only (nested folders are *not*
   discovered), `name` + `description` frontmatter, project-local skills load only from
   trusted worktrees. ([docs](https://zed.dev/docs/ai/skills)) Payo's
   `.agents/skills/<id>/SKILL.md` layout (`src/generator/universal.ts:29,36`) and its
   spec-only frontmatter (`universal.ts:45-55`) already satisfy this exactly.
   **No discovery shim is needed** — Zed is not a `SHIM_TOOLS` case like Claude/Windsurf.
2. **Zed has no script-executing hook.** There is no `PreToolUse` equivalent. Its only
   analog is declarative Rust-regex permissions at `agent.tool_permissions` in
   settings.json — it can raise a confirm prompt, but it cannot run Payo's gate script,
   cannot read the change-audit receipt, and cannot pass a reason string back to the
   agent. ([docs](https://zed.dev/docs/ai/tool-permissions))
3. **Zed reads only the FIRST matching instruction file**, in this order:
   `.rules` → `.cursorrules` → `.windsurfrules` → `.clinerules` →
   `.github/copilot-instructions.md` → `AGENT.md` → `AGENTS.md` → `CLAUDE.md` →
   `GEMINI.md`. ([docs](https://zed.dev/docs/ai/instructions)) Payo's `AGENTS.md` is
   **7th of 9**. Any of the six higher-priority files present in the repo means Payo's
   entrypoint is silently ignored.

Intended outcome: Zed appears in the support-tools picker; its skills work with zero new
writers; its guardrails get a best-effort native confirm gate on top of the existing
mechanical git-hook floor; and the user is warned when a higher-precedence instruction
file would shadow `AGENTS.md`.

## Zed's AI surface — what exists, and what Payo can use

| Zed feature | Location | Usable by Payo? |
| --- | --- | --- |
| Skills | `~/.agents/skills/`, `<worktree>/.agents/skills/` | **Yes — already emitted, no work** |
| Instructions | `.rules` … `AGENTS.md` … (9-file precedence chain) | Yes, via existing `AGENTS.md`; precedence is a hazard |
| Tool permissions | `agent.tool_permissions` in settings.json | Partially — declarative confirm/deny only |
| MCP ("context servers") | `context_servers` in settings.json | Out of scope — Payo has no MCP support at all |
| External agents (ACP) | `agent_servers` in settings.json | Out of scope |
| Tasks | `.zed/tasks.json` | No — its `hooks` field only fires on `create_worktree` |
| Prompt / Rules Library | *removed in Zed 1.4.0, replaced by Skills* | N/A |

Two Zed notes worth recording because they are easy to get wrong:

- The **Rules Library is gone** as of Zed 1.4.0 — replaced by Skills, `@rule` became
  `@skill`, and `~/.config/zed/prompts` no longer applies. Do not plan against it.
- **Zed Skills do not apply to external ACP agents.** A user running Claude Code inside
  Zed gets Claude Code's own `CLAUDE.md` + `.claude/skills/` — which is precisely what
  Payo's existing shims provide. Both paths must keep being written.

## Approach

### 1. Provider — static-only

New `src/providers/zed.ts`, modeled on `src/providers/windsurf.ts`:

```ts
// Static-only: the `zed` binary is a GUI launcher, not a headless agent runner,
// so Zed authors nothing. It reads `.agents/skills/` and AGENTS.md natively —
// no discovery shim, unlike Claude Code and Windsurf.
export const zedProvider: AiProvider = {
  id: 'zed',
  displayName: 'Zed',
  knownArtifacts: ['.rules'],
};
```

`knownArtifacts` ended up as `.rules` only. It feeds `scanExistingAiConfigs`, whose
result the CLI prints as *"Existing AI config detected"* — and `.zed/settings.json` is
ordinary editor settings that every Zed user has, AI or not, so listing it would fire
that notice falsely.

- No `agent` field ⇒ excluded from Q1 automatically by the `p.agent` filter at
  `src/questions/options.ts:16`; offered in Q2 by `supportToolOptions`
  (`options.ts:26-29`). **Neither file needs editing.**
- `.rules` is Zed's own top-priority instruction filename and is claimed by no other
  provider, so `detectAiTool` (`src/detect/aiconfig.ts:36-53`) can identify Zed uniquely
  from it. Listing it also makes the overwrite guard flag it as a competing AI config.

Register in `src/providers/index.ts` **after `windsurfProvider`, before
`genericProvider`** — registration order drives picker order and is the `detectAiTool`
tie-break for shared paths. Add `'zed'` to the `AiTool` union at
`src/types/index.ts:5-13`.

**No change to `src/generator/shims.ts`** — Zed reads the canonical tree directly.

### 2. Native gate — a new declarative writer, not an `ASK_TOOLS` entry

The `AskTool` contract (`src/generator/hooks.ts:443-471`) is built around a shell command
that reads stdin and prints a JSON decision (`gateCommand`, `:383-394`). Zed cannot run
one. Forcing Zed into `ASK_TOOLS` would produce a config Zed ignores. So add a **sibling
writer** in `src/generator/hooks.ts`, called from `emitHooks` (`:604-611`) alongside
`emitNativeAsk`.

**Gate mapping** — reuse `MATCH_PATTERN` (`hooks.ts:320-324`) **verbatim**. Rust regex
supports the POSIX `[[:space:]]` classes those patterns already use, so no second pattern
table is introduced and the two layers cannot drift.

| Payo gate | Native semantics | Zed rendering |
| --- | --- | --- |
| `confirmPush` — ask on push | human confirm | `always_confirm` on `MATCH_PATTERN.push` |
| `dbSafety` — ask on destructive SQL | human confirm | `always_confirm` on `MATCH_PATTERN.sql` |
| `changeAudit` — conditional deny until receipt matches | deny + reason to agent | **degrades** to `always_confirm` on the same pattern |

`changeAudit` is a real capability loss and must be documented, not papered over. A
static `always_deny` would block every commit forever, because Zed cannot read the
receipt to let the post-audit retry through; and Zed's pattern objects carry no message
field, so the "run change-audit first" instruction never reaches the agent. This is the
same posture as Windsurf (`hooks.ts:14`) — the mechanical git hook stays the load-bearing
enforcement.

**Written shape** at `.zed/settings.json`:

```json
{
  "agent": {
    "tool_permissions": {
      "tools": {
        "terminal": {
          "always_confirm": [
            { "pattern": "git[[:space:]]+push" },
            { "pattern": "git[[:space:]]+commit" }
          ]
        }
      }
    }
  }
}
```

Deliberately **never** set `tool_permissions.default` or `terminal.default` — that would
silently override the user's global approval posture for every tool call, far beyond what
Payo was asked to do. Payo only appends patterns.

**Idempotency without a marker.** JSON admits no `payo:` comment, so `isPayoGate`
(`hooks.ts:400`) does not apply. Instead, on merge: drop every `always_confirm` entry
whose `pattern` is one of `Object.values(MATCH_PATTERN)`, then push the current set.
Those strings are Payo's own, and re-deriving them each run means a stale gate self-heals
when the user's gate selection changes — the same healing property `merge` gives the
other tools.

**JSONC hazard (important).** Zed's `settings.json` is JSONC and its shipped default is
full of comments; `JSON.parse` will throw on most real-world files. Policy: **write only
when the file is absent or parses as strict JSON.** On a parse failure, skip the write
and emit a setup hint containing the exact block to paste. This follows the existing
"don't corrupt an unparseable config" precedent (`hooks.ts:576-580`) and never strips a
user's comments.

**Scope hazard.** Zed documents `agent.*` only for global
`~/.config/zed/settings.json`; project-level `.zed/settings.json` support for those keys
is **undocumented**, and Zed's own docs say only settings that "impact the behavior of
the editor and language tooling" are project-settable. Payo cannot write global —
`resolveContained` (`src/generator/paths.ts:15-22`) throws on any path outside the
project, by design. So always emit an `activationHint`-style line, in the manner of
Codex's (`hooks.ts:492`), surfaced by `hookSetupHints` (`:672-705`):

> `Zed: if the confirm prompt doesn't fire, copy the agent.tool_permissions block from .zed/settings.json into ~/.config/zed/settings.json`

Gate the whole writer on `'zed'` being in the `tools` selection, matching how
`emitNativeAsk` scopes itself (`hooks.ts:560,568`).

**Security note.** Project-level Zed AI config has a known abuse class — see
[GHSA-cv6g-cmxc-vw8j](https://github.com/zed-industries/zed/security/advisories/GHSA-cv6g-cmxc-vw8j).
Payo writing only `always_confirm` patterns (never `allow`, never a `default`) keeps the
change strictly permission-narrowing, which is the safe side of that line.

### 3. Precedence warning

New small module `src/generator/zed.ts`:

- `ZED_SHADOWS_AGENTS` — the six filenames Zed prefers over `AGENTS.md`: `.rules`,
  `.cursorrules`, `.windsurfrules`, `.clinerules`,
  `.github/copilot-instructions.md`, `AGENT.md`.
- `zedShadowWarnings(tools?: string[]): string[]` — empty unless `'zed'` is in `tools`;
  otherwise one line per file that exists on disk, naming the file and stating Zed will
  read it **instead of** `AGENTS.md`. Use `fs.existsSync` + `resolveContained`, mirroring
  `findLegacyArtifacts` (`src/generator/legacy.ts:27-29`).

Surface it in `src/cli/index.ts` **after** the legacy-cleanup block (`:370-376`), not
before: three of the six (`.cursorrules`, `.windsurfrules`,
`.github/copilot-instructions.md`) are already in `LEGACY_ARTIFACTS`
(`legacy.ts:17-24`), so a user who accepts cleanup should see those resolve silently
rather than be warned about files Payo just deleted. Render with `note(...)` under a
`Zed` heading, consistent with the `Git hooks` note at `:364`.

Warn only — **do not extend `LEGACY_ARTIFACTS`.** Payo never wrote `.rules`,
`.clinerules`, or `AGENT.md`, and deleting another tool's config is out of character for
the tool.

### 4. Docs and copy

- `README.md:290-296` — the generated-paths table needs no new row (Zed adds no artifact
  to the universal layout); mention `.zed/settings.json` in the guardrails section instead.
- `README.md:300-304` — add Zed to the "reads `.agents/skills/` and `AGENTS.md`
  natively" bullet.
- `README.md:337-344` — the native-hook paragraph currently says "Claude, Cursor, and
  Copilot". Add Zed with its honest caveat: confirm-only, no reason reaches the agent,
  change-audit degrades to a confirm.
- `docs/index.html:351-355` — new `.tool` card in the grid; refresh the meta description
  (`:8`, `:24`, `:38`), keywords (`:9`), and the "which tools" FAQ (`:84`, `:592`).
- `src/cli/banner.ts:99-100` — add Zed to the tagline.
- `CONTRIBUTING.md:116-121` — while here, fix the stale pointer: it says register in
  `registry.ts`, but the actual registration site is `providers/index.ts:15-21`.

### 5. Tests

Existing tests with exhaustive editor lists that **will fail** and must be updated:

- `tests/unit/options.test.ts:48` — `supportToolOptions` ids; add `'zed'` in registration
  position. Line 35 (Q1, CLI-backed only) must stay unchanged — assert Zed is absent
  there, as line 36 already does for Windsurf.
- `tests/integration/generate.test.ts:17-28` — provider invariants; assert Zed has no
  `agent`.
- `tests/integration/overwrite-guard.test.ts:32` — the parameterized tool loop.
- `tests/unit/aiconfig.test.ts:46-59` — detection mapping for `.zed/settings.json` and
  `.rules`.
- `tests/unit/shims.test.ts:107` — should **not** change. Its
  `toEqual([SHIM_TOOLS.claude, SHIM_TOOLS.windsurf])` is exactly the assertion that Zed
  correctly needs no shim.

New coverage, following `tests/unit/hooks.test.ts:286-341`'s per-tool blocks and
`tests/helpers/tmpProject.ts`'s `inTempProject`:

- Fresh write of `.zed/settings.json` with the expected `always_confirm` patterns, per
  gate combination.
- Merge into an existing strict-JSON settings file preserves unrelated keys
  (`theme`, `vim_mode`).
- Re-run is idempotent; changing the gate selection **replaces** stale patterns rather
  than appending.
- A JSONC file containing comments is left byte-identical and produces a setup hint.
- `'zed'` absent from `supportTools` ⇒ no `.zed/` write at all.
- `zedShadowWarnings` returns a line per shadowing file, and `[]` when Zed is unselected.

## Verification

1. `bun test` — full suite green, including the updated exhaustive-list tests.
2. `bun run typecheck` plus the repo's lint/format scripts.
3. Manual e2e in a scratch dir: run `bun run src/index.ts`, pick any Q1 CLI, check
   **Zed** in Q2, enable change-audit + confirm-push. Verify on disk:
   - `AGENTS.md` and `.agents/skills/<id>/SKILL.md` written;
   - **no** `.zed/skills/` directory created;
   - `.zed/settings.json` holds the `agent.tool_permissions.tools.terminal.always_confirm`
     patterns and nothing else Payo-owned;
   - the CLI report prints the global-settings activation hint.
4. Re-run Payo in the same dir — `.zed/settings.json` unchanged (idempotency).
5. Shadow warning: `touch .cursorrules` in a scratch repo, re-run with Zed selected,
   confirm the warning names it and appears *after* the legacy-cleanup prompt.
6. JSONC guard: hand-write a `.zed/settings.json` containing `// a comment`, re-run,
   confirm the file is untouched and the paste-this-block hint is printed.
7. Real-editor check (optional but decisive): open the scratch project in Zed, trust the
   worktree, confirm the generated skills appear under `@skill` in the Agent Panel, and
   that asking the agent to run `git push` raises a confirm prompt.

## Known limitations to state in the README

- **change-audit cannot be enforced natively on Zed.** It degrades to a confirm prompt
  with no reason string; the git hook remains the real enforcement.
- **Project-scoped `agent.*` settings are undocumented in Zed.** The written
  `.zed/settings.json` may require the user to mirror the block into
  `~/.config/zed/settings.json`, which Payo will not write.
- **A commented `.zed/settings.json` is not merged into**, by design.

## Sources

- [Skills](https://zed.dev/docs/ai/skills) ·
  [Instructions](https://zed.dev/docs/ai/instructions) ·
  [Tool Permissions](https://zed.dev/docs/ai/tool-permissions)
- [MCP / context servers](https://zed.dev/docs/ai/mcp) ·
  [External agents (ACP)](https://zed.dev/docs/ai/external-agents) ·
  [Agent settings](https://zed.dev/docs/ai/agent-settings) ·
  [Tools](https://zed.dev/docs/ai/tools)
- [Tasks](https://zed.dev/docs/tasks) · [Configuring Zed](https://zed.dev/docs/configuring-zed)
- [Zed 1.4.0 release notes — Rules Library replaced by Skills](https://zed.dev/releases/preview/1.4.0)
- [GHSA-cv6g-cmxc-vw8j — project-level MCP config advisory](https://github.com/zed-industries/zed/security/advisories/GHSA-cv6g-cmxc-vw8j)
