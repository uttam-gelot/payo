import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { predictTargets, backupFiles } from '../../src/generator/index';
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

  it('predicts one native file per skill for a multi-file tool (claude)', () => {
    const answers = fullStackAnswers('claude');
    const expected = selectSkills(answers).map((s) => `.claude/skills/${s.id}/SKILL.md`);
    expect(predictTargets(answers)).toEqual(expected);
  });

  it('predicts the single master file for a single-file tool (codex)', () => {
    expect(predictTargets(fullStackAnswers('codex'))).toEqual(['AGENTS.md']);
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
