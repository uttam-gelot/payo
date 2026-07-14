import { describe, it, expect } from 'bun:test';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const titles = (a: Answers): string[] => buildBaseRules(a).map((s) => s.title);

describe('buildBaseRules', () => {
  it('full-stack: emits Authentication, State Management and ORM data line', () => {
    const a: Answers = {
      ...contexts.tsFullstack,
      authApproach: 'authjs',
      authStrategy: 'session',
      rbac: true,
      stateManagement: 'zustand',
      runtime: 'node',
      packageManager: 'pnpm',
      validation: 'zod',
      codingStandards: ['DRY'],
      documentation: ['readme', 'comments'],
      logger: 'pino',
    };
    const t = titles(a);
    expect(t).toContain('Authentication');
    expect(t).toContain('State Management');
    expect(t).toContain('Documentation');

    const md = renderMarkdown('G', buildBaseRules(a));
    expect(md).toContain('- Data layer: prisma');
    expect(md).toContain('- Runtime: node');
    expect(md).toContain('- Validation: zod');
    expect(md).toContain('Maintain a README');
  });

  it('omits Documentation when none selected', () => {
    expect(titles(contexts.tsBackend)).not.toContain('Documentation');
  });

  it('renders tsconfig answers under Tech Details', () => {
    const md = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, 'tsconfig.strict': true }),
    );
    expect(md).toContain('## Tech Details');
    expect(md).toContain('- strict: yes');
  });

  it('reflects the AI-attribution choice in the Git Workflow section', () => {
    const off = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, gitWorkflow: 'standard', aiAttribution: false }),
    );
    expect(off).toContain('Do not mention AI assistants');

    const on = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, gitWorkflow: 'standard', aiAttribution: true }),
    );
    expect(on).toContain('Co-Authored-By');
  });

  it('emits commit-hygiene lines in the Git Workflow section when enabled', () => {
    const md = renderMarkdown(
      'G',
      buildBaseRules({
        ...contexts.tsBackend,
        gitWorkflow: 'standard',
        commitScope: true,
        commitScratchGuard: true,
        confirmPush: true,
        verifyTiming: 'push',
        atomicCommits: true,
      }),
    );
    expect(md).toContain('Scope each commit');
    expect(md).toContain('scratch/planning files');
    expect(md).toContain('Never push to a remote without explicit confirmation');
    expect(md).toContain('before pushing');
    expect(md).toContain('atomic');

    const off = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, gitWorkflow: 'standard' }),
    );
    expect(off).not.toContain('Scope each commit');
  });

  it('backend omits State Management', () => {
    const a: Answers = {
      ...contexts.tsBackend,
      stateManagement: 'zustand',
      authApproach: 'better-auth',
    };
    expect(titles(a)).not.toContain('State Management');
  });

  it('auth=none omits Authentication', () => {
    expect(titles({ ...contexts.tsBackend, authApproach: 'none' })).not.toContain('Authentication');
  });

  it('always includes Error Handling & Logging and Testing', () => {
    const t = titles(contexts.tsBackend);
    expect(t).toContain('Error Handling & Logging');
    expect(t).toContain('Testing');
  });

  it('adds the .env-read guard line only when envExampleOnly is set', () => {
    const guard = 'Never read or open the real .env file';
    const on = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, codingStandards: ['DRY'], envExampleOnly: true }),
    );
    expect(on).toContain(guard);

    const off = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, codingStandards: ['DRY'] }),
    );
    expect(off).not.toContain(guard);
  });

  it('emits centralized-logger guidance when logger=centralized', () => {
    const md = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, logger: 'centralized' }),
    );
    expect(md).toContain('Build one simple centralized logger module');
    expect(md).not.toContain('Log through centralized');

    const pino = renderMarkdown('G', buildBaseRules({ ...contexts.tsBackend, logger: 'pino' }));
    expect(pino).toContain('Log through pino');
  });
});

describe('monorepo structure', () => {
  it('emits Monorepo Structure + Workspace Packages instead of the plain layout line', () => {
    const a: Answers = {
      ...contexts.tsFullstack,
      structure: 'monorepo',
      monorepoPackages: [
        {
          path: 'apps/web',
          language: 'typescript',
          framework: 'nextjs',
          projectType: 'full-stack',
          database: 'postgresql',
        },
        {
          path: 'services/api',
          language: 'typescript',
          framework: 'fastify',
          projectType: 'backend',
        },
      ],
    };
    const t = titles(a);
    expect(t).toContain('Monorepo Structure');
    expect(t).toContain('Workspace Packages');
    expect(t).not.toContain('Folder Structure');

    const md = renderMarkdown('G', buildBaseRules(a));
    expect(md).toContain('Respect package boundaries');
    expect(md).toContain('`apps/web` — typescript / nextjs (full-stack), postgresql');
    expect(md).toContain('`services/api` — typescript / fastify (backend)');
    // The synthetic key never leaks into the generic Tech Details dump.
    expect(md).not.toContain('monorepoPackages');
  });

  it('a non-monorepo structure still uses the plain Folder Structure line', () => {
    const md = renderMarkdown('G', buildBaseRules({ ...contexts.tsBackend, structure: 'modular' }));
    expect(md).toContain('Use a modular layout.');
    expect(md).not.toContain('Monorepo Structure');
  });
});

describe('renderMarkdown', () => {
  it('renders the title and section headers', () => {
    const md = renderMarkdown('My Guide', [{ title: 'A', body: 'x' }]);
    expect(md.startsWith('# My Guide')).toBe(true);
    expect(md).toContain('## A');
  });
});
