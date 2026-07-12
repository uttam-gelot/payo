/**
 * Legacy cleanup: the universal layout supersedes the old per-tool files, so a
 * regen can offer to remove them. These must find and delete legacy artifacts
 * while never touching the current universal targets.
 */
import { describe, it, expect } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  LEGACY_ARTIFACTS,
  findLegacyArtifacts,
  removeLegacyArtifacts,
} from '../../src/generator/legacy';
import { inTempProject } from '../helpers/tmpProject';

describe('legacy artifacts', () => {
  it('does not list any current universal target', () => {
    for (const current of ['AGENTS.md', 'CLAUDE.md', '.agents/skills', '.claude/skills']) {
      expect(LEGACY_ARTIFACTS).not.toContain(current);
    }
  });

  it('finds legacy files and dirs that exist, in declared order', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, '.cursorrules'), 'x', 'utf-8');
      writeFileSync(join(dir, 'AI_RULES.md'), 'x', 'utf-8');
      mkdirSync(join(dir, '.cursor/rules'), { recursive: true });
      // A current target must not be reported as legacy.
      writeFileSync(join(dir, 'AGENTS.md'), 'x', 'utf-8');

      const found = findLegacyArtifacts();
      expect(found).toEqual(['.cursorrules', '.cursor/rules', 'AI_RULES.md']);
      expect(found).not.toContain('AGENTS.md');
    });
  });

  it('removes both files and directories, reporting what it deleted', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, '.windsurfrules'), 'x', 'utf-8');
      mkdirSync(join(dir, '.github/instructions'), { recursive: true });
      writeFileSync(join(dir, '.github/instructions/foo.instructions.md'), 'x', 'utf-8');

      const removed = removeLegacyArtifacts([
        '.windsurfrules',
        '.github/instructions',
        'missing.md',
      ]);
      expect(removed).toEqual(['.windsurfrules', '.github/instructions']);
      expect(existsSync(join(dir, '.windsurfrules'))).toBe(false);
      expect(existsSync(join(dir, '.github/instructions'))).toBe(false);
    });
  });

  it('is a no-op in a project with no legacy config', async () => {
    await inTempProject(() => {
      expect(findLegacyArtifacts()).toEqual([]);
      expect(removeLegacyArtifacts(findLegacyArtifacts())).toEqual([]);
    });
  });
});
