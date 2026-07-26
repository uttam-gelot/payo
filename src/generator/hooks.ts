/**
 * Skill-enforcement hooks. Payo's generated guardrail skills are markdown the
 * agent may ignore, so this module emits executable hooks that fire regardless:
 *
 *  - a MECHANICAL git hook (gitleaks / tests) that HARD-BLOCKS on failure —
 *    tool-agnostic, covers humans too. Written for lefthook on a greenfield
 *    repo; merged into an existing runner (husky / pre-commit / native) when one
 *    is already present, so the developer's setup is respected, never clobbered.
 *  - a soft NATIVE `ask` hook per supported tool (Claude / Cursor / Copilot) that
 *    surfaces a confirm prompt at `git commit` / `git push` (change-audit,
 *    confirm-push) or a destructive query (DB-safety). It stores no state and
 *    runs no model — it just makes the prompt appear. Tools without a soft-ask
 *    hook (Codex, Antigravity, Windsurf) are covered by the mechanical floor.
 *
 * Every edit is idempotent: a `payo:` marker in each block lets a re-run detect
 * its own prior output and skip, so running Payo twice adds nothing.
 */
import fs from 'fs';
import path from 'path';
import type { Answers } from '../questions/types';
import { resolveCommands } from './commands';
import { writeArtifact, resolveContained } from './paths';
import { writeFileAtomic } from '../fsutil';
import { detectHookRunner, type HookRunner } from '../detect/hooks';

/** Marker that tags every Payo-written hook block, for idempotent re-runs. */
const MARK = 'payo:';

/** A mechanical check: a command that hard-blocks the given git stage on failure. */
interface Check {
  /** Stable hook-entry name; also the idempotency key. */
  name: string;
  /** Shell command to run. */
  run: string;
  stage: 'pre-commit' | 'pre-push';
}

/**
 * The mechanical checks implied by the answers, each pinned to the stage the
 * user chose (timing fidelity). gitleaks scans before push (its convention);
 * the verify command lands at commit or push per `verifyTiming`.
 */
function mechanicalChecks(a: Answers): Check[] {
  const checks: Check[] = [];
  if (a.gitleaks === true) {
    checks.push({ name: 'payo-secret-scan', run: 'gitleaks detect --redact', stage: 'pre-push' });
  }
  const stage =
    a.verifyTiming === 'commit' ? 'pre-commit' : a.verifyTiming === 'push' ? 'pre-push' : undefined;
  const test = resolveCommands(a).test;
  if (stage && test) checks.push({ name: 'payo-verify', run: test, stage });
  return checks;
}

// ---------------------------------------------------------------------------
// Mechanical layer — lefthook (greenfield) or merge into the existing runner
// ---------------------------------------------------------------------------

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
    '# Managed by Payo — git hooks that enforce the generated guardrail skills.\n' +
    '# Install once: `lefthook install`.\n' +
    [block('pre-commit'), block('pre-push')].filter(Boolean).join('\n')
  );
}

/**
 * Insert Payo's commands into an existing `lefthook.yml` text under each stage's
 * `commands:` map (adding the stage block when absent). Line-oriented so it does
 * not need a YAML parser; idempotent via the `payo:` marker.
 */
