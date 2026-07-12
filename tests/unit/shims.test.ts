/**
 * Discovery shims: symlink by default, recursive copy where symlinks are barred.
 * Both must land the same SKILL.md under `.claude/skills` and `.windsurf/skills`.
 */
import { describe, test, expect, spyOn } from 'bun:test';
import fs from 'fs';
import { readFileSync, mkdirSync, writeFileSync, lstatSync, realpathSync, existsSync } from 'fs';
import { join } from 'path';
import { createSkillShims, shimRootsForTools, SHIM_TOOLS } from '../../src/generator/shims';
import { SKILLS_ROOT } from '../../src/generator/universal';
import { inTempProject } from '../helpers/tmpProject';

/** All shim roots, when no tool scoping is applied. */
const SHIM_ROOTS = shimRootsForTools();

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

  test('scopes shims to the selected tools', async () => {
    await inTempProject((dir) => {
      seedSkill(dir, 'testing', 'X');
      const results = createSkillShims(['testing'], ['claude']);
      expect(results.map((r) => r.path)).toEqual([`${SHIM_TOOLS.claude}/testing`]);
      expect(existsSync(join(dir, SHIM_TOOLS.claude, 'testing'))).toBe(true);
      expect(existsSync(join(dir, SHIM_TOOLS.windsurf, 'testing'))).toBe(false);
    });
  });

  test('native-only or empty selections create no shims', async () => {
    await inTempProject((dir) => {
      seedSkill(dir, 'testing', 'X');
      // Codex reads .agents/skills natively → no shim tool matches.
      expect(createSkillShims(['testing'], ['codex'])).toHaveLength(0);
      expect(createSkillShims(['testing'], [])).toHaveLength(0);
      expect(existsSync(join(dir, SHIM_TOOLS.claude, 'testing'))).toBe(false);
    });
  });
});

describe('shimRootsForTools', () => {
  test('undefined ⇒ all roots; explicit list ⇒ only matching shim tools', () => {
    expect(shimRootsForTools()).toEqual([SHIM_TOOLS.claude, SHIM_TOOLS.windsurf]);
    expect(shimRootsForTools(['claude'])).toEqual([SHIM_TOOLS.claude]);
    expect(shimRootsForTools(['windsurf'])).toEqual([SHIM_TOOLS.windsurf]);
    expect(shimRootsForTools(['codex', 'cursor'])).toEqual([]); // native tools need no shim
  });
});
