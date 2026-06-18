import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import {
  ormOptions,
  loggerOptions,
  frameworkOptions,
  cliFrameworkOptions,
  validationOptions,
  stateManagementOptions,
  packageManagerOptions,
  testTypeOptions,
  e2eToolOptions,
  projectTypeOptions,
  hasUI,
  hasServer,
  isStandalone,
} from '../../src/questions/options';
import type { Option } from '../../src/questions/types';

const vals = (opts: Option<string>[]): string[] => opts.map((o) => o.value);
const recCount = (opts: Option<string>[]): number =>
  opts.filter((o) => o.hint === 'recommended').length;
const hintOf = (opts: Option<string>[], value: string): string | undefined =>
  opts.find((o) => o.value === value)?.hint;

describe('loggerOptions', () => {
  it('frontend: only a recommended centralized wrapper and none', () => {
    const o = loggerOptions({ projectType: 'frontend', language: 'typescript' });
    expect(vals(o)).toEqual(['centralized', 'none']);
    expect(hintOf(o, 'centralized')).toBe('recommended');
  });

  it('backend keeps the language-specific third-party loggers', () => {
    const o = loggerOptions({ projectType: 'backend', language: 'typescript' });
    expect(vals(o)).toContain('pino');
    expect(vals(o)).toContain('centralized');
  });
});

describe('ormOptions', () => {
  it('TS + SQL: TypeORM recommended (not Prisma), raw-sql tail', () => {
    const o = ormOptions({ language: 'typescript', database: 'postgresql' });
    expect(vals(o)).toContain('prisma');
    expect(vals(o)).toContain('raw-sql');
    expect(hintOf(o, 'typeorm')).toBe('recommended');
    expect(hintOf(o, 'prisma')).toBeUndefined();
  });

  it('TS + Mongo: native-driver tail, Mongoose recommended (not Prisma)', () => {
    const o = ormOptions({ language: 'typescript', database: 'mongodb' });
    expect(vals(o)).toContain('native-driver');
    expect(vals(o)).not.toContain('raw-sql');
    expect(hintOf(o, 'mongoose')).toBe('recommended');
    expect(hintOf(o, 'prisma')).toBeUndefined();
  });

  it('Python + SQL: SQLAlchemy is offered', () => {
    expect(vals(ormOptions({ language: 'python', database: 'postgresql' }))).toContain(
      'sqlalchemy',
    );
  });
});

describe('frameworkOptions', () => {
  it('exactly one recommended per primary context', () => {
    expect(recCount(frameworkOptions({ language: 'typescript', projectType: 'frontend' }))).toBe(1);
    expect(recCount(frameworkOptions({ language: 'typescript', projectType: 'full-stack' }))).toBe(
      1,
    );
    expect(recCount(frameworkOptions({ language: 'go', projectType: 'backend' }))).toBe(1);
  });

  it('frontend lists SPA libs; backend excludes them', () => {
    expect(vals(frameworkOptions({ language: 'typescript', projectType: 'frontend' }))).toContain(
      'react',
    );
    expect(
      vals(frameworkOptions({ language: 'typescript', projectType: 'backend' })),
    ).not.toContain('react');
  });

  it('CLI projects swap the web registry for arg-parsing libs, tailed by None', () => {
    const ts = frameworkOptions({ language: 'typescript', projectType: 'cli' });
    expect(vals(ts)).toContain('commander');
    expect(vals(ts)).not.toContain('react');
    const tsVals = vals(ts);
    expect(tsVals[tsVals.length - 1]).toBe('none');

    expect(vals(frameworkOptions({ language: 'python', projectType: 'cli' }))).toContain('typer');
    expect(vals(frameworkOptions({ language: 'go', projectType: 'cli' }))).toContain('cobra');
    expect(vals(frameworkOptions({ language: 'rust', projectType: 'cli' }))).toContain('clap');
  });
});

describe('cliFrameworkOptions', () => {
  it('recommends exactly one library per language', () => {
    expect(recCount(cliFrameworkOptions({ language: 'typescript' }))).toBe(1);
    expect(recCount(cliFrameworkOptions({ language: 'python' }))).toBe(1);
    expect(recCount(cliFrameworkOptions({ language: 'go' }))).toBe(1);
    expect(recCount(cliFrameworkOptions({ language: 'rust' }))).toBe(1);
  });
});

describe('projectTypeOptions', () => {
  it('includes the cli and script types', () => {
    expect(vals(projectTypeOptions)).toContain('cli');
    expect(vals(projectTypeOptions)).toContain('script');
  });
});

describe('project-type predicates', () => {
  it('classify UI / server / standalone shapes', () => {
    expect(hasUI({ projectType: 'frontend' })).toBe(true);
    expect(hasUI({ projectType: 'full-stack' })).toBe(true);
    expect(hasUI({ projectType: 'backend' })).toBe(false);
    expect(hasUI({ projectType: 'cli' })).toBe(false);

    expect(hasServer({ projectType: 'backend' })).toBe(true);
    expect(hasServer({ projectType: 'full-stack' })).toBe(true);
    expect(hasServer({ projectType: 'frontend' })).toBe(false);
    expect(hasServer({ projectType: 'script' })).toBe(false);

    expect(isStandalone({ projectType: 'cli' })).toBe(true);
    expect(isStandalone({ projectType: 'script' })).toBe(true);
    expect(isStandalone({ projectType: 'backend' })).toBe(false);
  });
});

describe('validationOptions', () => {
  it('TS defaults to Zod', () => {
    expect(hintOf(validationOptions({ language: 'typescript' }), 'zod')).toBe('recommended');
  });

  it('NestJS recommends class-validator instead of Zod', () => {
    const o = validationOptions({ language: 'typescript', framework: 'nestjs' });
    expect(hintOf(o, 'class-validator')).toBe('recommended');
    expect(hintOf(o, 'zod')).toBeUndefined();
  });
});

describe('stateManagementOptions', () => {
  it('is framework-aware', () => {
    expect(hintOf(stateManagementOptions({ framework: 'vue' }), 'pinia')).toBe('recommended');
    expect(hintOf(stateManagementOptions({ framework: 'angular' }), 'signals')).toBe('recommended');
    expect(hintOf(stateManagementOptions({ framework: 'react' }), 'zustand')).toBe('recommended');
  });
});

describe('packageManagerOptions', () => {
  it('is empty for Go / Rust (toolchain implied)', () => {
    expect(packageManagerOptions({ language: 'go' })).toHaveLength(0);
    expect(packageManagerOptions({ language: 'rust' })).toHaveLength(0);
  });

  it('recommends pnpm for TS', () => {
    expect(hintOf(packageManagerOptions({ language: 'typescript' }), 'pnpm')).toBe('recommended');
  });
});

describe('testTypeOptions', () => {
  it('offers component tests only for UI projects', () => {
    expect(vals(testTypeOptions({ projectType: 'frontend' }))).toContain('component');
    expect(vals(testTypeOptions({ projectType: 'backend' }))).not.toContain('component');
  });

  it('standalone cli / script get unit + integration only (no component, no e2e)', () => {
    expect(vals(testTypeOptions({ projectType: 'cli' }))).toEqual(['unit', 'integration']);
    expect(vals(testTypeOptions({ projectType: 'script' }))).toEqual(['unit', 'integration']);
  });
});

describe('e2eToolOptions', () => {
  it('has no "None" — only surfaces after e2e is already chosen', () => {
    expect(vals(e2eToolOptions)).not.toContain('none');
  });
});
