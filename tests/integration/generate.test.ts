import { describe, it, expect } from 'bun:test';
import { getProvider, listProviders } from '../../src/providers/index';
import { buildBaseRules } from '../../src/generator/rules';
import type { GenerationContext } from '../../src/generator/types';
import { fullStackAnswers } from '../fixtures';

const fullAnswers = fullStackAnswers();
const ctx: GenerationContext = { answers: fullAnswers, sections: buildBaseRules(fullAnswers) };

describe('provider.generate (static renderer)', () => {
  it('Claude writes CLAUDE.md with the expected sections', () => {
    const claude = getProvider('claude');
    expect(claude).toBeDefined();
    const arts = claude!.generate(ctx);
    expect(arts).toHaveLength(1);
    expect(arts[0].path).toBe('CLAUDE.md');
    expect(arts[0].content).toContain('## Authentication');
    expect(arts[0].content).toContain('## State Management');
  });

  it('Codex writes AGENTS.md', () => {
    const codex = getProvider('codex');
    expect(codex).toBeDefined();
    expect(codex!.generate(ctx)[0].path).toBe('AGENTS.md');
  });

  it('Antigravity writes AGENTS.md and drives the agy CLI into .agents/skills', () => {
    const antigravity = getProvider('antigravity');
    expect(antigravity).toBeDefined();
    expect(antigravity!.generate(ctx)[0].path).toBe('AGENTS.md');
    expect(antigravity!.agent?.binary).toBe('agy');
    expect(antigravity!.agent?.outputPath('x')).toBe('.agents/skills/x.md');
  });

  it('every registered provider produces non-empty artifacts', () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      const arts = provider.generate(ctx);
      expect(arts.length).toBeGreaterThan(0);
      for (const art of arts) {
        expect(art.path.length).toBeGreaterThan(0);
        expect(art.content.length).toBeGreaterThan(0);
      }
    }
  });
});
