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
  'sqlserver',
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

/** PHP — gates Laravel and other PHP-ecosystem modules. */
export const isPhp = (a: Answers): boolean => a.language === 'php';

/** C# / .NET — gates ASP.NET Core, EF Core, and other .NET-ecosystem modules. */
export const isCsharp = (a: Answers): boolean => a.language === 'csharp';

/** Java — gates Spring Boot, Spring Data JPA, and other JVM-ecosystem modules. */
export const isJava = (a: Answers): boolean => a.language === 'java';

/** Ruby — gates Rails, Active Record, and other Ruby-ecosystem modules. */
export const isRuby = (a: Answers): boolean => a.language === 'ruby';

/**
 * Whether the user actually chose a testing setup: at least one test type, or a
 * real runner / e2e tool ('none' counts as declined). Mirrors the Testing-section
 * gate in generator/rules.ts — anything test-flavored the generator or bootstrap
 * prompt emits must hinge on this, so a project whose tests were skipped never
 * gets test commands or test prose fabricated for it.
 */
export const hasTesting = (a: Answers): boolean => {
  const chosen = (key: string): boolean =>
    typeof a[key] === 'string' && a[key] !== '' && a[key] !== 'none';
  return (
    (Array.isArray(a.testTypes) && a.testTypes.length > 0) || chosen('testRunner') || chosen('e2eTool')
  );
};
