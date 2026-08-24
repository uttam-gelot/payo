/**
 * Regression guard for per-skill prompt scoping (`sectionsFor` in
 * src/generator/index.ts): each generated skill's prompt should carry only
 * the rule sections its own `buildPrompt` actually needs, not the full
 * section list every other skill also gets.
 */
import { describe, it, expect, afterEach } from 'bun:test';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { generate } from '../../src/generator/index';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';
import type { AgentResult } from '../../src/generator/agent';

/** Matches a section heading exactly (not as a substring of a longer, guidance-suffixed one). */
const heading = (title: string): RegExp => new RegExp(`^## ${title}$`, 'm');

/** Capture the composed prompt per skill id, keyed off its target `./path` line, without writing files. */
function capturePrompts(): {
  prompts: Map<string, string>;
  runAgent: (runner: unknown, prompt: string) => AgentResult;
} {
  const prompts = new Map<string, string>();
  return {
    prompts,
    runAgent: (_runner, prompt): AgentResult => {
      const target = /\.\/(\S+)/.exec(prompt)?.[1];
      const id = target?.match(/skills\/([^/]+)\//)?.[1];
      if (id) prompts.set(id, prompt);
      return { ok: false, stderr: 'capture-only, not writing' };
    },
  };
}

describe('per-skill prompt scoping', () => {
  afterEach(() => resetAgentOverride());

  it('excludes sections irrelevant to a topic skill', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    const codingStandards = prompts.get('coding-standards');
    expect(codingStandards).toBeDefined();
    expect(codingStandards).not.toMatch(heading('Authentication'));
    expect(codingStandards).not.toMatch(heading('Testing'));
    expect(codingStandards).not.toMatch(heading('Git Workflow'));
  });

  it('keeps the Authentication section for auth despite the title mismatch', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    expect(prompts.get('auth')).toMatch(heading('Authentication'));
  });

  it('keeps the Data section for data-layer despite the title mismatch', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    expect(prompts.get('data-layer')).toMatch(heading('Data'));
  });

  it('never drops a provider guidance section from any skill', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    // fullStackAnswers selects Auth.js + Tailwind, each contributing a guidance
    // section. Since those carry no owning-skill tag, every generated skill's
    // prompt should contain both, not just auth's / framework-conventions's.
    for (const [id, prompt] of prompts) {
      expect(prompt, `${id} should keep the Auth.js guidance section`).toContain(
        '## Authentication — Auth.js',
      );
      expect(prompt, `${id} should keep the Tailwind guidance section`).toContain(
        '## Styling — Tailwind CSS',
      );
    }
  });

  it('change-audit prompt is scoped to grounding only', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    const answers = { ...fullStackAnswers('claude'), auditSkill: true, auditTiming: 'push' };
    await inTempProject(async () => {
      await generate(answers);
    });
    const changeAudit = prompts.get('change-audit');
    expect(changeAudit).toBeDefined();
    expect(changeAudit).not.toMatch(heading('Data'));
    expect(changeAudit).not.toMatch(heading('Testing'));
    // Guidance sections still pass through — they're always kept, per the design.
    expect(changeAudit).toContain('## Authentication — Auth.js');
  });
});
