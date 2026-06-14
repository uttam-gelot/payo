import { describe, it, expect } from 'bun:test';
import { flow } from '../../src/questions/flow';
import { planRecommended } from '../../src/questions/engine';
import { contexts, freshSession } from '../fixtures';
import type { Answers } from '../../src/questions/types';

/**
 * Simulate the "use recommended" path the way the engine does: walk the flow in
 * order, and for each recommendable group apply its recommended plan into the
 * running answers so dependent `when` conditions resolve as they will at runtime.
 * Returns the final answer map produced by accepting every recommended gate.
 */
function applyRecommended(seed: Answers): Answers {
  let session = freshSession(seed);
  for (const section of flow) {
    if (!section.recommendable) continue;
    if (!section.gate?.(session.answers)) continue;
    const plan = planRecommended(section, session);
    if (!plan) continue;
    const applied = Object.fromEntries(plan.map((p) => [p.question.id, p.value]));
    session = {
      ...session,
      answers: { ...session.answers, ...applied },
      answered: [...session.answered, ...Object.keys(applied)],
    };
  }
  return session.answers;
}

describe('recommended path applies correct values', () => {
  it('TS full-stack (Next.js + Prisma): expected defaults and when-skips', () => {
    const a = applyRecommended(contexts.tsFullstack);

    // framework follow-ups (expandSelected) — components only because router=app
    expect(a['nextjs.router']).toBe('app');
    expect(a['nextjs.components']).toBe('server');
    expect(a['nextjs.data']).toBe('server-fetch');

    // ORM follow-ups
    expect(a['prisma.migrations']).toBe('migrate');
    expect(a['prisma.client']).toBe('singleton');

    // authentication group
    expect(a.authApproach).toBe('authjs');
    expect(a.authStrategy).toBe('session');
    expect(a.rbac).toBe(false);

    // conventions
    expect(a.structure).toBe('standard');
    expect(a.codingStandards).toEqual(['DRY', 'modular', 'soc']);
    expect(a.documentation).toEqual(['readme', 'comments']);
    expect(a.gitWorkflow).toBe('standard');
    expect(a.aiAttribution).toBe(false);
    expect(a.commitScope).toBe(true);
    expect(a.commitScratchGuard).toBe(true);
    expect(a.confirmPush).toBe(true);
    expect(a.verifyBeforeCommit).toBe(true);
    expect(a.atomicCommits).toBe(true);
    expect(a.envExampleOnly).toBe(true);

    // validation & state
    expect(a.validation).toBe('zod');
    expect(a.stateManagement).toBe('zustand');

    // runtime & tooling
    expect(a.packageManager).toBe('pnpm');
    expect(a.runtime).toBe('node');
    expect(a.formatter).toBe('prettier');
    expect(a.linter).toBe('eslint');

    // tsconfig (TypeScript only) — bundler default for non-backend
    expect(a['tsconfig.strict']).toBe(true);
    expect(a['tsconfig.target']).toBe('ES2022');
    expect(a['tsconfig.module-resolution']).toBe('bundler');
    expect(a['tsconfig.path-aliases']).toBe(true);

    // testing — e2eTool is skipped because recommended testTypes excludes e2e
    expect(a.testTypes).toEqual(['unit', 'integration']);
    expect(a.testRunner).toBe('vitest');
    expect(a.e2eTool).toBeUndefined();
  });

  it('Python backend: language/projectType-gated questions are skipped', () => {
    const a = applyRecommended(contexts.pyBackend);

    // backend ⇒ no state management; python ⇒ no JS runtime, no tsconfig
    expect(a.stateManagement).toBeUndefined();
    expect(a.runtime).toBeUndefined();
    expect(a['tsconfig.strict']).toBeUndefined();

    // python package manager + framework follow-ups still apply
    expect(a.packageManager).toBe('uv');
    expect(a['fastapi.structure']).toBe('routers');
    expect(a['sqlalchemy.migrations']).toBe('alembic');

    // auth strategy still applies on a backend
    expect(a.authStrategy).toBe('session');
  });
});
