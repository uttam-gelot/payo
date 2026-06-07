import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { buildBootstrapPrompt, writeBootstrapPrompt } from '../../src/generator/bootstrap';
import { fullStackAnswers } from '../fixtures';
import { inTempProject } from '../helpers/tmpProject';

const files = ['CLAUDE.md', '.claude/skills/api-conventions/SKILL.md'];

describe('buildBootstrapPrompt', () => {
  const answers = { ...fullStackAnswers(), projectDefinition: 'A storefront API.' };
  const prompt = buildBootstrapPrompt(answers, files, 'Claude (Anthropic)');

  it('embeds the project description and key stack choices', () => {
    expect(prompt).toContain('A storefront API.');
    expect(prompt).toContain('- Language: typescript');
    expect(prompt).toContain('- Framework: nextjs');
    expect(prompt).toContain('- Package manager: pnpm');
  });

  it('references the provider and every generated file', () => {
    expect(prompt).toContain('Claude (Anthropic)');
    for (const f of files) expect(prompt).toContain(`- ${f}`);
  });

  it('includes the scaffolding task instructions', () => {
    expect(prompt).toContain('## Your task');
    expect(prompt).toContain('runnable skeleton');
  });
});

describe('writeBootstrapPrompt', () => {
  it('writes bootstrap-prompt.md to cwd and returns its relative path', async () => {
    await inTempProject(() => {
      const answers = { ...fullStackAnswers(), projectDefinition: 'A storefront API.' };
      const rel = writeBootstrapPrompt(answers, files, 'Codex CLI');
      expect(rel).toBe('bootstrap-prompt.md');
      expect(existsSync(rel)).toBe(true);
      expect(readFileSync(rel, 'utf8')).toBe(buildBootstrapPrompt(answers, files, 'Codex CLI'));
    });
  });
});
