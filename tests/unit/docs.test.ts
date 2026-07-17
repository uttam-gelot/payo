import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { docsExcerpt } from '../../src/detect/docs';

function withDocs<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-docs-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      const full = join(dir, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('docsExcerpt', () => {
  it('returns undefined when no documentation exists', () => {
    withDocs({}, (dir) => {
      expect(docsExcerpt(dir)).toBeUndefined();
    });
  });

  it('labels each file and keeps the priority order (README first)', () => {
    withDocs(
      {
        'CLAUDE.md': 'agent notes',
        'README.md': '# Proj\nRust backend, React frontend.',
      },
      (dir) => {
        const out = docsExcerpt(dir)!;
        expect(out.indexOf('### README.md')).toBeLessThan(out.indexOf('### CLAUDE.md'));
        expect(out).toContain('Rust backend');
      },
    );
  });

  it('includes docs/*.md, capped at three files, sorted', () => {
    withDocs(
      {
        'docs/a.md': 'alpha',
        'docs/b.md': 'bravo',
        'docs/c.md': 'charlie',
        'docs/d.md': 'delta',
        'docs/notes.txt': 'not markdown',
      },
      (dir) => {
        const out = docsExcerpt(dir)!;
        expect(out).toContain('### docs/a.md');
        expect(out).toContain('### docs/c.md');
        expect(out).not.toContain('docs/d.md');
        expect(out).not.toContain('notes.txt');
      },
    );
  });

  it('truncates a long file at the per-file cap and marks it', () => {
    withDocs({ 'README.md': 'x'.repeat(5000) }, (dir) => {
      const out = docsExcerpt(dir)!;
      expect(out).toContain('…(truncated)');
      expect(out.length).toBeLessThan(3300);
    });
  });

  it('respects the total budget across many files', () => {
    const big = 'y'.repeat(3000);
    withDocs(
      {
        'README.md': big,
        'CLAUDE.md': big,
        'AGENTS.md': big,
        'docs/a.md': big,
        'docs/b.md': big,
      },
      (dir) => {
        const out = docsExcerpt(dir)!;
        expect(out.length).toBeLessThan(11500);
      },
    );
  });

  it('skips empty files', () => {
    withDocs({ 'README.md': '  \n', 'AGENTS.md': 'real content' }, (dir) => {
      const out = docsExcerpt(dir)!;
      expect(out).not.toContain('### README.md');
      expect(out).toContain('### AGENTS.md');
    });
  });
});
