/**
 * Dependency-name → answer-value lookup tables, one set per ecosystem. The
 * values here are the literal option `value`s from src/questions/options.ts and
 * the framework/orm module ids — a unit test cross-checks that every value
 * below still exists in its question's option list, so the two never drift.
 *
 * Each table is an ordered `[dependency, value]` list checked first-match-wins,
 * so more specific signals (meta-frameworks, ODMs) must precede the generic
 * ones they build on (e.g. `next` before `react`, `mongoose` before `mongodb`).
 */

/** First value whose dependency name is present in `deps`, or undefined. */
export function firstMatch(
  deps: Set<string>,
  table: readonly (readonly [string, string])[],
): string | undefined {
  for (const [dep, value] of table) {
    if (deps.has(dep)) return value;
  }
  return undefined;
}

/**
 * First value whose key is a path-prefix of any entry in `mods`. Go module
 * paths carry a major-version suffix (`.../chi/v5`), so exact match misses;
 * prefix match catches them.
 */
export function firstPrefixMatch(
  mods: string[],
  table: readonly (readonly [string, string])[],
): string | undefined {
  for (const [prefix, value] of table) {
    if (mods.some((m) => m === prefix || m.startsWith(prefix + '/'))) return value;
  }
  return undefined;
}

// --- Node / TypeScript / JavaScript -----------------------------------------

export const NODE_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['@sveltejs/kit', 'sveltekit'],
  ['nuxt', 'nuxtjs'],
  ['next', 'nextjs'],
  ['@remix-run/react', 'remix'],
  ['@remix-run/node', 'remix'],
  ['astro', 'astro'],
  ['@nestjs/core', 'nestjs'],
  ['@angular/core', 'angular'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
  ['solid-js', 'solid'],
  ['react', 'react'],
  ['fastify', 'fastify'],
  ['express', 'express'],
  ['hono', 'hono'],
];

/** UI-bearing frameworks → project has a frontend. */
export const NODE_UI_FRAMEWORKS = new Set([
  'sveltekit',
  'nuxtjs',
  'nextjs',
  'remix',
  'astro',
  'angular',
  'vue',
  'svelte',
  'solid',
  'react',
]);

/** Server-only frameworks → project has a backend (no UI). */
export const NODE_SERVER_FRAMEWORKS = new Set(['nestjs', 'fastify', 'express', 'hono']);

/** Meta-frameworks that ship their own server → treat as full-stack. */
export const NODE_FULLSTACK_FRAMEWORKS = new Set(['nextjs', 'nuxtjs', 'sveltekit', 'remix']);

/** CLI arg-parsing libraries → project is a CLI tool. */
export const NODE_CLI = new Set(['commander', 'oclif', 'yargs', 'cac', '@oclif/core']);

/**
 * CLI arg-parser dep → framework answer value (the cliFrameworkOptions ids).
 * NODE_FRAMEWORK only covers web frameworks, so a CLI's framework is never set
 * from it; this fills the gap. oclif's scoped package is matched first.
 */
export const NODE_CLI_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['@oclif/core', 'oclif'],
  ['oclif', 'oclif'],
  ['commander', 'commander'],
  ['yargs', 'yargs'],
  ['cac', 'cac'],
];

export const NODE_DATABASE: readonly (readonly [string, string])[] = [
  ['pg', 'postgresql'],
  ['postgres', 'postgresql'],
  ['mysql2', 'mysql'],
  ['mysql', 'mysql'],
  ['better-sqlite3', 'sqlite'],
  ['sqlite3', 'sqlite'],
  ['@libsql/client', 'turso'],
  ['@supabase/supabase-js', 'supabase'],
  ['mongoose', 'mongodb'],
  ['mongodb', 'mongodb'],
  ['ioredis', 'redis'],
  ['redis', 'redis'],
  ['@aws-sdk/client-dynamodb', 'dynamodb'],
  ['firebase-admin', 'firebase'],
  ['firebase', 'firebase'],
  ['@clickhouse/client', 'clickhouse'],
  ['cassandra-driver', 'cassandra'],
  ['neo4j-driver', 'neo4j'],
  ['@elastic/elasticsearch', 'elasticsearch'],
];

