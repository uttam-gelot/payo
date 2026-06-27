import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { writeFileSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { detectStack } from '../../src/detect/index';
import { splitByTier } from '../../src/detect/tiers';
import { createSession, recordAnswer, seedDetected, loadSession } from '../../src/state/index';

/**
 * End-to-end apply policy (mirrors src/cli/index.ts): Tier-1 stack facts are
 * recorded (and so skipped by the flow); Tier-2 conventions are only pre-filled
 * in "everything" mode and are NEVER marked answered. This is the regression
 * guard for the original bug where `structure` (monorepo) was auto-skipped.
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
  it('records Tier-1 facts but never records the Tier-2 structure (everything mode)', () =>
    inTempProject((dir) => {
      writeMonorepo(dir);
      const det = detectStack(dir);
      const { tier1, tier2 } = splitByTier(det.answers as Record<string, unknown>);

      let s = createSession();
      for (const [id, value] of Object.entries(tier1)) s = recordAnswer(s, id, value);
      s = seedDetected(s, tier2); // everything mode pre-fills conventions

      // Tier-1 facts are answered (and therefore skipped by runFlow).
      expect(s.answered).toContain('framework');
      expect(s.answered).toContain('database');
      expect(s.answered).toContain('formatter');

      // `structure` was detected as monorepo...
      expect(det.answers.structure).toBe('monorepo');
      // ...but it is seeded (pre-filled), never recorded — the question still gets asked.
      expect(s.answered).not.toContain('structure');
      expect(s.answers.structure).toBe('monorepo');

      // Persisted state agrees.
      const loaded = loadSession();
      expect(loaded?.answered).not.toContain('structure');
      expect(loaded?.answers.structure).toBe('monorepo');
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
