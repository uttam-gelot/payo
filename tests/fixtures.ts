/**
 * Shared test fixtures: representative answer sets per ecosystem and a helper
 * to build an in-memory session (no disk write) for engine tests.
 */
import { createSession, type Session } from '../src/state/index';
import type { Answers } from '../src/questions/types';

/** A realistic answer set per ecosystem, keyed for readable test names. */
export const contexts: Record<string, Answers> = {
  tsFrontend: {
    language: 'typescript',
    projectType: 'frontend',
    framework: 'react',
    database: 'none',
  },
  tsFullstack: {
    language: 'typescript',
    projectType: 'full-stack',
    framework: 'nextjs',
    database: 'postgresql',
    orm: 'prisma',
  },
  tsBackend: {
    language: 'typescript',
    projectType: 'backend',
    framework: 'nestjs',
    database: 'postgresql',
    orm: 'prisma',
  },
  pyBackend: {
    language: 'python',
    projectType: 'backend',
    framework: 'fastapi',
    database: 'postgresql',
    orm: 'sqlalchemy',
  },
  goBackend: {
    language: 'go',
    projectType: 'backend',
    framework: 'gin',
    database: 'mysql',
    orm: 'gorm',
  },
  rustBackend: {
    language: 'rust',
    projectType: 'backend',
    framework: 'axum',
    database: 'postgresql',
    orm: 'seaorm',
  },
  phpBackend: {
    language: 'php',
    projectType: 'backend',
    framework: 'laravel',
    database: 'mysql',
    orm: 'eloquent',
  },
};

export const allContexts: Answers[] = Object.values(contexts);

/**
 * A complete TypeScript full-stack answer set with every recommendable group
 * resolved. Pass `aiTool` to target a provider when driving `generate()`; omit
 * it for renderer-level tests that build a `GenerationContext` directly.
 */
export function fullStackAnswers(aiTool?: string): Answers {
  return {
    ...contexts.tsFullstack,
    ...(aiTool ? { aiTool } : {}),
    apiArchitecture: 'rest',
    stylingLibrary: 'tailwind',
    authApproach: 'authjs',
    authStrategy: 'session',
    rbac: true,
    stateManagement: 'zustand',
    validation: 'zod',
    runtime: 'node',
    packageManager: 'pnpm',
    structure: 'standard',
    codingStandards: ['DRY'],
    documentation: ['readme', 'comments'],
    logger: 'pino',
    formatter: 'prettier',
    linter: 'eslint',
    testTypes: ['unit', 'integration'],
    testRunner: 'vitest',
    gitWorkflow: 'standard',
    aiAttribution: false,
    commitScope: true,
    commitScratchGuard: true,
    confirmPush: true,
    verifyBeforeCommit: true,
    atomicCommits: true,
  };
}

/**
 * Build an in-memory session seeded with answers. `planRecommended` only reads
 * `session.answers` / `session.answered`, so this needs no disk persistence.
 */
export function freshSession(answers: Answers): Session {
  return { ...createSession(), answers: { ...answers }, answered: Object.keys(answers) };
}
