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
});

describe('renderMarkdown', () => {
  it('renders the title and section headers', () => {
    const md = renderMarkdown('My Guide', [{ title: 'A', body: 'x' }]);
    expect(md.startsWith('# My Guide')).toBe(true);
    expect(md).toContain('## A');
  });
});
