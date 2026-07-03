import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { cargoDeps, requirementsDeps, readJsonc } from '../../src/detect/manifest';

/** Write one throwaway file, run fn on its dir, clean up. */
function withFile<T>(name: string, body: string, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-manifest-'));
  try {
    writeFileSync(join(dir, name), body);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('requirementsDeps — PEP 503 normalization', () => {
  it('collapses -_. runs to hyphens and lower-cases, matching the signal tables', () => {
    const deps = requirementsDeps(
      ['psycopg2_binary==2.9', 'Django>=5.0', 'tortoise.orm', 'fastapi[all]'].join('\n'),
    );
    expect(deps.has('psycopg2-binary')).toBe(true);
    expect(deps.has('django')).toBe(true);
    expect(deps.has('tortoise-orm')).toBe(true);
    expect(deps.has('fastapi')).toBe(true);
  });
});

describe('cargoDeps', () => {
  it('captures inline entries in all three dependency tables', () => {
    const deps = cargoDeps(
      [
        '[dependencies]',
        'axum = "0.7"',
        '[dev-dependencies]',
        'insta = "1"',
        '[build-dependencies]',
        'cc = "1"',
        '[package]',
        'name = "not-a-dep"',
      ].join('\n'),
    );
    expect(deps.has('axum')).toBe(true);
    expect(deps.has('insta')).toBe(true);
    expect(deps.has('cc')).toBe(true);
    expect(deps.has('name')).toBe(false);
  });

  it('captures per-crate sub-tables like [dependencies.tokio]', () => {
    const deps = cargoDeps(
      [
        '[dependencies]',
        'serde = "1"',
        '[dependencies.tokio]',
        'version = "1"',
        'features = ["full"]',
        '[dependencies.sqlx]',
        'version = "0.8"',
      ].join('\n'),
    );
    expect(deps.has('serde')).toBe(true);
    expect(deps.has('tokio')).toBe(true);
    expect(deps.has('sqlx')).toBe(true);
    // Sub-table keys (version/features) are not crates.
    expect(deps.has('version')).toBe(false);
    expect(deps.has('features')).toBe(false);
  });

  it('captures workspace and target-scoped dependency tables', () => {
    const deps = cargoDeps(
      [
        '[workspace.dependencies]',
        'tracing = "0.1"',
        `[target.'cfg(unix)'.dependencies]`,
        'nix = "0.29"',
        "[target.'cfg(unix)'.dependencies.libc]",
        'version = "0.2"',
      ].join('\n'),
    );
    expect(deps.has('tracing')).toBe(true);
    expect(deps.has('nix')).toBe(true);
    expect(deps.has('libc')).toBe(true);
  });
});

describe('readJsonc', () => {
  it('strips comments and trailing commas outside strings', () => {
    const body = [
      '{',
      '  // compiler options',
      '  "compilerOptions": {',
      '    /* block */ "strict": true,',
      '  },',
      '}',
    ].join('\n');
    const parsed = withFile('tsconfig.json', body, (d) => readJsonc(d, 'tsconfig.json'));
    expect(parsed).toEqual({ compilerOptions: { strict: true } });
  });

  it('leaves // and ,] sequences inside string values intact', () => {
    const body = [
      '{',
      '  "outDir": "dist//weird", // real comment',
      '  "note": "a, ] b /* not a comment */ c"',
      '}',
    ].join('\n');
    const parsed = withFile('tsconfig.json', body, (d) => readJsonc(d, 'tsconfig.json'));
    expect(parsed).toEqual({
      outDir: 'dist//weird',
      note: 'a, ] b /* not a comment */ c',
    });
  });

  it('handles escaped quotes inside strings', () => {
    const body = '{ "s": "he said \\"hi\\" // still string", }';
    const parsed = withFile('t.json', body, (d) => readJsonc(d, 't.json'));
    expect(parsed).toEqual({ s: 'he said "hi" // still string' });
  });
});
