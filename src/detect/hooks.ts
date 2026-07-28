/**
 * Existing git-hook-runner detection.
 *
 * Before Payo writes any git hook it reads what the repo already uses, so it can
 * merge its checks into the developer's existing setup instead of clobbering it
 * or forcing a second runner. lefthook is Payo's default only when no runner is
 * already present (a greenfield repo).
 *
 * Detection answers two questions: WHICH runner drives the repo's hooks, and
 * WHAT each stage of that runner already does. The second is what lets Payo skip
 * a capability the repo already covers — and lets the generated guidance tell the
 * agent "the hook runs the tests" instead of asking it to run them itself.
 */
import fs from 'fs';
import path from 'path';

export type HookRunner = 'lefthook' | 'husky' | 'pre-commit' | 'simple-git-hooks' | 'native';

/** The git stages Payo reasons about. */
export type HookStage = 'pre-commit' | 'pre-push';

export const HOOK_STAGES: HookStage[] = ['pre-commit', 'pre-push'];

/**
 * A class of check, independent of the tool implementing it. `gitleaks` and
 * `trufflehog` are both `secret-scan`; `vitest` and `pytest` are both `verify`.
 */
export type HookCapability = 'secret-scan' | 'verify' | 'lint' | 'format';

/**
 * What each stage already runs. Arrays rather than Sets: this travels through
 * `Answers` into the JSON-serialized `.payo/` session.
 */
export type HookCoverage = Record<HookStage, HookCapability[]>;

export interface DetectedHookRunner {
  runner: HookRunner;
  /** Project-relative config path (the file/dir that identifies the runner). */
  configPath: string;
}

export interface DetectedHooks extends DetectedHookRunner {
  /** The capabilities each stage of this runner already covers. */
  coverage: HookCoverage;
}

/**
 * How a capability is recognised in hook-config text, whatever tool provides it.
 * Deliberately specific: an earlier bare `\btest\b` matched any config merely
 * containing the word, which suppressed the verify check on repos that ran no
 * tests at all.
 */
const CAPABILITY_PATTERN: Record<HookCapability, RegExp> = {
  'secret-scan': /\b(gitleaks|trufflehog|detect-secrets|git-secrets|ggshield|talisman)\b/i,
  verify:
    /\b(vitest|jest|mocha|pytest|ava|tap|phpunit|rspec|minitest|go\s+test|cargo\s+test|dotnet\s+test|mvn\s+test|gradle\s+\S*test)\b|\b(npm|yarn|pnpm|bun|deno)\s+(run\s+)?test\b|\bmake\s+test\b/i,
  lint: /\b(eslint|biome\s+(check|lint)|ruff|clippy|golangci-lint|rubocop|phpstan|psalm|flake8|pylint|lint-staged|lint)\b/i,
  format:
    /\b(prettier|biome\s+format|black|gofmt|goimports|rustfmt|cargo\s+fmt|dprint|ktlint|clang-format|format)\b/i,
};

export const HOOK_CAPABILITIES = Object.keys(CAPABILITY_PATTERN) as HookCapability[];

/** The capabilities `text` demonstrably runs. */
export function capabilitiesIn(text: string): HookCapability[] {
  if (!text.trim()) return [];
  return HOOK_CAPABILITIES.filter((cap) => CAPABILITY_PATTERN[cap].test(text));
}

const readIfFile = (abs: string): string => {
  try {
    return fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8') : '';
  } catch {
    return '';
  }
};

/** Concatenated contents of every regular file directly under `abs`. */
const readDir = (abs: string): string => {
  try {
    return fs
      .readdirSync(abs)
      .map((f) => readIfFile(path.join(abs, f)))
      .join('\n');
  } catch {
    return '';
  }
};

