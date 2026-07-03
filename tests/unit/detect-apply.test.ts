import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { writeFileSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { detectStack } from '../../src/detect/index';
import { splitByTier } from '../../src/detect/tiers';
import { createSession, recordAnswer, seedDetected, loadSession } from '../../src/state/index';
import { reconcile } from '../../src/questions/engine';
import { flow } from '../../src/questions/flow';

/**
 * End-to-end apply policy (mirrors src/cli/index.ts): Tier-1 stack facts are
 * always recorded (and so skipped by the flow). In "everything" mode, detected
 * Tier-2 conventions are recorded too — so the interview asks only what detection
 * could not find. In "partial" mode conventions are left to the interview.
 */

/** A Next.js + Prisma + Turbo monorepo — yields a Tier-2 `structure: monorepo`. */
const writeMonorepo = (dir: string): void => {
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      dependencies: { next: '15', react: '18', '@prisma/client': '5', pg: '8' },
      devDependencies: { typescript: '5', prettier: '3', eslint: '8' },
    }),
  );
  writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
  writeFileSync(join(dir, 'turbo.json'), '{}');
  writeFileSync(join(dir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
};

describe('detection apply policy', () => {
  it('records Tier-1 facts and detected Tier-2 conventions (everything mode)', () =>
    inTempProject((dir) => {
      writeMonorepo(dir);
      const det = detectStack(dir);
      const { tier1, tier2 } = splitByTier(det.answers as Record<string, unknown>);

      let s = createSession();
      for (const [id, value] of Object.entries(tier1)) s = recordAnswer(s, id, value);
      for (const [id, value] of Object.entries(tier2)) s = recordAnswer(s, id, value); // everything mode

      // Tier-1 facts are answered (and therefore skipped by runFlow).
      expect(s.answered).toContain('framework');
      expect(s.answered).toContain('database');
      expect(s.answered).toContain('formatter');

      // `structure` was detected as monorepo and is now recorded too, so the
      // question is skipped — only unfound questions get asked. The user still
      // edits it on the review screen.
      expect(det.answers.structure).toBe('monorepo');
      expect(s.answered).toContain('structure');
      expect(s.answers.structure).toBe('monorepo');

      // Persisted state agrees.
      const loaded = loadSession();
      expect(loaded?.answered).toContain('structure');
      expect(loaded?.answers.structure).toBe('monorepo');
    }));

  it('LLM-sourced fills are seeded (still asked), not recorded as facts', () =>
    inTempProject(() => {
      // Mirrors the CLI apply policy: a Stage-2 fill (source 'llm') is only a
      // guess — it pre-selects the question but must not skip it.
      const sources: Record<string, string> = { framework: 'package.json', database: 'llm' };
      const answers: Record<string, unknown> = { framework: 'nextjs', database: 'postgresql' };

      let s = createSession();
      for (const [id, value] of Object.entries(answers)) {
        s = sources[id] === 'llm' ? seedDetected(s, { [id]: value }) : recordAnswer(s, id, value);
      }

      expect(s.answered).toContain('framework'); // hard fact: skipped
      expect(s.answered).not.toContain('database'); // guess: still asked
      expect(s.answers.database).toBe('postgresql'); // …but pre-selected
    }));

  it('does not even pre-fill conventions in partial mode', () =>
    inTempProject((dir) => {
      writeMonorepo(dir);
      const det = detectStack(dir);
      const { tier1 } = splitByTier(det.answers as Record<string, unknown>);

      let s = createSession();
      for (const [id, value] of Object.entries(tier1)) s = recordAnswer(s, id, value);
      // partial mode: tier2 is dropped, not seeded.

      expect(s.answered).toContain('framework');
      expect(s.answered).not.toContain('structure');
      expect('structure' in s.answers).toBe(false);
    }));

  it('never seeds UI-only facts for a backend project, and reconcile keeps it clean', () =>
    inTempProject((dir) => {
      // A backend API that happens to depend on a styling lib + a state lib.
      // Their questions are gated on hasUI, so detection must not seed them on a
      // backend project in the first place (no seed-then-drop round trip).
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({
          dependencies: {
            express: '4',
            tailwindcss: '3',
            '@tanstack/react-query': '5',
          },
        }),
      );
      writeFileSync(join(dir, 'package-lock.json'), '');

      const det = detectStack(dir);
      expect(det.answers.projectType).toBe('backend');
      // Gated out at the detector, not merely dropped later by reconcile.
      expect('stylingLibrary' in det.answers).toBe(false);
      expect('stateManagement' in det.answers).toBe(false);

      const { tier1 } = splitByTier(det.answers as Record<string, unknown>);
      let s = createSession();
      for (const [id, value] of Object.entries(tier1)) s = recordAnswer(s, id, value);
      s = reconcile(flow, s);

      // Still absent after apply + reconcile — no leak into generation.
      expect(s.answered).not.toContain('stylingLibrary');
      expect(s.answered).not.toContain('stateManagement');
      expect('stylingLibrary' in s.answers).toBe(false);
      expect('stateManagement' in s.answers).toBe(false);

      // The reachable backend facts stay.
      expect(s.answered).toContain('framework');
      expect(s.answered).toContain('language');
      expect(s.answered).toContain('packageManager');
    }));

  it('drops unknown ids — only classified ids are ever applied', () => {
    const { tier1, tier2 } = splitByTier({ framework: 'nextjs', mysteryField: 'x' });
    expect(tier1.framework).toBe('nextjs');
    expect('mysteryField' in tier1).toBe(false);
    expect('mysteryField' in tier2).toBe(false);
  });

  it('classifies tsconfig.* compiler flags as Tier-1', () => {
    const { tier1, tier2 } = splitByTier({ 'tsconfig.strict': true, structure: 'monorepo' });
    expect(tier1['tsconfig.strict']).toBe(true);
    expect(tier2.structure).toBe('monorepo');
  });
});
