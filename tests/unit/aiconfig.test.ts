import { describe, it, expect } from 'bun:test';
import '../../src/providers/index'; // populate the provider registry
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanExistingAiConfigs, detectAiTool } from '../../src/detect/aiconfig';

/** Build a throwaway dir from a list of files/dirs (trailing `/` = dir), run fn. */
function inProject<T>(entries: string[], fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-aiconfig-'));
  try {
    for (const entry of entries) {
      const full = join(dir, entry);
      if (entry.endsWith('/')) {
        mkdirSync(full, { recursive: true });
      } else {
        mkdirSync(join(full, '..'), { recursive: true });
        writeFileSync(full, '');
      }
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('scanExistingAiConfigs', () => {
  it('finds artifacts across every tool, deduped', () => {
    const found = inProject(['CLAUDE.md', '.cursorrules', 'AGENTS.md'], (d) =>
      scanExistingAiConfigs(d),
    );
    expect(found.sort()).toEqual(['.cursorrules', 'AGENTS.md', 'CLAUDE.md']);
  });

  it('returns nothing for a project with no AI config', () => {
    expect(inProject(['package.json'], (d) => scanExistingAiConfigs(d))).toEqual([]);
  });

  it('detects a config directory, not just a file', () => {
    const found = inProject(['.claude/skills/'], (d) => scanExistingAiConfigs(d));
    expect(found).toContain('.claude/skills');
  });
});

describe('detectAiTool', () => {
  it('maps CLAUDE.md → claude', () => {
    expect(inProject(['CLAUDE.md'], (d) => detectAiTool(d))).toBe('claude');
  });

  it('maps .cursorrules → cursor', () => {
    expect(inProject(['.cursorrules'], (d) => detectAiTool(d))).toBe('cursor');
  });

  it('maps a bare AGENTS.md → codex (shared path, registration order)', () => {
    expect(inProject(['AGENTS.md'], (d) => detectAiTool(d))).toBe('codex');
  });

  it('maps .agents/skills/ → antigravity (unique path beats shared AGENTS.md)', () => {
    expect(inProject(['AGENTS.md', '.agents/skills/'], (d) => detectAiTool(d))).toBe('antigravity');
  });

  it('returns undefined when no AI config is present', () => {
    expect(inProject(['package.json'], (d) => detectAiTool(d))).toBeUndefined();
  });
});
