/**
 * Shared answer predicates used by tech modules and the question flow to gate
 * options consistently (e.g. which ORMs apply to the selected database/language).
 */
import type { Answers } from '../questions/types';

/** Relational / SQL-compatible databases (Supabase & Neon are Postgres under the hood). */
const SQL_DBS = new Set([
  'postgresql',
  'mysql',
  'sqlite',
  'mariadb',
  'cockroachdb',
  'turso',
  'neon',
  'supabase',
]);

export const isSqlDb = (a: Answers): boolean =>
  typeof a.database === 'string' && SQL_DBS.has(a.database);

/**
 * Maps a database option id to the canonical engine whose DB module supplies the
 * follow-up questions. Serverless/compatible variants reuse their wire-compatible
 * engine's module (Neon/Supabase/CockroachDB are Postgres, MariaDB is MySQL,
 * Turso is libSQL/SQLite), so they get the same migration/naming/pooling depth as
 * the vanilla engine instead of being silently downgraded to a name-only bullet.
 */
const DB_FAMILY: Record<string, string> = {
  neon: 'postgresql',
  supabase: 'postgresql',
  cockroachdb: 'postgresql',
  mariadb: 'mysql',
  turso: 'sqlite',
};

/** Canonical DB engine for `a.database` (e.g. neon → postgresql); identity when no alias. */
export const dbFamily = (a: Answers): string | undefined =>
  typeof a.database === 'string' ? (DB_FAMILY[a.database] ?? a.database) : undefined;

export const isMongo = (a: Answers): boolean => a.database === 'mongodb';

/** A database for which asking about an ORM / data-access layer makes sense. */
export const hasModeledDb = (a: Answers): boolean => isSqlDb(a) || isMongo(a);

export const isTsJs = (a: Answers): boolean =>
  a.language === 'typescript' || a.language === 'javascript';

/** TypeScript only — gates compiler-config questions (tsconfig). */
export const isTs = (a: Answers): boolean => a.language === 'typescript';
