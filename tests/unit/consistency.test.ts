/**
 * Cross-skill consistency: skills are written by parallel agent runs, so every
 * prompt must carry the same pinned decisions and ownership map, and Payo's own
 * templates must not contradict the answers (wrong package manager, a password
 * rule under a hosted IdP, "blocks the commit" when only pre-push runs, …).
 */
import { describe, it, expect, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { setAgentOverride, resetAgentOverride } from '../helpers/agentMock';
import { generate } from '../../src/generator/index';
import { emitHooks, hookSetupHints } from '../../src/generator/hooks';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import {
  blockedActions,
  HOOK_PLAN_KEY,
  planHooks,
  SECRET_SCAN_COMMAND,
} from '../../src/generator/hookplan';
import { ownershipBlock, sharedFactLines } from '../../src/generator/shared';
import {
  authStrategyLine,
  codingStandardLine,
  gitWorkflowLine,
  isFreeText,
  stripEmDashes,
  structureLine,
  tidyText,
} from '../../src/generator/describe';
import { classSortRule } from '../../src/stack/modules/styling/tailwind';
import { usesExternalIdentity } from '../../src/stack/predicates';
import { inTempProject } from '../helpers/tmpProject';
import { fullStackAnswers } from '../fixtures';
import type { AgentResult } from '../../src/generator/agent';
import type { Answers } from '../../src/questions/types';

const md = (a: Answers): string => renderMarkdown('G', buildBaseRules(a));

function capturePrompts(): {
  prompts: Map<string, string>;
  runAgent: (runner: unknown, prompt: string) => AgentResult;
} {
  const prompts = new Map<string, string>();
  return {
    prompts,
    runAgent: (_runner, prompt): AgentResult => {
      const id = /\.\/\S*skills\/([^/]+)\//.exec(prompt)?.[1];
      if (id) prompts.set(id, prompt);
      return { ok: false, stderr: 'capture-only, not writing' };
    },
  };
}

describe('shared facts in every skill prompt', () => {
  afterEach(() => resetAgentOverride());

  it('pins the test runner, tooling and ownership in every prompt', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    expect(prompts.size).toBeGreaterThan(3);
    for (const [id, p] of prompts) {
      expect(p, id).toContain('Fixed project decisions');
      expect(p, id).toContain('vitest for unit and integration tests');
      expect(p, id).toContain('formatter prettier, linter eslint');
      expect(p, id).toContain('Ownership:');
    }
    expect(prompts.get('auth')).toContain(
      'This skill defines: the user identity and session shape',
    );
    expect(prompts.get('coding-standards')).toMatch(/auth guard function names.*: `auth`/);
  });

  it('adds the no-invent rule for a new project only', async () => {
    const { prompts, runAgent } = capturePrompts();
    setAgentOverride({ isAvailable: true, runAgent });
    await inTempProject(async () => {
      await generate(fullStackAnswers('claude'));
    });
    const p = prompts.get('api-conventions') ?? '';
    expect(p).toContain('Do not invent domain resources');
    expect(p).toContain('"user note"');
  });
});

describe('sharedFactLines', () => {
  it('states the hook-run checks and forbids running them by hand', () => {
    const a: Answers = { ...fullStackAnswers(), gitleaks: true };
    const facts = sharedFactLines({ ...a, [HOOK_PLAN_KEY]: planHooks(a) }).join('\n');
    expect(facts).toContain('Never tell the assistant to run those checks by hand');
    expect(facts).toContain('blocks the push');
  });

  it('pins the /v1 prefix only on a new project', () => {
    const a = fullStackAnswers();
    expect(sharedFactLines(a).join('\n')).toContain('/v1');
    expect(sharedFactLines({ ...a, detectEverything: true }).join('\n')).not.toContain('/v1');
  });
});

describe('ownershipBlock', () => {
  it('falls back to the next owner when the first is not selected', () => {
    const block = ownershipBlock('api-conventions', ['api-conventions', 'coding-standards']);
    expect(block).toContain('This skill defines: error classes');
  });

  it('lists concepts owned elsewhere with their owner', () => {
    const block = ownershipBlock('testing', ['testing', 'auth', 'tooling']);
    expect(block).toMatch(/auth guard function names.*: `auth`/);
    expect(block).toMatch(/formatter, linter.*: `tooling`/);
    expect(block).not.toContain('`testing`');
  });

  it('is empty when nothing is shared', () => {
    expect(ownershipBlock('pr-review', ['pr-review'])).toBe('');
  });
});

describe('Tailwind class ordering follows the formatter', () => {
  const tw = (formatter?: string): Answers => ({
    stylingLibrary: 'tailwind',
    'tailwind.classOrder': true,
    ...(formatter ? { formatter } : {}),
  });

  it('uses Biome useSortedClasses with Biome', () => {
    expect(classSortRule(tw('biome'))).toContain('useSortedClasses');
    expect(classSortRule(tw('biome'))).not.toContain('prettier-plugin-tailwindcss');
  });

  it('uses prettier-plugin-tailwindcss with Prettier or no formatter', () => {
    expect(classSortRule(tw('prettier'))).toContain('prettier-plugin-tailwindcss');
    expect(classSortRule(tw())).toContain('prettier-plugin-tailwindcss');
  });

  it('is off when not asked for', () => {
    expect(classSortRule({ stylingLibrary: 'tailwind' })).toBeUndefined();
  });
});

