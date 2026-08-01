import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { inTempProject } from '../helpers/tmpProject';
import { runFlow } from '../../src/questions/engine';
import { flow } from '../../src/questions/flow';
import { createSession, recordAnswer, type Session } from '../../src/state/index';

/**
 * "Detect everything" auto-fill: runFlow with { autoRecommendGates: true } resolves
 * every recommendable convention/preference gate WITHOUT prompting, treating the code
 * as the source of truth. Undetected project facts are skipped; only questions marked
 * `policyDefault` (safe assistant-behavior policies) keep their recommended default.
 * The test pre-answers all non-gate single stack questions so no @clack prompt can fire
 * — if the auto path ever fell through to a gate prompt, runFlow would block on @clack
 * and the test would hang.
 */

/** A script/python shape: minimal reachable single questions, no UI/server/auth. */
function seedSingles(): Session {
  let s = createSession();
  const singles: Record<string, unknown> = {
    aiTool: 'claude',
    supportTools: ['claude'],
    projectType: 'script',
    projectDefinition: 'A small utility.',
    language: 'python',
    database: 'none',
    logger: 'none',
    auditSkill: false,
    // Auto mode settles gates, not single questions: the gitleaks policy default
    // makes a hook check wanted, which would otherwise prompt for the runner.
    hookRunner: 'lefthook',
  };
  for (const [id, value] of Object.entries(singles)) s = recordAnswer(s, id, value);
  return s;
}

describe('autoRecommendGates', () => {
  it('settles every gate without prompting and answers every gated question', async () =>
    inTempProject(async () => {
      const s = await runFlow(flow, seedSingles(), { autoRecommendGates: true });

      // A gate keeps 'recommended' only when it kept at least one policy default;
      // a group of pure project facts (none detected here) settles to 'skip'.
      expect(s.answers['conventions.__recommended']).toBe('recommended'); // policy questions
      expect(s.answers['tooling.__recommended']).toBe('skip'); // pure facts, undetected
      expect(s.answers['testing.__recommended']).toBe('skip');
      expect(s.answers['appconv.__recommended']).toBe('skip');

      // Every gated question is answered (policy default or skip sentinel), so the
      // interview asks nothing in these groups.
      for (const id of [
        'structure',
        'codingStandards',
        'gitWorkflow',
        'formatter',
        'linter',
        'packageManager',
        'validation',
        'testTypes',
      ]) {
        expect(s.answered).toContain(id);
      }
    }));

  it('skips undetected project facts instead of fabricating them', async () =>
    inTempProject(async () => {
      const s = await runFlow(flow, seedSingles(), { autoRecommendGates: true });

      // Undetected facts land on the skip sentinel — no fabricated testing, API,
      // structure, tooling, or validation.
      expect(s.answers.testTypes).toEqual([]);
      expect(s.answers.structure).toBe('none');
      expect(s.answers.formatter).toBe('none');
      expect(s.answers.linter).toBe('none');
      expect(s.answers.validation).toBe('none');
      expect(s.answers.gitWorkflow).toBe('none');
    }));

  it('keeps safe assistant-behavior policy defaults', async () =>
    inTempProject(async () => {
      const s = await runFlow(flow, seedSingles(), { autoRecommendGates: true });

      // policyDefault questions keep their recommended value even when undetected.
      expect(s.answers.confirmPush).toBe(true);
      expect(s.answers.atomicCommits).toBe(true);
      expect(s.answers.commitScope).toBe(true);
      expect(s.answers.aiAttribution).toBe(false);
      expect(s.answers.codingStandards).toEqual(['DRY', 'modular', 'soc']);
    }));

  it('never overwrites a detected answer inside a gated group', async () =>
    inTempProject(async () => {
      // A detected convention (structure) recorded before the flow must survive —
      // detection wins over the skip/policy default.
      let s = seedSingles();
      s = recordAnswer(s, 'structure', 'monorepo');
      s = await runFlow(flow, s, { autoRecommendGates: true });
      expect(s.answers.structure).toBe('monorepo');
    }));
});