export function mergeLefthook(text: string, checks: Check[]): string {
  if (text.includes(MARK)) return text; // already ours — no-op
  let out = text.endsWith('\n') || text === '' ? text : text + '\n';
  const stages: Check['stage'][] = ['pre-commit', 'pre-push'];
  for (const stage of stages) {
    const items = checks.filter((c) => c.stage === stage);
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
  if (existing.includes(MARK)) return false;
  const lines = checks.map((c) => `${c.run}  # ${MARK}${c.name}`).join('\n');
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
  if (existing.includes(MARK)) return false;
  const hooks = checks
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
 * Emit the mechanical git hook. Greenfield → write `lefthook.yml`. Existing
 * runner → merge Payo's checks into it (idempotent). Returns the paths touched.
 */
function emitMechanical(a: Answers, cwd: string): string[] {
  const checks = mechanicalChecks(a);
  if (checks.length === 0) return [];

  const detected = detectHookRunner(cwd);
  const runner: HookRunner | 'greenfield' = detected?.runner ?? 'greenfield';

  switch (runner) {
    case 'greenfield': {
      writeArtifact({ path: 'lefthook.yml', content: renderLefthook(checks) });
      return ['lefthook.yml'];
    }
    case 'lefthook': {
      const rel = detected!.configPath;
      const abs = resolveContained(rel);
      const merged = mergeLefthook(fs.readFileSync(abs, 'utf8'), checks);
      if (merged === fs.readFileSync(abs, 'utf8')) return [];
      writeFileAtomic(abs, merged);
      return [rel];
    }
    case 'husky': {
      const touched: string[] = [];
      for (const stage of ['pre-commit', 'pre-push'] as const) {
        const staged = checks.filter((c) => c.stage === stage);
        if (staged.length === 0) continue;
        const rel = `.husky/${stage}`;
        if (appendShellHook(resolveContained(rel), staged)) touched.push(rel);
      }
      return touched;
    }
    case 'native': {
      const base = detected!.configPath === '.git/hooks' ? '.git/hooks' : detected!.configPath;
      const touched: string[] = [];
      for (const stage of ['pre-commit', 'pre-push'] as const) {
        const staged = checks.filter((c) => c.stage === stage);
        if (staged.length === 0) continue;
        const rel = path.join(base, stage);
        // Native hooks may sit outside cwd only via an absolute hooksPath; keep
        // writes contained to the project.
        const abs = path.isAbsolute(base) ? path.join(base, stage) : resolveContained(rel);
        if (appendShellHook(abs, staged)) touched.push(rel);
      }
      return touched;
    }
    case 'pre-commit': {
      const rel = detected!.configPath;
      return appendPreCommit(resolveContained(rel), checks) ? [rel] : [];
    }
  }
}

// ---------------------------------------------------------------------------
// Native soft-`ask` layer — Claude / Cursor / Copilot
// ---------------------------------------------------------------------------

/** A confirm gate: what to match, and the message to surface. */
interface Gate {
  match: 'commit' | 'push' | 'sql';
  message: string;
}

/** The gates implied by the answers, keyed to the git action / query they guard. */
function gates(a: Answers): Gate[] {
  const g: Gate[] = [];
  if (a.auditSkill === true) {
    const push = a.auditTiming !== 'commit';
    g.push({
      match: push ? 'push' : 'commit',
      message: `Run the change-audit skill on this change before ${push ? 'pushing' : 'committing'} and report any conflicts with the project skills.`,
    });
  }
  if (a.confirmPush === true) {
    g.push({ match: 'push', message: 'Confirm you intend to push to the remote.' });
  }
  if (a.dbSafety === true) {
    g.push({
      match: 'sql',
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
 * A POSIX-sh one-liner: read the tool's stdin (the pending command, in whatever
 * JSON shape), and if it matches a guarded action, print `jsonTemplate` with the
 * gate's message substituted (`%s`). Order: push → commit → sql, so the more
 * specific message wins. The leading marker comment makes the config idempotent.
 */
function askCommand(relevant: Gate[], jsonTemplate: string): string {
  const branches = relevant
    .map(
      (g, i) =>
        `${i === 0 ? 'if' : 'elif'} printf '%s' "$IN" | grep -qiE '${MATCH_PATTERN[g.match]}'; ` +
        `then MSG='${g.message}'`,
    )
    .join('; ');
  return (
    `# ${MARK}skill-gate\n` +
    `IN=$(cat); ${branches}; else exit 0; fi; ` +
    `printf '${jsonTemplate}' "$MSG"`
  );
}

/** Per-tool native `ask` config: where it lives and how to shape it. */
interface AskTool {
  /** Config file path, project-relative. */
  configPath: string;
  /** printf template emitting this tool's soft-`ask` decision, `%s` = message. */
  jsonTemplate: string;
  /** Wrap the sh command into this tool's config object. */
  wrap(command: string): unknown;
  /** Merge our entry into an existing parsed config; return the new config. */
  merge(existing: unknown, command: string): unknown;
}

const ASK_TOOLS: Record<string, AskTool> = {
  claude: {
    configPath: '.claude/settings.json',
    jsonTemplate:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}',
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
      const pre = Array.isArray(hooks.PreToolUse) ? [...(hooks.PreToolUse as unknown[])] : [];
      pre.push({ matcher: 'Bash', hooks: [{ type: 'command', command }] });
      hooks.PreToolUse = pre;
      cfg.hooks = hooks;
      return cfg;
    },
  },
  cursor: {
    configPath: '.cursor/hooks.json',
    jsonTemplate: '{"permission":"ask","user_message":"%s"}',
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
        ? [...(hooks.beforeShellExecution as unknown[])]
        : [];
      arr.push({ command, failClosed: true });
      hooks.beforeShellExecution = arr;
      cfg.hooks = hooks;
      return cfg;
    },
  },
  copilot: {
    configPath: '.github/hooks/payo-pretool.json',
    jsonTemplate: '{"permissionDecision":"ask","permissionDecisionReason":"%s"}',
    wrap: (command) => ({ event: 'preToolUse', command }),
    // Copilot reads one hook per file, so a fresh file is always our own.
    merge: (_existing, command) => ({ event: 'preToolUse', command }),
  },
};

/**
 * Emit the soft-`ask` native hook for each supported tool that has one. Skips a
 * config that already carries our marker (idempotent). Returns paths touched.
 */
function emitNativeAsk(a: Answers, tools: string[] | undefined): string[] {
  const relevant = gates(a);
  if (relevant.length === 0) return [];
  // Undefined ⇒ older session / programmatic caller: cover every soft-ask tool.
  const selected = tools ?? Object.keys(ASK_TOOLS);
  // Deterministic order so the printed message prefers push, then commit, then sql.
  const order: Gate['match'][] = ['push', 'commit', 'sql'];
  const ordered = order
    .map((m) => relevant.find((g) => g.match === m))
    .filter((g): g is Gate => Boolean(g));

  const touched: string[] = [];
  for (const tool of selected) {
    const spec = ASK_TOOLS[tool];
    if (!spec) continue; // no soft-ask hook (codex / antigravity / windsurf)
    const command = askCommand(ordered, spec.jsonTemplate);
    const abs = resolveContained(spec.configPath);
    if (fs.existsSync(abs)) {
      const raw = fs.readFileSync(abs, 'utf8');
      if (raw.includes(`${MARK}skill-gate`)) continue; // already ours
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue; // don't corrupt an unparseable config
      }
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
 * support (falls back to the selected AI tool). Returns the project-relative
 * paths written, for the CLI report. Writes nothing when no hook-bearing flag is
 * set.
 */
export function emitHooks(a: Answers, tools?: string[], cwd: string = process.cwd()): string[] {
  return [...new Set([...emitMechanical(a, cwd), ...emitNativeAsk(a, tools)])];
}
