import { describe, it, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import { classifyBranches, classifyCommits, detectGit } from '../../src/detect/git';
import { inTempProject } from '../helpers/tmpProject';

/** Run a git command in `cwd`, failing the test loudly if it errors. */
function git(cwd: string, args: string[]): void {
  const res = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
}

describe('classifyBranches', () => {
  it('detects type-prefixed branches', () => {
    expect(classifyBranches(['feature/login', 'fix/crash', 'chore/deps'])).toBe('type-slash');
  });

  it('detects ticket-keyed branches', () => {
    expect(classifyBranches(['ABC-1-login', 'ABC-22-signup', 'JIRA-3-fix'])).toBe('ticket');
  });

  it('detects plain kebab-case branches', () => {
    expect(classifyBranches(['add-login', 'fix-the-crash', 'update-deps'])).toBe('kebab');
  });

  it('returns undefined with no branches or no clear pattern', () => {
    expect(classifyBranches([])).toBeUndefined();
    expect(classifyBranches(['weird_thing', 'CamelCase'])).toBeUndefined();
  });
});

describe('classifyCommits', () => {
  it('detects Conventional Commits', () => {
    expect(
      classifyCommits(['feat: add login', 'fix(auth): token expiry', 'chore: bump deps']),
    ).toBe('conventional');
  });

  it('detects gitmoji', () => {
    expect(classifyCommits([':sparkles: add login', ':bug: fix crash', '✨ new thing'])).toBe(
      'gitmoji',
    );
  });

  it('detects ticket-prefixed commits', () => {
    expect(classifyCommits(['ABC-1: add login', 'ABC-2: fix crash'])).toBe('ticket');
  });

  it('falls back to freeform when commits exist but follow no convention', () => {
    expect(classifyCommits(['added login', 'fixed the crash'])).toBe('freeform');
  });

  it('returns undefined with no commits', () => {
    expect(classifyCommits([])).toBeUndefined();
  });
});

describe('detectGit', () => {
  it('returns empty for a non-repo directory', async () =>
    inTempProject((dir) => {
      expect(detectGit(dir).answers).toEqual({});
    }));

  it('infers conventions from a real repo', async () =>
    inTempProject((dir) => {
      git(dir, ['init', '-q']);
      git(dir, ['config', 'user.email', 'test@example.com']);
      git(dir, ['config', 'user.name', 'Test']);
      git(dir, ['commit', '-q', '--allow-empty', '-m', 'feat: initial']);
      git(dir, ['commit', '-q', '--allow-empty', '-m', 'fix: a bug']);
      git(dir, ['checkout', '-q', '-b', 'feature/new-thing']);

      const result = detectGit(dir);
      expect(result.answers.commitConvention).toBe('conventional');
      expect(result.answers.branchNaming).toBe('type-slash');
      expect(result.sources.commitConvention).toBe('git');
    }));
});
