import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectStack } from '../../src/detect/index';
import { isTier1, isTier2, splitByTier, TIER1, TIER2 } from '../../src/detect/tiers';

describe('tiers — classification', () => {
  it('has no id in both tiers', () => {
    for (const id of TIER1) expect(TIER2.has(id)).toBe(false);
  });

  it('treats structure as a Tier-2 convention (never auto-skipped)', () => {
    expect(isTier2('structure')).toBe(true);
    expect(isTier1('structure')).toBe(false);
  });

  it('treats tsconfig.* as Tier-1 by prefix', () => {
    expect(isTier1('tsconfig.strict')).toBe(true);
    expect(isTier1('tsconfig.target')).toBe(true);
  });

  it('classifies every id detectStack can emit into exactly one tier', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '15',
        react: '18',
        '@prisma/client': '5',
        pg: '8',
        zod: '3',
        'next-auth': '5',
        graphql: '16',
      },
      devDependencies: {
        typescript: '5',
        tailwindcss: '3',
        prettier: '3',
        eslint: '8',
        vitest: '1',
        '@playwright/test': '1',
      },
    });
    const dir = mkdtempSync(join(tmpdir(), 'payo-tiers-'));
    try {
      writeFileSync(join(dir, 'package.json'), pkg);
      writeFileSync(join(dir, 'tsconfig.json'), '{"compilerOptions":{"strict":true}}');
      writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
      writeFileSync(join(dir, 'turbo.json'), '{}');
      const det = detectStack(dir);
      for (const id of Object.keys(det.answers)) {
        const inExactlyOne = isTier1(id) !== isTier2(id);
        expect(inExactlyOne).toBe(true);
      }
      // structure (monorepo) was detected and lands in Tier-2.
      const { tier1, tier2 } = splitByTier(det.answers as Record<string, unknown>);
      expect('structure' in tier2).toBe(true);
      expect('structure' in tier1).toBe(false);
      expect('framework' in tier1).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
