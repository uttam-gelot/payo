import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import {
  ormOptions,
  frameworkOptions,
  validationOptions,
  stateManagementOptions,
  packageManagerOptions,
  testTypeOptions,
  e2eToolOptions,
} from '../../src/questions/options';
import type { Option } from '../../src/questions/types';

const vals = (opts: Option<string>[]): string[] => opts.map((o) => o.value);
const recCount = (opts: Option<string>[]): number =>
  opts.filter((o) => o.hint === 'recommended').length;
const hintOf = (opts: Option<string>[], value: string): string | undefined =>
  opts.find((o) => o.value === value)?.hint;

describe('ormOptions', () => {
  it('TS + SQL: Prisma recommended, raw-sql tail', () => {
    const o = ormOptions({ language: 'typescript', database: 'postgresql' });
    expect(vals(o)).toContain('prisma');
    expect(vals(o)).toContain('raw-sql');
    expect(hintOf(o, 'prisma')).toBe('recommended');
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
  it('offers component tests only outside backend', () => {
    expect(vals(testTypeOptions({ projectType: 'frontend' }))).toContain('component');
    expect(vals(testTypeOptions({ projectType: 'backend' }))).not.toContain('component');
  });
});

describe('e2eToolOptions', () => {
  it('has no "None" — only surfaces after e2e is already chosen', () => {
    expect(vals(e2eToolOptions)).not.toContain('none');
  });
});
