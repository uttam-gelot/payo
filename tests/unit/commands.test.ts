import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { resolveCommands } from '../../src/generator/commands';
import type { Answers } from '../../src/questions/types';

const cmds = (a: Answers) => resolveCommands(a);

describe('resolveCommands', () => {
  it('prefixes JS generators with the chosen package manager', () => {
    expect(cmds({ framework: 'nextjs', packageManager: 'pnpm' }).scaffold).toBe(
      'pnpm create next-app',
    );
    expect(cmds({ framework: 'nextjs', packageManager: 'npm' }).scaffold).toBe(
      'npm create next-app@latest',
    );
    expect(cmds({ framework: 'nextjs', packageManager: 'bun' }).scaffold).toBe(
      'bun create next-app',
    );
  });

  it('defaults to the npm form when no package manager is set', () => {
    expect(cmds({ framework: 'nextjs' }).scaffold).toBe('npm create next-app@latest');
  });

  it('passes generator args (Vite React template)', () => {
    expect(cmds({ framework: 'react', packageManager: 'bun' }).scaffold).toBe(
      'bun create vite -- --template react-ts',
    );
    expect(cmds({ framework: 'react', packageManager: 'npm' }).scaffold).toBe(
      'npm create vite@latest -- --template react-ts',
    );
  });

  it('resolves dev / test / build for a JS stack', () => {
    const c = cmds({ framework: 'nextjs', packageManager: 'pnpm', testTypes: ['unit'] });
    expect(c.dev).toBe('pnpm dev');
    expect(c.test).toBe('pnpm test');
    expect(c.build).toBe('pnpm build');
  });

  it('returns the fixed commands for Rust / Go / Python stacks', () => {
    const rust = cmds({ framework: 'axum', testTypes: ['unit'] });
    expect(rust.scaffold).toBe('cargo new <app>');
    expect(rust.test).toBe('cargo test');
    expect(rust.build).toBe('cargo build --release');

    const go = cmds({ framework: 'gin', testTypes: ['unit'] });
    expect(go.scaffold).toBe('go mod init <module>');
    expect(go.test).toBe('go test ./...');

    const py = cmds({ framework: 'django', testTypes: ['unit'] });
    expect(py.scaffold).toBe('django-admin startproject <app>');
    expect(py.test).toBe('python manage.py test');
    expect(py.build).toBeUndefined();
  });

  it('omits the test command when testing was skipped', () => {
    // No testTypes / runner at all.
    expect(cmds({ framework: 'nextjs', packageManager: 'pnpm' }).test).toBeUndefined();
    // Explicitly declined.
    expect(cmds({ framework: 'axum', testTypes: [], testRunner: 'none' }).test).toBeUndefined();
    // A real runner alone is enough to count as selected.
    expect(cmds({ framework: 'nextjs', packageManager: 'pnpm', testRunner: 'vitest' }).test).toBe(
      'pnpm test',
    );
  });

  it('returns the fixed CLI command for NestJS (no pm prefix)', () => {
    const c = cmds({ framework: 'nestjs', packageManager: 'pnpm' });
    expect(c.scaffold).toBe('npx @nestjs/cli new <app>');
    expect(c.dev).toBe('pnpm start:dev');
  });

  it('omits scaffold for micro-frameworks with no generator, and is empty when unset', () => {
    expect(cmds({ framework: 'express' }).scaffold).toBeUndefined();
    expect(cmds({ framework: 'fastapi' }).scaffold).toBeUndefined();
    expect(cmds({ framework: 'fastapi', testTypes: ['unit'] }).test).toBe('pytest');
    expect(cmds({ language: 'typescript' })).toEqual({});
  });

  it('resolves the migrate command from the selected ORM', () => {
    expect(cmds({ orm: 'prisma', 'prisma.migrations': 'migrate' }).migrate).toBe(
      'prisma migrate dev',
    );
    expect(cmds({ orm: 'prisma', 'prisma.migrations': 'db-push' }).migrate).toBe('prisma db push');
    expect(cmds({ orm: 'drizzle' }).migrate).toBe('drizzle-kit generate && drizzle-kit migrate');
    expect(cmds({ orm: 'drizzle', 'drizzle.migrations': 'push' }).migrate).toBe('drizzle-kit push');
    expect(cmds({ orm: 'sqlalchemy', 'sqlalchemy.migrations': 'alembic' }).migrate).toBe(
      'alembic upgrade head',
    );
  });

  it('omits migrate when the ORM syncs the schema in-process or has no command', () => {
    expect(cmds({ orm: 'typeorm', 'typeorm.migrations': 'synchronize' }).migrate).toBeUndefined();
    expect(cmds({ orm: 'sqlalchemy', 'sqlalchemy.migrations': 'none' }).migrate).toBeUndefined();
    expect(cmds({ orm: 'prisma', 'prisma.migrations': 'manual' }).migrate).toBeUndefined();
    expect(cmds({ framework: 'nextjs' }).migrate).toBeUndefined();
  });
});
