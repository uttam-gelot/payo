import { describe, it, expect } from 'bun:test';
import { getProvider, listProviders } from '../../src/providers/index';

describe('provider registry (universal output)', () => {
  it('every provider declares an id, display name, and detection artifacts', () => {
    const providers = listProviders();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(provider.id.length).toBeGreaterThan(0);
      expect(provider.displayName.length).toBeGreaterThan(0);
      expect(provider.knownArtifacts.length).toBeGreaterThan(0);
    }
  });

  it('CLI-backed providers expose a runner; static-only providers omit it', () => {
    // Providers no longer own output paths or frontmatter — output is universal.
    expect(getProvider('claude')?.agent?.binary).toBe('claude');
    expect(getProvider('codex')?.agent?.binary).toBe('codex');
    expect(getProvider('antigravity')?.agent?.binary).toBe('agy');
    // Windsurf and the generic fallback have no headless CLI.
    expect(getProvider('windsurf')?.agent).toBeUndefined();
    expect(getProvider('other')?.agent).toBeUndefined();
  });

  it('keeps knownArtifacts for detection, including legacy per-tool paths', () => {
    expect(getProvider('claude')?.knownArtifacts).toContain('CLAUDE.md');
    expect(getProvider('cursor')?.knownArtifacts).toContain('.cursorrules');
    expect(getProvider('antigravity')?.knownArtifacts).toContain('.agents/skills');
  });
});
