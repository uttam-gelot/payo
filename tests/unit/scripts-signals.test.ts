import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { scriptSignals } from '../../src/detect/scripts';

function withPkg<T>(scripts: Record<string, string>, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-scripts-'));
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts }));
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('scriptSignals', () => {
  it('detects cargo/go/python tooling as language hints', () => {
    withPkg(
      {
        backend: 'cargo build --workspace',
        svc: 'go test ./...',
        api: 'uv run uvicorn app:app',
      },
      (dir) => {
        const s = scriptSignals(dir);
        expect([...s.languages].sort()).toEqual(['go', 'python', 'rust']);
      },
    );
  });

  it('detects bun and deno as runtime hints', () => {
    withPkg({ dev: 'bun --watch src/index.ts', lint: 'deno task lint' }, (dir) => {
      const s = scriptSignals(dir);
      expect([...s.runtimes].sort()).toEqual(['bun', 'deno']);
    });
  });

  it('detects playwright/cypress as e2e tools', () => {
    withPkg({ e2e: 'playwright test' }, (dir) => {
      expect(scriptSignals(dir).e2e).toBe('playwright');
    });
    withPkg({ e2e: 'cypress run' }, (dir) => {
      expect(scriptSignals(dir).e2e).toBe('cypress');
    });
  });

  it('marks vitest-driven e2e only for a dedicated e2e config', () => {
    withPkg({ 'test:e2e': 'vitest run --config vitest.config.e2e.ts' }, (dir) => {
      expect(scriptSignals(dir).e2e).toBe('vitest');
    });
    withPkg({ test: 'vitest run' }, (dir) => {
      expect(scriptSignals(dir).e2e).toBeUndefined();
    });
  });

  it('does not fire on substrings or unrelated words', () => {
    withPkg(
      {
        docs: 'node scripts/cargo-cult-detector.js', // 'cargo' inside a word
        fetch: 'node download-bundle.js', // no runtime hint
      },
      (dir) => {
        const s = scriptSignals(dir);
        expect(s.languages.size).toBe(0);
        expect(s.runtimes.size).toBe(0);
        expect(s.e2e).toBeUndefined();
      },
    );
  });

  it('returns empty signals when there is no package.json or no scripts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'payo-scripts-'));
    try {
      const s = scriptSignals(dir);
      expect(s.languages.size).toBe(0);
      expect(s.runtimes.size).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
