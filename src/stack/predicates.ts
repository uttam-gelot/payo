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

export const isMongo = (a: Answers): boolean => a.database === 'mongodb';

/** A database for which asking about an ORM / data-access layer makes sense. */
export const hasModeledDb = (a: Answers): boolean => isSqlDb(a) || isMongo(a);

export const isTsJs = (a: Answers): boolean =>
  a.language === 'typescript' || a.language === 'javascript';

/** TypeScript only — gates compiler-config questions (tsconfig). */
export const isTs = (a: Answers): boolean => a.language === 'typescript';
