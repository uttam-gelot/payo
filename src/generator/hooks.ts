/**
 * Skill-enforcement hooks. Payo's generated guardrail skills are markdown the
 * agent may ignore, so this module emits executable hooks that fire regardless:
 *
 *  - a MECHANICAL git hook (gitleaks / tests) that HARD-BLOCKS on failure —
 *    tool-agnostic, covers humans too. Written for lefthook on a greenfield
 *    repo; merged into an existing runner (husky / pre-commit / native) when one
 *    is already present, so the developer's setup is respected, never clobbered.
 *  - a NATIVE pre-tool gate per supported tool (Claude / Cursor / Copilot) on
 *    `git commit` / `git push` and destructive queries. It runs no model; it
 *    either raises the tool's confirm prompt for the HUMAN (confirm-push,
 *    DB-safety) or denies once per change set to hand the AGENT an instruction
 *    it must act on (change-audit). Tools without a pre-tool hook (Codex,
 *    Antigravity, Windsurf) are covered by the mechanical floor.
 *
 * Every edit is idempotent: a `payo:` marker in each block lets a re-run detect
 * its own prior output and skip, so running Payo twice adds nothing.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { Answers } from '../questions/types';
import { writeArtifact, resolveContained } from './paths';
import { writeFileAtomic } from '../fsutil';
import { probeCommand } from './agent';
import { planHooks, type HookPlan, type PlannedCheck } from './hookplan';

/** Marker that tags every Payo-written hook block, for idempotent re-runs. */
const MARK = 'payo:';

/**
 * A mechanical check: a command that hard-blocks the given git stage on failure.
 * Which checks exist and whether the repo's own runner already covers them is
 * decided by `planHooks`; this module only writes what the plan hands it.
 */
type Check = PlannedCheck;

// ---------------------------------------------------------------------------
// Mechanical layer — lefthook (greenfield) or merge into the existing runner
// ---------------------------------------------------------------------------

/** The `lefthook install` guidance banner shared by fresh and merged configs. */
const LEFTHOOK_BANNER =
  '# Created by Payo — git hooks that enforce the generated guardrail skills.\n' +
  '#\n' +
  '# Requires the lefthook binary. Install it once with any of:\n' +
  '#   brew install lefthook            # macOS / Linux (Homebrew)\n' +
  '#   npm  install -D lefthook         # Node projects\n' +
  '#   go   install github.com/evilmartians/lefthook@latest\n' +
  '# Then wire it into this repo:\n' +
  '#   lefthook install\n' +
  '# Docs: https://github.com/evilmartians/lefthook\n';

/** Render a fresh `lefthook.yml` for the given checks. */
function renderLefthook(checks: Check[]): string {
  const byStage = (stage: Check['stage']): Check[] => checks.filter((c) => c.stage === stage);
  const block = (stage: Check['stage']): string => {
    const items = byStage(stage);
    if (items.length === 0) return '';
    const lines = items
      .map((c) => `    ${c.name}:\n      run: ${c.run}  # ${MARK}${c.name}`)
      .join('\n');
    return `${stage}:\n  commands:\n${lines}\n`;
  };
  return (
    LEFTHOOK_BANNER + '\n' + [block('pre-commit'), block('pre-push')].filter(Boolean).join('\n')
  );
}

/**
 * Insert Payo's commands into an existing `lefthook.yml` text under each stage's
 * `commands:` map (adding the stage block when absent). Line-oriented so it does
 * not need a YAML parser; idempotent via the `payo:` marker.
 */
