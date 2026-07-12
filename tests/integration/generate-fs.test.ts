import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, lstatSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { generate } from '../../src/generator/index';
import { listProviders } from '../../src/providers/index';
import { selectSkills } from '../../src/generator/skills';
import { skillPath } from '../../src/generator/universal';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';

describe('generate() — static output on disk', () => {
  // Force the static path: no agent is "available".
  beforeEach(() => setAgentOverride({ isAvailable: false }));
  afterEach(() => resetAgentOverride());

  for (const provider of listProviders()) {
    it(`writes the universal layout for ${provider.id}`, async () => {
      await inTempProject(async (dir) => {
        const answers = fullStackAnswers(provider.id);
        const res = await generate(answers);
        expect(res.mode).toBe('static');

        // Every provider now yields the same universal layout; only content differs.
        expect(res.files).toContain('AGENTS.md');
        expect(res.files).toContain('CLAUDE.md');

        // The full deterministic rules live in the entrypoint.
        const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
        expect(agents).toContain('## Authentication');
        expect(agents).toContain('prisma');

        // CLAUDE.md is the import shim, not a content copy.
        expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf-8')).toContain('@AGENTS.md');

        // Each applicable skill has a spec file plus its discovery shims.
        for (const s of selectSkills(answers)) {
          expect(existsSync(join(dir, skillPath(s.id)))).toBe(true);
          expect(lstatSync(join(dir, '.claude/skills', s.id)).isSymbolicLink()).toBe(true);
          expect(lstatSync(join(dir, '.windsurf/skills', s.id)).isSymbolicLink()).toBe(true);
        }
      });
    });
  }

  it('is idempotent across re-runs', async () => {
    await inTempProject(async (dir) => {
      await generate(fullStackAnswers('claude'));
      const first = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      await generate(fullStackAnswers('claude'));
      const second = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(second).toBe(first);
    });
  });

  // generate() itself overwrites by design; the CLI's overwrite guard
  // (predictTargets + confirmOverwrite in src/cli/index.ts) prompts before
  // generate() is ever called, so this layer stays unconditional.
  it('overwrites a pre-existing artifact when invoked directly', async () => {
    await inTempProject(async (dir) => {
      writeFileSync(join(dir, 'AGENTS.md'), 'OLD CONTENT', 'utf-8');
      await generate(fullStackAnswers('claude'));
      const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
      expect(content).not.toContain('OLD CONTENT');
    });
  });
});
