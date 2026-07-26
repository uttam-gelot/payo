/**
 * Existing git-hook-runner detection.
 *
 * Before Payo writes any git hook it reads what the repo already uses, so it can
 * merge its checks into the developer's existing setup instead of clobbering it
 * or forcing a second runner. lefthook is Payo's default only when no runner is
 * already present (a greenfield repo).
 */
import fs from 'fs';
import path from 'path';

export type HookRunner = 'lefthook' | 'husky' | 'pre-commit' | 'native';

export interface DetectedHookRunner {
  runner: HookRunner;
  /** Project-relative config path (the file/dir that identifies the runner). */
  configPath: string;
}

/** Whether `package.json` declares a `prepare` script that runs husky. */
function huskyInPackageJson(cwd: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const prepare = pkg.scripts?.prepare ?? '';
    return (
      /husky/.test(prepare) ||
      Boolean(pkg.devDependencies?.husky) ||
      Boolean(pkg.dependencies?.husky)
    );
  } catch {
    return false;
  }
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
 * Detection order matches the design doc: lefthook → husky → pre-commit →
 * native `.git/hooks`. A hooksPath pointing at a managed runner's dir (e.g.
 * husky's `.husky`) is attributed to that runner, not counted as native.
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

  const hooksPath = coreHooksPath(cwd);
  if (hooksPath) return { runner: 'native', configPath: hooksPath };
  if (hasNativeHooks(cwd)) return { runner: 'native', configPath: '.git/hooks' };

  return null;
}
