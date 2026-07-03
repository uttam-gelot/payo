import { describe, it, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { dirTree } from '../../src/detect/tree';

/** Build a throwaway dir from a {relpath: contents} map, run fn, clean up. */
function inTree<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-tree-'));
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

describe('dirTree', () => {
  it('returns project-relative paths, directories suffixed with /', () => {
    const tree = inTree({ 'src/app.ts': '', 'README.md': '' }, (d) => dirTree(d));
    expect(tree).toContain('README.md');
    expect(tree).toContain('src/');
    expect(tree).toContain('src/app.ts');
    // Never absolute.
    expect(tree.every((p) => !p.startsWith('/'))).toBe(true);
  });

  it('ignores vendored / generated directories', () => {
    const tree = inTree(
      {
        'node_modules/left-pad/index.js': '',
        'dist/bundle.js': '',
        'target/debug/app': '',
        '__pycache__/x.pyc': '',
        'src/main.ts': '',
      },
      (d) => dirTree(d),
    );
    expect(tree.some((p) => p.startsWith('node_modules'))).toBe(false);
    expect(tree.some((p) => p.startsWith('dist'))).toBe(false);
    expect(tree.some((p) => p.startsWith('target'))).toBe(false);
    expect(tree.some((p) => p.startsWith('__pycache__'))).toBe(false);
    expect(tree).toContain('src/main.ts');
  });

  it('skips only .git itself — .github and .gitignore are stack signal', () => {
    const tree = inTree(
      {
        '.git/HEAD': 'ref: refs/heads/main',
        '.github/workflows/ci.yml': '',
        '.gitignore': 'node_modules',
        'app.ts': '',
      },
      (d) => dirTree(d),
    );
    expect(tree.some((p) => p.startsWith('.git/'))).toBe(false);
    expect(tree).toContain('.github/');
    expect(tree).toContain('.github/workflows/ci.yml');
    expect(tree).toContain('.gitignore');
    expect(tree).toContain('app.ts');
  });

  it('respects maxDepth — nested entries beyond the cap are omitted', () => {
    const tree = inTree({ 'sub/deep.txt': '', 'top.txt': '' }, (d) => dirTree(d, { maxDepth: 1 }));
    expect(tree).toContain('top.txt');
    expect(tree).toContain('sub/');
    expect(tree).not.toContain('sub/deep.txt');
  });

  it('respects maxEntries — total paths are capped', () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 50; i++) files[`f${i}.txt`] = '';
    const tree = inTree(files, (d) => dirTree(d, { maxEntries: 10 }));
    expect(tree.length).toBeLessThanOrEqual(10);
  });

  it('is deterministic — entries are sorted', () => {
    const tree = inTree({ 'b.txt': '', 'a.txt': '', 'c.txt': '' }, (d) => dirTree(d));
    const idx = (n: string) => tree.indexOf(n);
    expect(idx('a.txt')).toBeLessThan(idx('b.txt'));
    expect(idx('b.txt')).toBeLessThan(idx('c.txt'));
  });

  it('never reads file contents — only paths appear', () => {
    const secret = 'TOPSECRET_TOKEN_DO_NOT_LEAK';
    const tree = inTree({ 'config.ts': `const k="${secret}"`, 'app.ts': '' }, (d) => dirTree(d));
    expect(tree).toContain('config.ts');
    expect(tree.join('\n')).not.toContain(secret);
  });
});
