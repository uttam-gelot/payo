/**
 * Zed instruction-file precedence. Zed reads only the first matching file from a
 * fixed chain, and AGENTS.md is 7th — so these warnings are the only thing telling
 * a user that everything Payo generated is being ignored.
 */
import { describe, it, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ZED_SHADOWS_AGENTS, zedShadowWarnings } from '../../src/generator/zed';
import { inTempProject } from '../helpers/tmpProject';

describe('ZED_SHADOWS_AGENTS', () => {
  it('lists only files Zed prefers over AGENTS.md', () => {
    // AGENTS.md itself and everything below it in the chain lose to it.
    for (const lower of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) {
      expect(ZED_SHADOWS_AGENTS).not.toContain(lower);
    }
    expect(ZED_SHADOWS_AGENTS[0]).toBe('.rules'); // Zed's top priority
  });
});

describe('zedShadowWarnings', () => {
  it('warns once per shadowing file present, in precedence order', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, 'AGENT.md'), 'x', 'utf-8');
      writeFileSync(join(dir, '.cursorrules'), 'x', 'utf-8');
      // Not a shadow — AGENTS.md is what Payo wrote and what should win.
      writeFileSync(join(dir, 'AGENTS.md'), 'x', 'utf-8');

      const warnings = zedShadowWarnings(['zed']);
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toStartWith('.cursorrules —'); // precedence order, not disk order
      expect(warnings[1]).toStartWith('AGENT.md —');
      expect(warnings[0]).toContain('AGENTS.md');
    });
  });

  it('finds a nested shadowing file', async () => {
    await inTempProject((dir) => {
      mkdirSync(join(dir, '.github'), { recursive: true });
      writeFileSync(join(dir, '.github/copilot-instructions.md'), 'x', 'utf-8');
      expect(zedShadowWarnings(['zed'])).toHaveLength(1);
    });
  });

  it('is silent when Zed is not a supported tool', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, '.cursorrules'), 'x', 'utf-8');
      expect(zedShadowWarnings(['cursor', 'claude'])).toEqual([]);
      // Undefined ⇒ the support question was never answered; no Zed advice applies.
      expect(zedShadowWarnings()).toEqual([]);
    });
  });

  it('is silent when nothing shadows AGENTS.md', async () => {
    await inTempProject((dir) => {
      writeFileSync(join(dir, 'AGENTS.md'), 'x', 'utf-8');
      expect(zedShadowWarnings(['zed'])).toEqual([]);
    });
  });
});