export function mergeLefthook(text: string, checks: Check[]): string {
  // Per-check, not per-file: a config we wrote earlier must still be able to
  // receive a check the user enabled later.
  const pending = checks.filter((c) => !text.includes(`${MARK}${c.name}`));
  if (pending.length === 0) return text; // every check already ours — no-op
  let out = text.endsWith('\n') || text === '' ? text : text + '\n';
  const stages: Check['stage'][] = ['pre-commit', 'pre-push'];
  for (const stage of stages) {
    const items = pending.filter((c) => c.stage === stage);
    if (items.length === 0) continue;
    const entries = items
      .map((c) => `    ${c.name}:\n      run: ${c.run}  # ${MARK}${c.name}`)
      .join('\n');
    const lines = out.split('\n');
    const stageIdx = lines.findIndex((l) => l.replace(/\s+$/, '') === `${stage}:`);
    if (stageIdx === -1) {
      out += `${stage}:\n  commands:\n${entries}\n`;
      continue;
    }
    // Find (or create) the `commands:` line belonging to this stage.
    let cmdIdx = -1;
    for (let i = stageIdx + 1; i < lines.length; i++) {
      if (/^\S/.test(lines[i])) break; // next top-level key — stage ended
      if (/^\s+commands:\s*$/.test(lines[i])) {
        cmdIdx = i;
        break;
      }
    }
    if (cmdIdx === -1) {
      lines.splice(stageIdx + 1, 0, '  commands:', entries);
    } else {
      lines.splice(cmdIdx + 1, 0, entries);
    }
    out = lines.join('\n');
  }
  return out.endsWith('\n') ? out : out + '\n';
}

/** Append a marked command line to a shell-script hook (husky / native). */
function appendShellHook(absPath: string, checks: Check[]): boolean {
  const existing = fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf8') : '';
  const pending = checks.filter((c) => !existing.includes(`${MARK}${c.name}`));
  if (pending.length === 0) return false;
  const lines = pending.map((c) => `${c.run}  # ${MARK}${c.name}`).join('\n');
  const header = existing ? '' : '#!/usr/bin/env sh\n';
  const body = `${header}${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${lines}\n`;
  writeFileAtomic(absPath, body);
  try {
    fs.chmodSync(absPath, 0o755);
  } catch {
    /* best-effort executable bit */
  }
  return true;
}

/** Append a marked `repo: local` entry to a `.pre-commit-config.yaml`. */
function appendPreCommit(absPath: string, checks: Check[]): boolean {
  const existing = fs.readFileSync(absPath, 'utf8');
  const pending = checks.filter((c) => !existing.includes(`${MARK}${c.name}`));
  if (pending.length === 0) return false;
  const hooks = pending
    .map(
      (c) =>
        `      - id: ${c.name}  # ${MARK}${c.name}\n` +
        `        name: ${c.name}\n` +
        `        entry: ${c.run}\n` +
        `        language: system\n` +
        `        pass_filenames: false\n` +
        `        stages: [${c.stage === 'pre-commit' ? 'commit' : 'push'}]`,
    )
    .join('\n');
  const entry = `  - repo: local\n    hooks:\n${hooks}\n`;
  const body = existing.endsWith('\n') ? existing + entry : existing + '\n' + entry;
  writeFileAtomic(absPath, body);
  return true;
}

/**
 * Write the plan's checks into the repo's hook config. Greenfield → a fresh
 * `lefthook.yml`. Existing runner → append into it, never rewriting a line the
 * developer wrote. Whether anything is written at all was already decided by
 * `planHooks`, which is what respects the user's "leave my hooks alone" choice.
 * Returns the paths touched.
 */
function emitMechanical(plan: HookPlan): string[] {
  const checks = plan.write;
  if (checks.length === 0) return [];

  switch (plan.runner) {
    case 'greenfield': {
      writeArtifact({ path: 'lefthook.yml', content: renderLefthook(checks) });
      return ['lefthook.yml'];
    }
    case 'lefthook': {
      const rel = plan.configPath!;
      const abs = resolveContained(rel);
      const current = fs.readFileSync(abs, 'utf8');
      const merged = mergeLefthook(current, checks);
      if (merged === current) return [];
      writeFileAtomic(abs, merged);
      return [rel];
    }
    case 'husky': {
      const touched: string[] = [];
      for (const stage of ['pre-commit', 'pre-push'] as const) {
        const rel = `.husky/${stage}`;
        const staged = checks.filter((c) => c.stage === stage);
        if (staged.length === 0) continue;
        if (appendShellHook(resolveContained(rel), staged)) touched.push(rel);
      }
      return touched;
    }
    case 'native': {
      const base = plan.configPath!;
      const touched: string[] = [];
      for (const stage of ['pre-commit', 'pre-push'] as const) {
        const rel = path.join(base, stage);
        const staged = checks.filter((c) => c.stage === stage);
        if (staged.length === 0) continue;
        // Native hooks may sit outside cwd only via an absolute hooksPath; keep
        // writes contained to the project.
        const abs = path.isAbsolute(base) ? path.join(base, stage) : resolveContained(rel);
        if (appendShellHook(abs, staged)) touched.push(rel);
      }
      return touched;
    }
    case 'pre-commit': {
      const rel = plan.configPath!;
      const abs = resolveContained(rel);
      return appendPreCommit(abs, checks) ? [rel] : [];
    }
    case 'simple-git-hooks':
      // planHooks never routes writes here — its config maps a stage to ONE
      // command string, so adding a check means rewriting the user's own line.
      return [];
  }
}

