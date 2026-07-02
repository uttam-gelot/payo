import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import {
  predictTargets,
  existingTargets,
  predictedExisting,
  backupFiles,
  resolveContained,
} from '../../src/generator/index';
import { listProviders } from '../../src/providers/index';
import { selectSkills } from '../../src/generator/skills';
import { buildBaseRules } from '../../src/generator/rules';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';

afterEach(() => resetAgentOverride());

describe('predictTargets — static mode', () => {
  beforeEach(() => setAgentOverride({ isAvailable: false }));

  for (const provider of listProviders()) {
    it(`matches the ${provider.id} provider's artifact paths`, () => {
      const answers = fullStackAnswers(provider.id);
      const expected = provider
        .generate({ answers, sections: buildBaseRules(answers) })
        .map((a) => a.path);
      expect(predictTargets(answers)).toEqual(expected);
    });
  }
});

describe('predictTargets — AI mode', () => {
  beforeEach(() => setAgentOverride({ isAvailable: true }));

  it('predicts each skill file plus the static fallback target for a multi-file tool (claude)', () => {
    const answers = fullStackAnswers('claude');
    const skillPaths = selectSkills(answers).map((s) => `.claude/skills/${s.id}/SKILL.md`);
    // CLAUDE.md is the runStatic fallback target — it must be guarded too (B2).
    expect(predictTargets(answers)).toEqual([...skillPaths, 'CLAUDE.md']);
  });

  it('includes the static fallback target so it is not silently clobbered (B2)', () => {
    // runStatic fires when every agent run fails, writing CLAUDE.md. If predictTargets
    // omitted it, a pre-existing CLAUDE.md would be overwritten with no prompt/backup.
    expect(predictTargets(fullStackAnswers('claude'))).toContain('CLAUDE.md');
  });

  it('predicts the single master file for a single-file tool (codex)', () => {
    // AI master and static fallback are both AGENTS.md — the union dedupes to one.
    expect(predictTargets(fullStackAnswers('codex'))).toEqual(['AGENTS.md']);
  });
});

describe('existingTargets — cross-tool config', () => {
  beforeEach(() => setAgentOverride({ isAvailable: false }));

  it('warns about CLAUDE.md even when a different tool (antigravity) is selected', async () => {
    // The exact reported bug: a repo with Claude config, user picks Antigravity.
    // predictTargets only knows AGENTS.md, so without the union the guard never fires.
    await inTempProject((dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), 'hand-tuned', 'utf-8');
      const answers = fullStackAnswers('antigravity');
      expect(predictTargets(answers)).not.toContain('CLAUDE.md');
      expect(existingTargets(answers)).toContain('CLAUDE.md');
    });
  });

  it('only reports config that actually exists on disk', async () => {
    await inTempProject(() => {
      // Nothing written → no existing AI config, and the static target is absent too.
      expect(existingTargets(fullStackAnswers('antigravity'))).toEqual([]);
    });
  });
});

describe('resolveContained', () => {
  it('resolves project-relative paths', async () => {
    // Compare against cwd, not the mkdtemp string — macOS reports the
    // /private-resolved real path from process.cwd() after chdir.
    await inTempProject(() => {
      expect(resolveContained('CLAUDE.md')).toBe(join(process.cwd(), 'CLAUDE.md'));
      expect(resolveContained('.claude/skills/testing/SKILL.md')).toBe(
        join(process.cwd(), '.claude/skills/testing/SKILL.md'),
      );
    });
  });

  it('rejects paths that escape the project directory', async () => {
    await inTempProject(() => {
      expect(() => resolveContained('../outside.md')).toThrow('outside the project directory');
      expect(() => resolveContained('/tmp/abs.md')).toThrow('outside the project directory');
      expect(() => resolveContained('nested/../../outside.md')).toThrow(
        'outside the project directory',
      );
    });
  });
});

describe('backupFiles', () => {
  it('renames each existing file to .bak and reports the backups', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), 'hand-tuned', 'utf-8');
      const backups = backupFiles(['CLAUDE.md', 'missing.md']);
      expect(backups).toEqual(['CLAUDE.md.bak']);
      expect(readFileSync(join(dir, 'CLAUDE.md.bak'), 'utf-8')).toBe('hand-tuned');
      // Renamed, not copied — the original slot is free for the new file.
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(false);
    });
  });

  it('replaces a stale backup from a previous run', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), 'new edits', 'utf-8');
      writeFileSync(join(dir, 'CLAUDE.md.bak'), 'old backup', 'utf-8');
      backupFiles(['CLAUDE.md']);
      expect(readFileSync(join(dir, 'CLAUDE.md.bak'), 'utf-8')).toBe('new edits');
    });
  });

  it('replaces a stale backup DIRECTORY without throwing ENOTEMPTY', async () => {
    await inTempProject((dir) => {
      // Current dir artifact + a leftover non-empty .bak dir from a prior run.
      mkdirSync(join(dir, '.claude/skills/foo'), { recursive: true });
      writeFileSync(join(dir, '.claude/skills/foo/SKILL.md'), 'current', 'utf-8');
      mkdirSync(join(dir, '.claude/skills.bak/stale'), { recursive: true });
      writeFileSync(join(dir, '.claude/skills.bak/stale/old.md'), 'stale', 'utf-8');

      const backups = backupFiles(['.claude/skills']);
      expect(backups).toEqual(['.claude/skills.bak']);
      // Renamed over the stale dir; the new backup holds the current contents.
      expect(existsSync(join(dir, '.claude/skills.bak/foo/SKILL.md'))).toBe(true);
      expect(existsSync(join(dir, '.claude/skills.bak/stale'))).toBe(false);
      expect(existsSync(join(dir, '.claude/skills'))).toBe(false);
    });
  });
});

describe('predictedExisting — only this run’s own targets', () => {
  beforeEach(() => setAgentOverride({ isAvailable: false }));

  it('excludes other tools’ configs so backup never moves them', async () => {
    await inTempProject((dir) => {
      // Repo already holds Claude config; the user picks Cursor.
      writeFileSync(join(dir, 'CLAUDE.md'), 'hand-tuned', 'utf-8');
      mkdirSync(join(dir, '.claude/skills'), { recursive: true });
      writeFileSync(join(dir, '.cursorrules'), 'old cursor', 'utf-8');
      const answers = fullStackAnswers('cursor');

      const own = predictedExisting(answers);
      expect(own).toEqual(['.cursorrules']); // only Cursor's own target
      // The warning set still surfaces the Claude config…
      expect(existingTargets(answers)).toContain('CLAUDE.md');

      // …but backing up only `own` leaves Claude's config untouched.
      backupFiles(own);
      expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(true);
      expect(existsSync(join(dir, '.claude/skills'))).toBe(true);
      expect(existsSync(join(dir, '.cursorrules.bak'))).toBe(true);
    });
  });
});