describe('password rule respects the identity provider', () => {
  it('drops the hashing rule for a hosted IdP', () => {
    const a: Answers = { ...fullStackAnswers(), authApproach: 'cognito', authStrategy: 'jwt' };
    expect(usesExternalIdentity(a)).toBe(true);
    expect(md(a)).not.toContain('Hash passwords');
  });

  it('keeps it for self-managed auth', () => {
    expect(md(fullStackAnswers())).toContain('Hash passwords');
  });
});

describe('blockedActions', () => {
  it('names only the stage that runs checks', () => {
    expect(blockedActions(planHooks({ gitleaks: true }))).toBe('the push');
    expect(blockedActions(undefined)).toBeUndefined();
  });

  it('AGENTS.md does not claim a commit is blocked for a push-only hook', () => {
    const a: Answers = { ...fullStackAnswers(), gitleaks: true, verifyTiming: 'push' };
    const out = md({ ...a, [HOOK_PLAN_KEY]: planHooks(a) });
    expect(out).toContain('blocks the push when a check fails');
    expect(out).not.toContain('blocks the commit or push');
  });
});

describe('describe helpers', () => {
  it('tidies free text without rewording', () => {
    expect(tidyText('  build a   portal.  for partners ')).toBe('Build a portal. For partners.');
    expect(isFreeText('my-orm')).toBe(false);
    expect(isFreeText('use cookies with short lived tokens')).toBe(true);
  });

  it('marks a free-text session strategy as a user note', () => {
    expect(authStrategyLine('jwt')).toContain('stateless JWT');
    expect(authStrategyLine('store tokens in the cookie i guess')).toContain(
      '(user note, in their words): Store tokens in the cookie i guess.',
    );
  });

  it('turns option ids into readable lines', () => {
    expect(structureLine('standard')).toBe("Use the framework's default folder layout.");
    expect(structureLine('modular')).toBe('Use a modular layout.');
    expect(gitWorkflowLine('standard')).toContain('feature branches');
    expect(codingStandardLine('soc')).toBe('Separation of concerns');
  });

  it('strips em dashes from Payo text only when the convention is chosen', () => {
    expect(stripEmDashes('Styling — Tailwind CSS', true)).toBe('Styling: Tailwind CSS');
    const a: Answers = { ...fullStackAnswers(), aiConventions: ['no-em-dash'] };
    const sections = buildBaseRules(a).filter((s) => s.title !== 'AI Writing Conventions');
    for (const s of sections) {
      expect(s.title).not.toContain('—');
      expect(s.body).not.toContain('—');
    }
  });
});

describe('hook setup uses the project package manager', () => {
  it('husky banner and hints use bun for a Bun project', () =>
    inTempProject((dir) => {
      const a: Answers = { gitleaks: true, hookRunner: 'husky', packageManager: 'bun' };
      const plan = planHooks(a);
      const files = emitHooks(a, ['claude'], dir, plan);
      const sh = readFileSync(join(dir, '.husky/pre-push'), 'utf8');
      expect(sh).toContain('bun add -d husky');
      expect(sh).toContain('bunx husky');
      expect(sh).not.toContain('npm');
      expect(hookSetupHints(files, a, plan).join('\n')).toContain('bunx husky');
    }));
});

describe('secret-scan hook command', () => {
  it('blocks with an install message when gitleaks is missing', () => {
    const r = spawnSync('/bin/sh', ['-c', SECRET_SCAN_COMMAND], {
      env: { PATH: '/usr/bin:/bin' },
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('gitleaks is not installed');
  });

  it('stays valid YAML in lefthook and pre-commit configs', () =>
    inTempProject((dir) => {
      emitHooks({ gitleaks: true }, ['claude']);
      const lh = Bun.YAML.parse(readFileSync(join(dir, 'lefthook.yml'), 'utf8')) as {
        'pre-push': { commands: Record<string, { run: string }> };
      };
      const runs = Object.values(lh['pre-push'].commands).map((c) => c.run);
      expect(runs).toContain(SECRET_SCAN_COMMAND);
    }));

  it('stays valid YAML in a pre-commit config', () =>
    inTempProject((dir) => {
      emitHooks({ gitleaks: true, hookRunner: 'pre-commit' }, ['claude']);
      const pc = Bun.YAML.parse(readFileSync(join(dir, '.pre-commit-config.yaml'), 'utf8')) as {
        repos: { hooks: { entry: string }[] }[];
      };
      expect(pc.repos[0].hooks.map((h) => h.entry)).toContain(SECRET_SCAN_COMMAND);
    }));
});
