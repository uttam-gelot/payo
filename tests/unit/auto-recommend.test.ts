import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { inTempProject } from '../helpers/tmpProject';
import { runFlow } from '../../src/questions/engine';
import { flow } from '../../src/questions/flow';
import { createSession, recordAnswer, type Session } from '../../src/state/index';

/**
 * "Detect everything" auto-fill: runFlow with { autoRecommendGates: true } resolves
 * every recommendable convention/preference gate to recommended-or-skip WITHOUT
 * prompting. The test pre-answers all non-gate single stack questions so no @clack
 * prompt can fire — if the auto path ever fell through to a gate prompt, runFlow
 * would block on @clack and the test would hang.
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
  };
  for (const [id, value] of Object.entries(singles)) s = recordAnswer(s, id, value);
  return s;
}

describe('autoRecommendGates', () => {
  it('resolves every convention/preference gate without prompting', async () =>
    inTempProject(async () => {
      const s = await runFlow(flow, seedSingles(), { autoRecommendGates: true });

      // Gate decisions are recorded as 'recommended' so the review can re-open them.
      expect(s.answers['conventions.__recommended']).toBe('recommended');
      expect(s.answers['tooling.__recommended']).toBe('recommended');
      expect(s.answers['testing.__recommended']).toBe('recommended');
      expect(s.answers['appconv.__recommended']).toBe('recommended');

      // Every gated question is now answered (recommended value or skip sentinel),
      // so the interview asks nothing in these groups.
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

  it('never overwrites a detected answer inside a gated group', async () =>
    inTempProject(async () => {
      // A detected convention (structure) recorded before the flow must survive —
      // detection wins over the recommended default.
      let s = seedSingles();
      s = recordAnswer(s, 'structure', 'monorepo');
      s = await runFlow(flow, s, { autoRecommendGates: true });
      expect(s.answers.structure).toBe('monorepo');
    }));
});
