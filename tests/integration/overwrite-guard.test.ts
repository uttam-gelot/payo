import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { predictTargets, backupFiles, resolveContained } from '../../src/generator/index';
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
});
