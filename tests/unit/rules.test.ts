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
    expect(md).toContain('- TypeScript Config / Strict mode: yes');
  });

  it('renders Python follow-up details without leaking recommended gate decisions', () => {
    const md = renderMarkdown(
      'G',
      buildBaseRules({
        ...contexts.pyBackend,
        authApproach: 'custom-jwt',
        'fastapi.__recommended': 'recommended',
        'fastapi.structure': 'routers',
        'fastapi.async': 'async',
        'fastapi.server': 'uvicorn',
        'custom-jwt.__recommended': 'recommended',
        'custom-jwt.refresh': true,
      }),
    );

    expect(md).toContain('- FastAPI / Structure: APIRouters + dependency injection');
    expect(md).toContain('- FastAPI / Concurrency: async def endpoints');
    expect(md).toContain('- FastAPI / ASGI server: uvicorn');
    expect(md).toContain('- Custom JWT / Sessions / Refresh tokens: yes');
    expect(md).not.toContain('recommended: recommended');
    expect(md).not.toContain('__recommended');
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

  it('adds the destructive-SQL/migration guard line only when dbSafety is set', () => {
    const guard = 'Never run destructive SQL or database migrations without explicit confirmation';
    const on = renderMarkdown('G', buildBaseRules({ ...contexts.tsBackend, dbSafety: true }));
    expect(on).toContain(guard);

    const off = renderMarkdown('G', buildBaseRules(contexts.tsBackend));
    expect(off).not.toContain(guard);
  });

  it('emits the gitleaks line in the Git Workflow section only when enabled', () => {
    const on = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, gitWorkflow: 'standard', gitleaks: true }),
    );
    expect(on).toContain('gitleaks');

    const off = renderMarkdown(
      'G',
      buildBaseRules({ ...contexts.tsBackend, gitWorkflow: 'standard' }),
    );
    expect(off).not.toContain('gitleaks');
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

  it('includes Error Handling & Logging by default; Testing only with test content', () => {
    expect(titles(contexts.tsBackend)).toContain('Error Handling & Logging');
    // No test types/runner/e2e → no fabricated Testing section.
    expect(titles(contexts.tsBackend)).not.toContain('Testing');
    // With test content it appears.
    expect(titles({ ...contexts.tsBackend, testTypes: ['unit'] })).toContain('Testing');
  });

  it('detect-everything treats existing code as source of truth', () => {
    // No API versioning prescribed, no fabricated Testing, and no logger invented.
    const md = renderMarkdown(
      'G',
      buildBaseRules({
        ...contexts.tsBackend,
        apiArchitecture: 'rest',
        logger: 'none',
        testTypes: [],
        detectEverything: true,
      }),
    );
    expect(md).toContain('## API Conventions');
    expect(md).not.toContain('/v1');
    expect(md).not.toContain('## Testing');
    expect(md).not.toContain('## Error Handling & Logging');
  });

  it('renders detected git branch/commit conventions in the Git Workflow section', () => {
    const md = renderMarkdown(
      'G',
      buildBaseRules({
        ...contexts.tsBackend,
        gitWorkflow: 'standard',
        branchNaming: 'type-slash',
        commitConvention: 'conventional',
      }),
    );
    expect(md).toContain('type-prefixed branches');
    expect(md).toContain('Conventional Commits');
  });

  it('renders Git Workflow from detected conventions/policies even when gitWorkflow is skipped', () => {
    // Mirrors detect-everything: gitWorkflow skipped, but conventions + safe
    // policies are present and must still surface.
    const md = renderMarkdown(
      'G',
      buildBaseRules({
        ...contexts.tsBackend,
        gitWorkflow: 'none',
        branchNaming: 'kebab',
        commitConvention: 'conventional',
        confirmPush: true,
        aiAttribution: false,
      }),
    );
    expect(md).toContain('## Git Workflow');
    expect(md).toContain('kebab-case');
    expect(md).toContain('Conventional Commits');
    expect(md).toContain('Never push to a remote without explicit confirmation');
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

describe('hybrid repo rendering', () => {
  it('Tech Stack lists additional languages with the dirs that carry them', () => {
    const answers: Answers = {
      projectType: 'full-stack',
      language: 'typescript',
      secondaryLanguages: ['rust'],
      monorepoPackages: [
        { path: 'admin-frontend', language: 'typescript', framework: 'react' },
        { path: 'services', language: 'rust', memberCount: 8 },
      ],
    };
    const md = renderMarkdown('Rules', buildBaseRules(answers));
    expect(md).toContain('- Additional languages: rust (services)');
  });

  it('renders a collapsed nested-workspace package line', () => {
    const answers: Answers = {
      language: 'typescript',
      structure: 'monorepo',
      monorepoPackages: [
        { path: 'admin-frontend', language: 'typescript', framework: 'react' },
        { path: 'services', language: 'rust', memberCount: 8 },
      ],
    };
    const md = renderMarkdown('Rules', buildBaseRules(answers));
    expect(md).toContain('`services` — rust workspace (8 packages)');
  });

  it('omits the additional-languages line when there are none', () => {
    const md = renderMarkdown('Rules', buildBaseRules({ language: 'typescript' }));
    expect(md).not.toContain('Additional languages');
  });
});
