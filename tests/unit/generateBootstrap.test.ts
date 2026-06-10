import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import '../../src/providers/index'; // populate the provider registry
import '../../src/stack/modules/index'; // populate the module registry (resolveCommands reads it)
import { generateBootstrap } from '../../src/generator/index';
import { fullStackAnswers } from '../fixtures';
import { inTempProject } from '../helpers/tmpProject';

describe('generateBootstrap', () => {
  it('falls back to the static prompt when the provider has no CLI agent', async () => {
    await inTempProject(async () => {
      // No aiTool ⇒ the generic provider, which exposes no agent ⇒ static floor.
      const answers = { ...fullStackAnswers(), projectDefinition: 'A storefront API.' };
      const res = await generateBootstrap(answers, ['CLAUDE.md']);

      expect(res.mode).toBe('static');
      expect(res.path).toBe('bootstrap-prompt.md');
      expect(existsSync('bootstrap-prompt.md')).toBe(true);
      // The static floor still names the derived scaffold command.
      expect(readFileSync('bootstrap-prompt.md', 'utf8')).toContain('pnpm create next-app');
    });
  });
});