export const NODE_ORM: readonly (readonly [string, string])[] = [
  ['@prisma/client', 'prisma'],
  ['prisma', 'prisma'],
  ['drizzle-orm', 'drizzle'],
  ['typeorm', 'typeorm'],
  ['@mikro-orm/core', 'mikroorm'],
  ['kysely', 'kysely'],
  ['sequelize', 'sequelize'],
  ['mongoose', 'mongoose'],
];

export const NODE_STYLING: readonly (readonly [string, string])[] = [
  ['tailwindcss', 'tailwind'],
  ['@pandacss/dev', 'panda'],
  ['@mui/material', 'mui'],
  ['@mantine/core', 'mantine'],
  ['@chakra-ui/react', 'chakra'],
  ['@emotion/react', 'emotion'],
  ['@emotion/styled', 'emotion'],
  ['styled-components', 'styled-components'],
  ['antd', 'antd'],
  ['unocss', 'unocss'],
  ['daisyui', 'daisyui'],
  ['bootstrap', 'bootstrap'],
];

export const NODE_VALIDATION: readonly (readonly [string, string])[] = [
  ['zod', 'zod'],
  ['valibot', 'valibot'],
  ['arktype', 'arktype'],
  ['yup', 'yup'],
  ['class-validator', 'class-validator'],
];

export const NODE_STATE: readonly (readonly [string, string])[] = [
  ['zustand', 'zustand'],
  ['@tanstack/react-query', 'tanstack-query'],
  ['@reduxjs/toolkit', 'redux-toolkit'],
  ['jotai', 'jotai'],
  ['pinia', 'pinia'],
  ['@ngrx/store', 'ngrx'],
];

export const NODE_LOGGER: readonly (readonly [string, string])[] = [
  ['pino', 'pino'],
  ['winston', 'winston'],
];

export const NODE_FORMATTER: readonly (readonly [string, string])[] = [
  ['prettier', 'prettier'],
  ['@biomejs/biome', 'biome'],
  ['dprint', 'dprint'],
];

export const NODE_LINTER: readonly (readonly [string, string])[] = [
  ['eslint', 'eslint'],
  ['@biomejs/biome', 'biome'],
  ['oxlint', 'oxlint'],
];

export const NODE_TEST_RUNNER: readonly (readonly [string, string])[] = [
  ['vitest', 'vitest'],
  ['jest', 'jest'],
];

export const NODE_E2E: readonly (readonly [string, string])[] = [
  ['@playwright/test', 'playwright'],
  ['playwright', 'playwright'],
  ['cypress', 'cypress'],
  ['webdriverio', 'webdriverio'],
];

export const NODE_API: readonly (readonly [string, string])[] = [
  ['@trpc/server', 'trpc'],
  ['@trpc/client', 'trpc'],
  ['@apollo/server', 'graphql'],
  ['apollo-server', 'graphql'],
  ['@nestjs/graphql', 'graphql'],
  ['graphql', 'graphql'],
  ['@grpc/grpc-js', 'grpc'],
  ['grpc', 'grpc'],
];

/**
 * Auth library → approach id. Only the values valid across the TS option lists
 * are listed; `passport` is filtered to non-Next.js by the detector since it is
 * not offered for Next.js.
 */
export const NODE_AUTH: readonly (readonly [string, string])[] = [
  ['next-auth', 'authjs'],
  ['@auth/core', 'authjs'],
  ['@clerk/nextjs', 'clerk'],
  ['@clerk/backend', 'clerk'],
  ['@clerk/clerk-sdk-node', 'clerk'],
  ['better-auth', 'better-auth'],
  ['passport', 'passport'],
];

/** Files that mark a JS/TS monorepo workspace → structure = 'monorepo'. */
export const MONOREPO_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'];

// --- Python ------------------------------------------------------------------

export const PY_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['django', 'django'],
  ['fastapi', 'fastapi'],
  ['litestar', 'litestar'],
  ['flask', 'flask'],
];

export const PY_CLI = new Set(['typer', 'click', 'fire']);

