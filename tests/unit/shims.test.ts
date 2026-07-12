/**
 * Discovery shims: symlink by default, recursive copy where symlinks are barred.
 * Both must land the same SKILL.md under `.claude/skills` and `.windsurf/skills`.
 */
import { describe, test, expect, spyOn } from 'bun:test';
import fs from 'fs';
import { readFileSync, mkdirSync, writeFileSync, lstatSync, realpathSync } from 'fs';
import { join } from 'path';
import { createSkillShims, SHIM_ROOTS } from '../../src/generator/shims';
import { SKILLS_ROOT } from '../../src/generator/universal';
import { inTempProject } from '../helpers/tmpProject';

/** Seed a canonical skill dir with a SKILL.md so shims have a real target. */
function seedSkill(dir: string, id: string, marker: string): void {
  const skillDir = join(dir, SKILLS_ROOT, id);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), marker);
}

describe('createSkillShims', () => {
  test('symlinks every shim root to the canonical skill dir', async () => {
    await inTempProject((dir) => {
      seedSkill(dir, 'testing', 'CANONICAL');
      const results = createSkillShims(['testing']);

      expect(results).toHaveLength(SHIM_ROOTS.length);
      for (const root of SHIM_ROOTS) {
        const link = join(dir, root, 'testing');
        expect(lstatSync(link).isSymbolicLink()).toBe(true);
        // Resolves to the one canonical file, and reads its content.
        expect(realpathSync(link)).toBe(realpathSync(join(dir, SKILLS_ROOT, 'testing')));
        expect(readFileSync(join(link, 'SKILL.md'), 'utf-8')).toBe('CANONICAL');
      }
    });
  });

  test('falls back to a recursive copy when symlinks are unavailable', async () => {
    await inTempProject((dir) => {
      seedSkill(dir, 'testing', 'COPIED');
      const spy = spyOn(fs, 'symlinkSync').mockImplementation(() => {
        throw new Error('EPERM: operation not permitted');
      });
      try {
        const results = createSkillShims(['testing']);
        expect(results.every((r) => r.mode === 'copy')).toBe(true);
        for (const root of SHIM_ROOTS) {
          const copy = join(dir, root, 'testing');
          expect(lstatSync(copy).isSymbolicLink()).toBe(false);
          expect(lstatSync(copy).isDirectory()).toBe(true);
          expect(readFileSync(join(copy, 'SKILL.md'), 'utf-8')).toBe('COPIED');
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  test('skips skills whose canonical dir is absent', async () => {
    await inTempProject(() => {
      expect(createSkillShims(['nonexistent'])).toHaveLength(0);
    });
  });

  test('refreshes a stale copy on re-run (self-heals drift)', async () => {
    await inTempProject((dir) => {
      seedSkill(dir, 'testing', 'FIRST');
      // Plant a stale copy shim, then re-run: it must be replaced by a symlink.
      const spy = spyOn(fs, 'symlinkSync').mockImplementation(() => {
        throw new Error('EPERM');
      });
      createSkillShims(['testing']);
      spy.mockRestore();

      createSkillShims(['testing']);
      const link = join(dir, '.claude/skills', 'testing');
      expect(lstatSync(link).isSymbolicLink()).toBe(true);
      expect(readFileSync(join(link, 'SKILL.md'), 'utf-8')).toBe('FIRST');
    });
  });
});
