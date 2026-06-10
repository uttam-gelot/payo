import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import '../../src/stack/modules/index'; // populate the module registry (resolveCommands reads it)
import {
  buildBootstrapPrompt,
  buildBootstrapMetaPrompt,
  writeBootstrapPrompt,
} from '../../src/generator/bootstrap';
import { resolveCommands } from '../../src/generator/commands';
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

  it('names the derived scaffold command and package manager', () => {
    // fullStackAnswers ⇒ Next.js + pnpm.
    expect(prompt).toContain('pnpm create next-app');
    expect(prompt).toContain('Install dependencies with pnpm');
  });

  it('surfaces tooling, env, and resolved run/test commands', () => {
    expect(prompt).toContain('the formatter (prettier)');
    expect(prompt).toContain('the linter (eslint)');
    expect(prompt).toContain('.env.example');
    expect(prompt).toContain('run it with `pnpm dev`');
    expect(prompt).toContain('run tests with `pnpm test`');
    expect(prompt).toContain('typecheck / lint / test commands');
  });

  it('omits optional steps when the stack does not specify them', () => {
    const minimal = buildBootstrapPrompt(
      { language: 'go', framework: 'express', projectDefinition: 'A tiny API.' },
      files,
      'Codex CLI',
    );
    // No official generator ⇒ generic scaffolding wording, no create command.
    expect(minimal).toContain("stack's official tooling");
    expect(minimal).not.toContain('create');
    // No package manager / formatter / linter ⇒ those steps absent.
    expect(minimal).not.toContain('Install dependencies with');
    expect(minimal).not.toContain('the formatter (');
    // The generated files are still referenced.
    for (const f of files) expect(minimal).toContain(`- ${f}`);
  });
});

describe('buildBootstrapMetaPrompt', () => {
  const answers = { ...fullStackAnswers(), projectDefinition: 'A storefront API.' };
  const meta = buildBootstrapMetaPrompt(
    answers,
    files,
    'Claude (Anthropic)',
    resolveCommands(answers),
  );

  it('directs the agent to write the project-local bootstrap-prompt.md only', () => {
    expect(meta).toContain('./bootstrap-prompt.md');
    expect(meta).toContain('Output ONLY that file');
    expect(meta).toContain('Do NOT write to any global');
  });

  it('embeds the spec, source-of-truth files, and curated commands', () => {
    expect(meta).toContain('A storefront API.');
    for (const f of files) expect(meta).toContain(`- ${f}`);
    expect(meta).toContain('Scaffold: `pnpm create next-app`');
    expect(meta).toContain('do not invent or alter');
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
