import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry (frameworkOptions reads it)
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectStack } from '../../src/detect/index';
import { optionValuesFor, hasVocab } from '../../src/detect/optionVocab';
import type { Answers } from '../../src/questions/types';

/** Build a throwaway project dir from a {filename: contents} map, run fn, clean up. */
function inProject<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-detect-'));
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

/**
 * Assert that each detected value still exists in its question's option list,
 * using the same vocab oracle Stage-2 validation reads from (so the two agree).
 */
function assertWithinOptions(a: Answers): void {
  for (const [id, value] of Object.entries(a)) {
    if (!hasVocab(id)) continue; // tsconfig.* and other non-enumerable ids
    const allowed = optionValuesFor(id, a);
    if (Array.isArray(value)) {
      for (const v of value as string[]) expect(allowed).toContain(v);
    } else if (typeof value === 'string') {
      expect(allowed).toContain(value);
    }
  }
}

describe('detectStack — Node', () => {
  it('detects a Next.js + Prisma + Tailwind app with pnpm', () => {
    const pkg = JSON.stringify({
      dependencies: {
        next: '15.0.0',
        react: '18',
        '@prisma/client': '5',
        pg: '8',
        zod: '3',
        'next-auth': '5',
        '@apollo/server': '4',
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
    const tsconfig = JSON.stringify({
      // a real tsconfig — comments and trailing commas must not break parsing
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        moduleResolution: 'bundler',
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }).replace('}}', '},}'); // inject a trailing comma
    const det = inProject(
      {
        'package.json': pkg,
        'tsconfig.json': `// project config\n${tsconfig}`,
        'pnpm-lock.yaml': '',
        'turbo.json': '{}',
      },
      (dir) => detectStack(dir),
    );
    expect(det.answers).toMatchObject({
      language: 'typescript',
      projectType: 'full-stack',
      framework: 'nextjs',
      packageManager: 'pnpm',
      runtime: 'node',
      database: 'postgresql',
      orm: 'prisma',
      stylingLibrary: 'tailwind',
      validation: 'zod',
      formatter: 'prettier',
      linter: 'eslint',
      testRunner: 'vitest',
      // Tier 2
      apiArchitecture: 'graphql',
      authApproach: 'authjs',
      structure: 'monorepo',
      e2eTool: 'playwright',
      testTypes: ['unit', 'integration', 'e2e'],
      'tsconfig.strict': true,
      'tsconfig.target': 'ES2022',
      'tsconfig.module-resolution': 'bundler',
      'tsconfig.path-aliases': true,
    });
    assertWithinOptions(det.answers);
  });

  it('classifies a plain React app as frontend, no DB', () => {
    const pkg = JSON.stringify({ dependencies: { react: '18', 'react-dom': '18' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.framework).toBe('react');
    expect(det.answers.projectType).toBe('frontend');
    expect('database' in det.answers).toBe(false);
  });

  it('classifies an Express API as backend', () => {
    const pkg = JSON.stringify({ dependencies: { express: '4', mysql2: '3', sequelize: '6' } });
    const det = inProject({ 'package.json': pkg, 'package-lock.json': '' }, (dir) =>
      detectStack(dir),
    );
    expect(det.answers).toMatchObject({
      framework: 'express',
      projectType: 'backend',
      packageManager: 'npm',
      database: 'mysql',
      orm: 'sequelize',
    });
  });

  it('does not record UI-only facts (styling/state) on a backend project', () => {
    const pkg = JSON.stringify({
      dependencies: { express: '4', tailwindcss: '3', '@tanstack/react-query': '5' },
    });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.projectType).toBe('backend');
    expect('stylingLibrary' in det.answers).toBe(false);
    expect('stateManagement' in det.answers).toBe(false);
    assertWithinOptions(det.answers);
  });

  it('does not record a library logger for a frontend app (out-of-vocab guard)', () => {
    // A frontend's logger question only offers centralized/none, so pino must
    // not be recorded — it is not a valid option there.
    const pkg = JSON.stringify({ dependencies: { react: '18', pino: '9' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.projectType).toBe('frontend');
    expect('logger' in det.answers).toBe(false);
    assertWithinOptions(det.answers);
  });

  it('does not treat a cache-only redis dependency as the database', () => {
    const pkg = JSON.stringify({ dependencies: { express: '4', ioredis: '5' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.projectType).toBe('backend');
    expect('database' in det.answers).toBe(false);
  });

  it('does not infer apiArchitecture from a bare transitive graphql dependency', () => {
    const pkg = JSON.stringify({ dependencies: { express: '4', graphql: '16' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect('apiArchitecture' in det.answers).toBe(false);
  });

  it('classifies a bin-declaring package as a CLI', () => {
    const pkg = JSON.stringify({ bin: { mycli: 'index.js' }, dependencies: { commander: '12' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.projectType).toBe('cli');
  });

  it('detects prettier from a package.json "prettier" key (no dep, no dotfile)', () => {
    const pkg = JSON.stringify({ dependencies: { react: '18' }, prettier: { semi: false } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.formatter).toBe('prettier');
  });

  it('detects prettier from a modern config variant (prettier.config.mjs)', () => {
    const pkg = JSON.stringify({ dependencies: { react: '18' } });
    const det = inProject(
      { 'package.json': pkg, 'prettier.config.mjs': 'export default {}' },
      (dir) => detectStack(dir),
    );
    expect(det.answers.formatter).toBe('prettier');
  });

  it('detects biome from biome.jsonc as both formatter and linter', () => {
    const pkg = JSON.stringify({ dependencies: { react: '18' } });
    const det = inProject({ 'package.json': pkg, 'biome.jsonc': '{}' }, (dir) => detectStack(dir));
    expect(det.answers.formatter).toBe('biome');
    expect(det.answers.linter).toBe('biome');
  });

  it('detects the CLI framework value from the arg-parser dep', () => {
    const pkg = JSON.stringify({ bin: { mycli: 'index.js' }, dependencies: { commander: '12' } });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers.projectType).toBe('cli');
    expect(det.answers.framework).toBe('commander');
    assertWithinOptions(det.answers);
  });

  it('recovers the DB from schema.prisma so a driverless Prisma ORM survives', () => {
    // Prisma + SQLite: no DB driver dep at all, only schema.prisma. The engine
    // must come from the datasource provider, and the ORM must not be dropped.
    const pkg = JSON.stringify({ dependencies: { express: '4', '@prisma/client': '5' } });
    const schema =
      'generator client {\n  provider = "prisma-client-js"\n}\n' +
      'datasource db {\n  provider = "sqlite"\n  url = env("DATABASE_URL")\n}\n';
    const det = inProject({ 'package.json': pkg, 'prisma/schema.prisma': schema }, (dir) =>
      detectStack(dir),
    );
    expect(det.answers.database).toBe('sqlite');
    expect(det.answers.orm).toBe('prisma');
    assertWithinOptions(det.answers);
  });

  it('reads a root-level schema.prisma postgres provider', () => {
    const pkg = JSON.stringify({ dependencies: { express: '4', '@prisma/client': '5' } });
    const schema = 'datasource db {\n  provider = "postgresql"\n}\n';
    const det = inProject({ 'package.json': pkg, 'schema.prisma': schema }, (dir) =>
      detectStack(dir),
    );
    expect(det.answers.database).toBe('postgresql');
    expect(det.answers.orm).toBe('prisma');
  });
});

describe('detectStack — Python', () => {
  it('detects a FastAPI project from pyproject.toml', () => {
    const pyproject = [
      '[project]',
      'name = "svc"',
      'dependencies = [',
      '  "fastapi>=0.110",',
      '  "sqlalchemy>=2.0",',
      '  "asyncpg",',
      '  "pydantic>=2",',
      '  "structlog",',
      ']',
    ].join('\n');
    const det = inProject({ 'pyproject.toml': pyproject, 'uv.lock': '' }, (dir) =>
      detectStack(dir),
    );
    expect(det.answers).toMatchObject({
      language: 'python',
      projectType: 'backend',
      framework: 'fastapi',
      packageManager: 'uv',
      database: 'postgresql',
      orm: 'sqlalchemy',
      validation: 'pydantic',
      logger: 'structlog',
    });
    assertWithinOptions(det.answers);
  });

  it('reads requirements.txt and maps Django to its ORM', () => {
    const reqs = 'Django>=5.0\npsycopg2-binary==2.9\npytest\n';
    const det = inProject({ 'requirements.txt': reqs }, (dir) => detectStack(dir));
    expect(det.answers).toMatchObject({
      language: 'python',
      framework: 'django',
      orm: 'django-orm',
      database: 'postgresql',
      packageManager: 'pip-venv',
      testRunner: 'pytest',
    });
    assertWithinOptions(det.answers);
  });
});

describe('detectStack — Go', () => {
  it('detects a Gin + GORM backend from go.mod', () => {
    const gomod = [
      'module example.com/app',
      'go 1.22',
      'require (',
      '  github.com/gin-gonic/gin v1.9.1',
      '  gorm.io/gorm v1.25.0',
      '  github.com/jackc/pgx/v5 v5.5.0',
      ')',
    ].join('\n');
    const det = inProject({ 'go.mod': gomod }, (dir) => detectStack(dir));
    expect(det.answers).toMatchObject({
      language: 'go',
      projectType: 'backend',
      framework: 'gin',
      orm: 'gorm',
      database: 'postgresql',
      formatter: 'gofmt',
      testRunner: 'go-test',
    });
    assertWithinOptions(det.answers);
  });

  it('detects SQLite via a driver so GORM is not dropped', () => {
    const gomod = [
      'module example.com/app',
      'go 1.22',
      'require (',
      '  gorm.io/gorm v1.25.0',
      '  github.com/mattn/go-sqlite3 v1.14.0',
      ')',
    ].join('\n');
    const det = inProject({ 'go.mod': gomod }, (dir) => detectStack(dir));
    expect(det.answers.database).toBe('sqlite');
    expect(det.answers.orm).toBe('gorm');
    assertWithinOptions(det.answers);
  });

  it('detects golangci-lint from a .golangci.yml config file', () => {
    const gomod = ['module example.com/app', 'go 1.22'].join('\n');
    const det = inProject({ 'go.mod': gomod, '.golangci.yml': 'linters:\n  enable: [gofmt]' }, (dir) =>
      detectStack(dir),
    );
    expect(det.answers.linter).toBe('golangci-lint');
    assertWithinOptions(det.answers);
  });
});

describe('detectStack — Rust', () => {
  it('detects an Axum + SQLx backend from Cargo.toml', () => {
    const cargo = [
      '[package]',
      'name = "app"',
      '[dependencies]',
      'axum = "0.7"',
      'sqlx = { version = "0.7", features = ["postgres"] }',
      'validator = "0.16"',
      'tracing = "0.1"',
    ].join('\n');
    const det = inProject({ 'Cargo.toml': cargo }, (dir) => detectStack(dir));
    expect(det.answers).toMatchObject({
      language: 'rust',
      projectType: 'backend',
      framework: 'axum',
      orm: 'sqlx-rust',
      database: 'postgresql',
      validation: 'validator',
      logger: 'tracing',
      formatter: 'rustfmt',
      linter: 'clippy',
      testRunner: 'cargo-test',
    });
    assertWithinOptions(det.answers);
  });

  it('reads the SQLx engine from its own feature list, ignoring unrelated mentions', () => {
    const cargo = [
      '[package]',
      'name = "app"',
      '# we migrated off sqlite long ago',
      'sqlite-cache = "1.0"', // a crate that merely contains the word sqlite
      '[dependencies]',
      'axum = "0.7"',
      'sqlx = { version = "0.7", features = ["runtime-tokio", "postgres"] }',
    ].join('\n');
    const det = inProject({ 'Cargo.toml': cargo }, (dir) => detectStack(dir));
    expect(det.answers.database).toBe('postgresql');
    assertWithinOptions(det.answers);
  });

  it('detects a plain driver crate without an ORM feature', () => {
    const cargo = [
      '[package]',
      'name = "app"',
      '[dependencies]',
      'axum = "0.7"',
      'tokio-postgres = "0.7"',
    ].join('\n');
    const det = inProject({ 'Cargo.toml': cargo }, (dir) => detectStack(dir));
    expect(det.answers.database).toBe('postgresql');
    assertWithinOptions(det.answers);
  });
});

describe('detectStack — greenfield / tie-break', () => {
  it('returns an empty result when no manifest exists', () => {
    const det = inProject({ 'README.md': '# hi' }, (dir) => detectStack(dir));
    expect(det.answers).toEqual({});
    expect(det.sources).toEqual({});
  });

  it('never throws when a manifest makes a detector blow up', () => {
    // `engines` as a string makes detectNode hit `'bun' in engines` on a
    // non-object (a TypeError). detectStack must swallow it, not crash.
    const pkg = JSON.stringify({ dependencies: { next: '15' }, engines: 'oops' });
    const det = inProject({ 'package.json': pkg }, (dir) => detectStack(dir));
    expect(det.answers).toEqual({});
    expect(det.sources).toEqual({});
  });

  it('prefers the ecosystem that yielded a framework', () => {
    // A go.mod with a framework should win over a package.json with none.
    const pkg = JSON.stringify({ dependencies: { lodash: '4' } });
    const gomod = 'module x\ngo 1.22\nrequire github.com/gin-gonic/gin v1.9.1\n';
    const det = inProject({ 'package.json': pkg, 'go.mod': gomod }, (dir) => detectStack(dir));
    expect(det.answers.language).toBe('go');
    expect(det.answers.framework).toBe('gin');
  });
});
