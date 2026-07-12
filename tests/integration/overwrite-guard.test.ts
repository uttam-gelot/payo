import { describe, it, expect, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resetAgentOverride } from '../helpers/agentMock';
import {
  predictTargets,
  existingTargets,
  predictedExisting,
  backupFiles,
  resolveContained,
} from '../../src/generator/index';
import { selectSkills } from '../../src/generator/skills';
import { skillPath } from '../../src/generator/universal';
import { SHIM_ROOTS } from '../../src/generator/shims';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';

afterEach(() => resetAgentOverride());

/** The full universal target set for a given answer set, in write order. */
function universalTargets(aiTool: string): string[] {
  const specs = selectSkills(fullStackAnswers(aiTool));
  const skillFiles = specs.map((s) => skillPath(s.id));
  const shimPaths = SHIM_ROOTS.flatMap((root) => specs.map((s) => `${root}/${s.id}`));
  return ['AGENTS.md', 'CLAUDE.md', ...skillFiles, ...shimPaths];
}

describe('predictTargets — universal layout', () => {
  it('predicts the same universal targets regardless of the selected CLI', () => {
    // Layout no longer depends on the provider; only content does.
    for (const tool of ['claude', 'codex', 'antigravity', 'cursor', 'copilot', 'windsurf']) {
      expect(predictTargets(fullStackAnswers(tool))).toEqual(universalTargets(tool));
    }
  });

  it('always includes the entrypoint and the Claude shim', () => {
    const targets = predictTargets(fullStackAnswers('claude'));
    expect(targets).toContain('AGENTS.md');
    expect(targets).toContain('CLAUDE.md');
  });

  it('predicts each skill file under .agents/skills and its discovery shims', () => {
    const answers = fullStackAnswers('claude');
    const targets = predictTargets(answers);
    for (const s of selectSkills(answers)) {
      expect(targets).toContain(skillPath(s.id));
      expect(targets).toContain(`.claude/skills/${s.id}`);
      expect(targets).toContain(`.windsurf/skills/${s.id}`);
    }
  });
});

describe('existingTargets — cross-tool config', () => {
  it('warns about a legacy config (.cursorrules) that the universal run does not own', async () => {
    // Universal output never writes .cursorrules, but a repo may still hold one;
    // the cross-tool scan must surface it so it is not silently left behind.
    await inTempProject((dir) => {
      writeFileSync(join(dir, '.cursorrules'), 'hand-tuned', 'utf-8');
      const answers = fullStackAnswers('claude');
      expect(predictTargets(answers)).not.toContain('.cursorrules');
      expect(existingTargets(answers)).toContain('.cursorrules');
    });
  });

  it('only reports config that actually exists on disk', async () => {
    await inTempProject(() => {
      // Nothing written → no existing AI config, and no universal target exists yet.
      expect(existingTargets(fullStackAnswers('claude'))).toEqual([]);
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
  it('excludes legacy configs the universal run does not write, so backup never moves them', async () => {
    await inTempProject((dir) => {
      // A universal target that already exists, plus a legacy config the run never writes.
      writeFileSync(join(dir, 'AGENTS.md'), 'prior', 'utf-8');
      writeFileSync(join(dir, '.cursorrules'), 'old cursor', 'utf-8');
      const answers = fullStackAnswers('claude');

      const own = predictedExisting(answers);
      expect(own).toContain('AGENTS.md'); // its own target, safe to back up
      expect(own).not.toContain('.cursorrules'); // legacy config excluded
      // The warning set still surfaces the legacy config…
      expect(existingTargets(answers)).toContain('.cursorrules');

      // …but backing up only `own` leaves the legacy config untouched.
      backupFiles(own);
      expect(existsSync(join(dir, '.cursorrules'))).toBe(true);
      expect(existsSync(join(dir, 'AGENTS.md.bak'))).toBe(true);
    });
  });
});