// ---------------------------------------------------------------------------
// Native soft-`ask` layer — Claude / Cursor / Copilot
// ---------------------------------------------------------------------------

/**
 * A gate on a pending command.
 *
 * `ask` raises the tool's own permission prompt: the message goes to the HUMAN,
 * who answers yes or no. That is right for "confirm you meant this".
 *
 * `deny` blocks the call and feeds the message back to the AGENT, which is the
 * only decision that can make the agent DO something first. `ask` cannot: the
 * human approves the prompt, the command runs, and the requested work never
 * happens — which is exactly how the change-audit gate used to be skipped.
 */
interface Gate {
  match: 'commit' | 'push' | 'sql';
  decision: 'deny' | 'ask';
  message: string;
}

/** The gates implied by the answers, keyed to the git action / query they guard. */
function gates(a: Answers): Gate[] {
  const g: Gate[] = [];
  if (a.auditSkill === true) {
    const push = a.auditTiming !== 'commit';
    g.push({
      match: push ? 'push' : 'commit',
      decision: 'deny',
      message:
        `Run the change-audit skill on this change first, then repeat this ${push ? 'push' : 'commit'}. ` +
        'It compares the diff against the project skills and reports conflicts — it does not run ' +
        'tests, linters or formatters.',
    });
  }
  if (a.confirmPush === true) {
    g.push({
      match: 'push',
      decision: 'ask',
      message: 'Confirm you intend to push to the remote.',
    });
  }
  if (a.dbSafety === true) {
    g.push({
      match: 'sql',
      decision: 'ask',
      message:
        'Review this command before running it — it looks like destructive SQL or a migration.',
    });
  }
  return g;
}

const MATCH_PATTERN: Record<Gate['match'], string> = {
  push: 'git[[:space:]]+push',
  commit: 'git[[:space:]]+commit',
  sql: '(DROP|TRUNCATE|DELETE[[:space:]]+FROM)[[:space:]]|migrate[[:space:]]+(reset|deploy)|db[[:space:]]+push',
};

/**
 * How the deny gate identifies "this change" — the key it stamps so the same
 * change set is denied once, not forever. HEAD for a push (the commits being
 * sent), the staged tree's hash for a commit.
 */
const CHANGE_KEY: Record<'push' | 'commit', string> = {
  push: 'git rev-parse HEAD 2>/dev/null',
  commit: 'git diff --staged 2>/dev/null | git hash-object --stdin 2>/dev/null',
};

/** Safe single-quoted sh literal (handles an apostrophe inside a message). */
function shSingleQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * The deny branch: block the command once per change set, handing the agent the
 * reason. The stamp lives in the git dir, so it is never committed and is
 * naturally per-worktree; a second attempt on the SAME change set falls through
 * and proceeds. When the key cannot be read (no commits yet, not a repo) the
 * gate steps aside rather than blocking a command it cannot track.
 */
function denyBranch(gate: Gate, template: string): string {
  const key = CHANGE_KEY[gate.match === 'commit' ? 'commit' : 'push'];
  return [
    `if printf '%s' "$IN" | grep -qiE '${MATCH_PATTERN[gate.match]}'; then`,
    `  K=$(${key}); S="$(git rev-parse --git-dir 2>/dev/null)/payo-audit-gate"`,
    `  if [ -n "$K" ] && [ "$(cat "$S" 2>/dev/null)" != "$K" ]; then`,
    `    printf '%s' "$K" >"$S" 2>/dev/null`,
    `    MSG=${shSingleQuote(gate.message)}; printf '${template}' "$MSG"; exit 0`,
    '  fi',
    'fi',
  ].join('\n');
}

