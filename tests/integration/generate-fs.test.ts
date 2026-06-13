import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { generate } from '../../src/generator/index';
import { listProviders } from '../../src/providers/index';
import { buildBaseRules } from '../../src/generator/rules';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';

describe('generate() — static output on disk', () => {
  // Force the static path: no agent is "available".
  beforeEach(() => setAgentOverride({ isAvailable: false }));
  afterEach(() => resetAgentOverride());

  for (const provider of listProviders()) {
    it(`writes the ${provider.id} artifact reflecting the answers`, async () => {
      await inTempProject(async (dir) => {
        const answers = fullStackAnswers(provider.id);
        const res = await generate(answers);
        expect(res.mode).toBe('static');

        // The provider owns its artifact paths; assert generate() wrote exactly
        // those, derived from the provider rather than a duplicated path map.
        const expected = provider
          .generate({ answers, sections: buildBaseRules(answers) })
          .map((a) => a.path);
        expect(res.files).toEqual(expected);

        for (const rel of expected) {
          const content = readFileSync(join(dir, rel), 'utf-8');
          expect(content).toContain('## Authentication');
          expect(content).toContain('prisma');
        }
      });
    });
  }

  it('is idempotent across re-runs', async () => {
    await inTempProject(async (dir) => {
      await generate(fullStackAnswers('claude'));
      const first = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      await generate(fullStackAnswers('claude'));
      const second = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      expect(second).toBe(first);
    });
  });

  // generate() itself overwrites by design; the CLI's overwrite guard
  // (predictTargets + confirmOverwrite in src/cli/index.ts) prompts before
  // generate() is ever called, so this layer stays unconditional.
  it('overwrites a pre-existing artifact when invoked directly', async () => {
    await inTempProject(async (dir) => {
      writeFileSync(join(dir, 'CLAUDE.md'), 'OLD CONTENT', 'utf-8');
      await generate(fullStackAnswers('claude'));
      const content = readFileSync(join(dir, 'CLAUDE.md'), 'utf-8');
      expect(content).not.toContain('OLD CONTENT');
    });
  });
});