export const PY_DATABASE: readonly (readonly [string, string])[] = [
  ['psycopg', 'postgresql'],
  ['psycopg2', 'postgresql'],
  ['psycopg2-binary', 'postgresql'],
  ['asyncpg', 'postgresql'],
  ['pymysql', 'mysql'],
  ['mysqlclient', 'mysql'],
  ['aiomysql', 'mysql'],
  ['motor', 'mongodb'],
  ['pymongo', 'mongodb'],
  ['redis', 'redis'],
  ['supabase', 'supabase'],
];

export const PY_ORM: readonly (readonly [string, string])[] = [
  ['sqlmodel', 'sqlmodel'],
  ['sqlalchemy', 'sqlalchemy'],
  ['tortoise-orm', 'tortoise'],
  ['peewee', 'peewee'],
  ['beanie', 'beanie'],
  ['mongoengine', 'mongoengine'],
  ['motor', 'motor'],
];

export const PY_VALIDATION: readonly (readonly [string, string])[] = [
  ['pydantic', 'pydantic'],
  ['marshmallow', 'marshmallow'],
];

export const PY_LOGGER: readonly (readonly [string, string])[] = [
  ['structlog', 'structlog'],
  ['loguru', 'loguru'],
];

export const PY_FORMATTER: readonly (readonly [string, string])[] = [
  ['black', 'black'],
  ['ruff', 'ruff'],
];

export const PY_LINTER: readonly (readonly [string, string])[] = [
  ['ruff', 'ruff'],
  ['flake8', 'flake8'],
  ['pylint', 'pylint'],
];

export const PY_TEST_RUNNER: readonly (readonly [string, string])[] = [['pytest', 'pytest']];

// --- Go (module paths from go.mod require block) -----------------------------

export const GO_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['github.com/gin-gonic/gin', 'gin'],
  ['github.com/labstack/echo', 'echo'],
  ['github.com/go-chi/chi', 'chi'],
  ['github.com/gofiber/fiber', 'fiber'],
];

export const GO_CLI = new Set(['github.com/spf13/cobra', 'github.com/urfave/cli']);

export const GO_DATABASE: readonly (readonly [string, string])[] = [
  ['github.com/jackc/pgx', 'postgresql'],
  ['github.com/lib/pq', 'postgresql'],
  ['github.com/go-sql-driver/mysql', 'mysql'],
  ['github.com/mattn/go-sqlite3', 'sqlite'],
  ['modernc.org/sqlite', 'sqlite'],
  ['go.mongodb.org/mongo-driver', 'mongodb'],
];

export const GO_ORM: readonly (readonly [string, string])[] = [
  ['gorm.io/gorm', 'gorm'],
  ['entgo.io/ent', 'ent'],
  ['github.com/jmoiron/sqlx', 'sqlx-go'],
];

export const GO_VALIDATION: readonly (readonly [string, string])[] = [
  ['github.com/go-playground/validator', 'validator'],
  ['github.com/go-ozzo/ozzo-validation', 'ozzo'],
];

export const GO_LOGGER: readonly (readonly [string, string])[] = [
  ['go.uber.org/zap', 'zap'],
  ['github.com/rs/zerolog', 'zerolog'],
];

// --- Rust (crate names from Cargo.toml [dependencies]) -----------------------

export const RUST_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['axum', 'axum'],
  ['actix-web', 'actix'],
  ['rocket', 'rocket'],
];

export const RUST_CLI = new Set(['clap', 'argh']);

export const RUST_DATABASE: readonly (readonly [string, string])[] = [['mongodb', 'mongodb']];

export const RUST_ORM: readonly (readonly [string, string])[] = [
  ['diesel', 'diesel'],
  ['sea-orm', 'seaorm'],
  ['sqlx', 'sqlx-rust'],
];

export const RUST_VALIDATION: readonly (readonly [string, string])[] = [
  ['validator', 'validator'],
  ['garde', 'garde'],
];

export const RUST_LOGGER: readonly (readonly [string, string])[] = [
  ['tracing', 'tracing'],
  ['log', 'log'],
];