/** The ask chain: first matching gate raises the tool's permission prompt. */
function askBranches(asks: Gate[], template: string): string {
  const branches = asks
    .map(
      (g, i) =>
        `${i === 0 ? 'if' : 'elif'} printf '%s' "$IN" | grep -qiE '${MATCH_PATTERN[g.match]}'; ` +
        `then MSG=${shSingleQuote(g.message)}`,
    )
    .join('; ');
  return `${branches}; else exit 0; fi\nprintf '${template}' "$MSG"`;
}

/**
 * The POSIX-sh gate: read the tool's stdin (the pending command, in whatever
 * JSON shape) and decide. The deny gate runs first and returns immediately; on
 * the retry it falls through to the ask chain, so a repo with both change-audit
 * and confirm-push still gets its confirm prompt. Order among asks is push →
 * commit → sql, so the more specific message wins. The leading marker comment is
 * what a re-run recognises as ours.
 */
function gateCommand(relevant: Gate[], spec: AskTool): string {
  const deny = relevant.find((g) => g.decision === 'deny');
  const asks = relevant.filter((g) => g.decision === 'ask');
  return [
    `# ${GATE_MARK}`,
    'IN=$(cat)',
    ...(deny ? [denyBranch(deny, spec.denyTemplate)] : []),
    ...(asks.length > 0 ? [askBranches(asks, spec.askTemplate)] : []),
    'exit 0',
  ].join('\n');
}

/** The marker that identifies a Payo-written gate entry inside a tool config. */
const GATE_MARK = `${MARK}skill-gate`;

/** True when a parsed config entry is a gate Payo wrote on an earlier run. */
function isPayoGate(entry: unknown): boolean {
  return JSON.stringify(entry ?? null).includes(GATE_MARK);
}

/** Per-tool native `ask` config: where it lives and how to shape it. */
interface AskTool {
  /** Config file path, project-relative. */
  configPath: string;
  /** printf template emitting this tool's `ask` decision, `%s` = message to the human. */
  askTemplate: string;
  /** printf template emitting this tool's `deny` decision, `%s` = message to the agent. */
  denyTemplate: string;
  /** Wrap the sh command into this tool's config object. */
  wrap(command: string): unknown;
  /**
   * Upsert our entry into an existing parsed config: drop any gate a previous
   * Payo run left behind, then add the current one. Replacing rather than
   * skipping is what lets a stale gate heal itself when the shape changes.
   */
  merge(existing: unknown, command: string): unknown;
}

const ASK_TOOLS: Record<string, AskTool> = {
  claude: {
    configPath: '.claude/settings.json',
    askTemplate:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}',
    denyTemplate:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}',
    wrap: (command) => ({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
    }),
    merge: (existing, command) => {
      const cfg = (existing && typeof existing === 'object' ? { ...existing } : {}) as Record<
        string,
        unknown
      >;
      const hooks = (cfg.hooks && typeof cfg.hooks === 'object' ? { ...cfg.hooks } : {}) as Record<
        string,
        unknown
      >;
      const pre = Array.isArray(hooks.PreToolUse)
        ? (hooks.PreToolUse as unknown[]).filter((e) => !isPayoGate(e))
        : [];
      pre.push({ matcher: 'Bash', hooks: [{ type: 'command', command }] });
      hooks.PreToolUse = pre;
      cfg.hooks = hooks;
      return cfg;
    },
  },
  cursor: {
    configPath: '.cursor/hooks.json',
    askTemplate: '{"permission":"ask","user_message":"%s"}',
    // `agent_message` is the field Cursor feeds back into the agent's loop.
    denyTemplate: '{"permission":"deny","agent_message":"%s"}',
    wrap: (command) => ({ hooks: { beforeShellExecution: [{ command, failClosed: true }] } }),
    merge: (existing, command) => {
      const cfg = (existing && typeof existing === 'object' ? { ...existing } : {}) as Record<
        string,
        unknown
      >;
      const hooks = (cfg.hooks && typeof cfg.hooks === 'object' ? { ...cfg.hooks } : {}) as Record<
        string,
        unknown
      >;
      const arr = Array.isArray(hooks.beforeShellExecution)
        ? (hooks.beforeShellExecution as unknown[]).filter((e) => !isPayoGate(e))
        : [];
      arr.push({ command, failClosed: true });
      hooks.beforeShellExecution = arr;
      cfg.hooks = hooks;
      return cfg;
    },
  },
  copilot: {
    configPath: '.github/hooks/payo-pretool.json',
    askTemplate: '{"permissionDecision":"ask","permissionDecisionReason":"%s"}',
    denyTemplate: '{"permissionDecision":"deny","permissionDecisionReason":"%s"}',
    wrap: (command) => ({ event: 'preToolUse', command }),
    // Copilot reads one hook per file, so a fresh file is always our own.
    merge: (_existing, command) => ({ event: 'preToolUse', command }),
  },
};