/** Parsed `package.json`, or an empty object when absent/malformed. */
function packageJson(cwd: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/** True when `name` appears in either dependency map. */
function hasDep(pkg: Record<string, unknown>, name: string): boolean {
  const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
  const dev = (pkg.devDependencies ?? {}) as Record<string, unknown>;
  return Boolean(deps[name] ?? dev[name]);
}

/** Whether `package.json` declares a `prepare` script that runs husky. */
function huskyInPackageJson(cwd: string): boolean {
  const pkg = packageJson(cwd);
  const scripts = (pkg.scripts ?? {}) as Record<string, unknown>;
  const prepare = typeof scripts.prepare === 'string' ? scripts.prepare : '';
  return /husky/.test(prepare) || hasDep(pkg, 'husky');
}

/** Git's configured hooks dir (`core.hooksPath`), or undefined when unset. */
function coreHooksPath(cwd: string): string | undefined {
  try {
    const cfg = fs.readFileSync(path.join(cwd, '.git', 'config'), 'utf8');
    const m = cfg.match(/^\s*hooksPath\s*=\s*(.+)\s*$/m);
    return m ? m[1].trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Any non-sample regular file under `.git/hooks/` signals hand-rolled hooks. */
function hasNativeHooks(cwd: string): boolean {
  const dir = path.join(cwd, '.git', 'hooks');
  try {
    return fs
      .readdirSync(dir)
      .some((f) => !f.endsWith('.sample') && fs.statSync(path.join(dir, f)).isFile());
  } catch {
    return false;
  }
}

const firstExisting = (cwd: string, rels: string[]): string | undefined =>
  rels.find((rel) => fs.existsSync(path.join(cwd, rel)));

/**
 * The git-hook runner this repo already uses, or null when none is present.
 * Detection order: lefthook → husky → pre-commit → simple-git-hooks → native
 * `.git/hooks`. A hooksPath pointing at a managed runner's dir (e.g. husky's
 * `.husky`) is attributed to that runner, not counted as native.
 */
export function detectHookRunner(cwd: string = process.cwd()): DetectedHookRunner | null {
  const lefthookCfg = firstExisting(cwd, [
    'lefthook.yml',
    'lefthook.yaml',
    '.config/lefthook.yml',
    '.config/lefthook.yaml',
  ]);
  if (lefthookCfg) return { runner: 'lefthook', configPath: lefthookCfg };

  if (fs.existsSync(path.join(cwd, '.husky')) || huskyInPackageJson(cwd)) {
    return { runner: 'husky', configPath: '.husky' };
  }

  const preCommitCfg = firstExisting(cwd, ['.pre-commit-config.yaml', '.pre-commit-config.yml']);
  if (preCommitCfg) return { runner: 'pre-commit', configPath: preCommitCfg };

  const pkg = packageJson(cwd);
  // lefthook installed from npm but configured inside package.json — no config
  // file to find, yet the repo is unmistakably a lefthook repo.
  if (pkg.lefthook !== undefined || hasDep(pkg, 'lefthook')) {
    return { runner: 'lefthook', configPath: 'package.json' };
  }
  const sghCfg = firstExisting(cwd, ['.simple-git-hooks.json', 'simple-git-hooks.json']);
  if (sghCfg) return { runner: 'simple-git-hooks', configPath: sghCfg };
  if (pkg['simple-git-hooks'] !== undefined || hasDep(pkg, 'simple-git-hooks')) {
    return { runner: 'simple-git-hooks', configPath: 'package.json' };
  }

  const hooksPath = coreHooksPath(cwd);
  if (hooksPath) return { runner: 'native', configPath: hooksPath };
  // A committed `.githooks/` is the usual convention for a repo whose hooksPath
  // is wired up by a setup script rather than checked in.
  if (fs.existsSync(path.join(cwd, '.githooks')))
    return { runner: 'native', configPath: '.githooks' };
  if (hasNativeHooks(cwd)) return { runner: 'native', configPath: '.git/hooks' };

  return null;
}

/** The top-level YAML block for `stage`, or '' when the stage is absent. */
function yamlStageBlock(text: string, stage: HookStage): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.replace(/\s+$/, '') === `${stage}:`);
  if (start === -1) return '';
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\S/.test(lines[i])) break; // next top-level key — stage ended
    out.push(lines[i]);
  }
  return out.join('\n');
}

/**
 * Split a `.pre-commit-config.yaml` into per-stage text. An entry is attributed
 * to pre-push only when it carries an explicit push stage; the framework's
 * default is the commit stage.
 */
function preCommitStages(text: string): Record<HookStage, string> {
  const out: Record<HookStage, string> = { 'pre-commit': '', 'pre-push': '' };
  // Each `- id:` line opens a hook entry; it runs until the next one at any indent.
  const entries = text.split(/^(?=\s*-\s+id:)/m);
  for (const entry of entries) {
    const stage = /stages:.*\b(push|pre-push)\b/.test(entry) ? 'pre-push' : 'pre-commit';
    out[stage] += entry + '\n';
  }
  return out;
}

/** The `simple-git-hooks` map, from its own file or the package.json key. */
function simpleGitHooksMap(cwd: string, configPath: string): Record<string, unknown> {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cwd, configPath), 'utf8')) as Record<
      string,
      unknown
    >;
    const map = configPath === 'package.json' ? raw['simple-git-hooks'] : raw;
    return map && typeof map === 'object' ? (map as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The hook text this runner runs at each stage. */
function stageText(cwd: string, detected: DetectedHookRunner): Record<HookStage, string> {
  const { runner, configPath } = detected;
  const abs = (rel: string): string => (path.isAbsolute(rel) ? rel : path.join(cwd, rel));

  switch (runner) {
    case 'lefthook': {
      const text = readIfFile(abs(configPath));
      // `scripts:` entries live in .lefthook/<stage>/ — read them as stage text.
      return {
        'pre-commit':
          yamlStageBlock(text, 'pre-commit') +
          '\n' +
          readDir(path.join(cwd, '.lefthook/pre-commit')),
        'pre-push':
          yamlStageBlock(text, 'pre-push') + '\n' + readDir(path.join(cwd, '.lefthook/pre-push')),
      };
    }
    case 'husky':
    case 'native': {
      const dir = abs(configPath);
      return {
        'pre-commit': readIfFile(path.join(dir, 'pre-commit')),
        'pre-push': readIfFile(path.join(dir, 'pre-push')),
      };
    }
    case 'pre-commit':
      return preCommitStages(readIfFile(abs(configPath)));
    case 'simple-git-hooks': {
      const map = simpleGitHooksMap(cwd, configPath);
      const at = (k: string): string => (typeof map[k] === 'string' ? map[k] : '');
      return { 'pre-commit': at('pre-commit'), 'pre-push': at('pre-push') };
    }
  }
}

/** An empty coverage map (nothing runs at either stage). */
export const emptyCoverage = (): HookCoverage => ({ 'pre-commit': [], 'pre-push': [] });

/**
 * The runner this repo uses plus what each of its stages already covers, or null
 * when the repo has no hook runner. This is what `planHooks` partitions against:
 * a capability listed here is already handled and must be neither re-written into
 * the config nor re-stated as a manual instruction to the agent.
 */
export function detectHooks(cwd: string = process.cwd()): DetectedHooks | null {
  const detected = detectHookRunner(cwd);
  if (!detected) return null;
  const text = stageText(cwd, detected);
  const coverage = emptyCoverage();
  for (const stage of HOOK_STAGES) coverage[stage] = capabilitiesIn(text[stage]);
  return { ...detected, coverage };
}

/** True when `coverage` runs `cap` at any stage. */
export function coversCapability(coverage: HookCoverage, cap: HookCapability): boolean {
  return HOOK_STAGES.some((s) => coverage[s].includes(cap));
}
