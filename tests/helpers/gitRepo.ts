/**
 * Black-box test helper: drive real `git` in a throwaway repo.
 *
 * Every invocation carries its own identity, branch name and signing setting, so
 * a test never depends on the machine's git config. A developer's global
 * `user.email` made these pass locally while CI — which has none — failed with
 * "empty ident name", and a developer with commit signing on would have failed
 * where CI passed. Neither is a property of the code under test.
 */
import { execFileSync } from 'child_process';

/** git config forced onto every command here, overriding global and system. */
const FORCED = [
  '-c',
  'user.name=Payo Test',
  '-c',
  'user.email=test@payo.invalid',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'init.defaultBranch=main',
];

/** Run one git command in `cwd`, with a fixed identity. Throws on failure. */
export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...FORCED, ...args], {
    cwd,
    // Belt and braces: env identity covers anything reading it directly.
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Payo Test',
      GIT_AUTHOR_EMAIL: 'test@payo.invalid',
      GIT_COMMITTER_NAME: 'Payo Test',
      GIT_COMMITTER_EMAIL: 'test@payo.invalid',
    },
  }).toString();
}

/** A fresh repo in `cwd` with one empty commit, so HEAD resolves. */
export function initGitRepo(cwd: string): void {
  git(cwd, 'init', '-q', '.');
  commitEmpty(cwd, 'init');
}

/** Add an empty commit — enough to move HEAD to a new change set. */
export function commitEmpty(cwd: string, message: string): void {
  git(cwd, 'commit', '-q', '--allow-empty', '-m', message);
}