/**
 * Emit the soft-`ask` native hook for each supported tool that has one. A config
 * already carrying the exact current gate is left alone (idempotent); one
 * carrying an older Payo gate has it replaced in place, so a stale gate from a
 * previous Payo version heals instead of persisting forever. Returns paths touched.
 */
function emitNativeAsk(a: Answers, tools: string[] | undefined): string[] {
  const relevant = gates(a);
  if (relevant.length === 0) return [];
  // Undefined ⇒ older session / programmatic caller: cover every soft-ask tool.
  const selected = tools ?? Object.keys(ASK_TOOLS);
  // Deterministic order so the printed message prefers push, then commit, then
  // sql. Every gate is kept: a repo with both change-audit and confirm-push has
  // two gates on `git push` — the deny fires first, and its retry reaches the ask.
  const order: Gate['match'][] = ['push', 'commit', 'sql'];
  const ordered = order.flatMap((m) => relevant.filter((g) => g.match === m));

  const touched: string[] = [];
  for (const tool of selected) {
    const spec = ASK_TOOLS[tool];
    if (!spec) continue; // no soft-ask hook (codex / antigravity / windsurf)
    const command = gateCommand(ordered, spec);
    const abs = resolveContained(spec.configPath);
    if (fs.existsSync(abs)) {
      const raw = fs.readFileSync(abs, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // don't corrupt an unparseable config
      }
      // Compare the command itself, not the serialized file: re-formatting a
      // config the user indents differently would be a spurious edit.
      if (JSON.stringify(parsed).includes(JSON.stringify(command))) continue; // already current
      writeFileAtomic(abs, JSON.stringify(spec.merge(parsed, command), null, 2) + '\n');
    } else {
      writeArtifact({
        path: spec.configPath,
        content: JSON.stringify(spec.wrap(command), null, 2) + '\n',
      });
    }
    touched.push(spec.configPath);
  }
  return touched;
}

/**
 * Emit every skill-enforcement hook implied by the answers: the mechanical git
 * floor plus the per-tool soft-`ask` gates. `tools` is the set the user chose to
 * support (falls back to the selected AI tool). `plan` is the hook plan the
 * generator already computed — passing it keeps the written hooks identical to
 * what the generated guidance claims is automated; omitting it recomputes the
 * same plan. Returns the project-relative paths written, for the CLI report.
 */
export function emitHooks(
  a: Answers,
  tools?: string[],
  cwd: string = process.cwd(),
  plan: HookPlan = planHooks(a, cwd),
): string[] {
  return [...new Set([...emitMechanical(plan), ...emitNativeAsk(a, tools)])];
}

/** True when `bin` resolves on PATH. */
function onPath(bin: string): boolean {
  try {
    return spawnSync(probeCommand(), [bin]).status === 0;
  } catch {
    return false;
  }
}

/**
 * One-time setup commands the user must run for the freshly written hooks to
 * take effect — surfaced by the CLI after generation. A fresh `lefthook.yml`
 * needs `lefthook install` to wire `.git/hooks` (and lefthook itself if it is
 * not on PATH); a merged runner is already active. gitleaks is flagged only when
 * a hook that uses it was written and the binary is missing. Empty when there is
 * nothing to do.
 */
export function hookSetupHints(files: string[], a: Answers): string[] {
  const hints: string[] = [];
  if (files.includes('lefthook.yml')) {
    if (!onPath('lefthook')) {
      hints.push('Install lefthook:  brew install lefthook   (or: npm i -D lefthook)');
    }
    hints.push('Enable the git hooks:  lefthook install');
  }
  if (a.gitleaks === true && files.length > 0 && !onPath('gitleaks')) {
    hints.push('Install gitleaks (the secret-scan hook needs it):  brew install gitleaks');
  }
  return hints;
}
