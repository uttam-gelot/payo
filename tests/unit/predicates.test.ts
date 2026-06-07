import { describe, it, expect } from 'bun:test';
import { isSqlDb, isMongo, isTsJs, hasModeledDb } from '../../src/stack/predicates';

describe('predicates', () => {
  it('isSqlDb is true for SQL-compatible databases', () => {
    const sql = [
      'postgresql',
      'mysql',
      'mariadb',
      'sqlite',
      'turso',
      'neon',
      'cockroachdb',
      'supabase',
    ];
    for (const database of sql) expect(isSqlDb({ database })).toBe(true);
  });

  it('isSqlDb is false for non-SQL databases', () => {
    for (const database of ['mongodb', 'redis', 'dynamodb', 'firebase', 'none'])
      expect(isSqlDb({ database })).toBe(false);
    expect(isSqlDb({})).toBe(false);
  });

  it('isMongo', () => {
    expect(isMongo({ database: 'mongodb' })).toBe(true);
    expect(isMongo({ database: 'postgresql' })).toBe(false);
  });

  it('isTsJs', () => {
    expect(isTsJs({ language: 'typescript' })).toBe(true);
    expect(isTsJs({ language: 'javascript' })).toBe(true);
    expect(isTsJs({ language: 'python' })).toBe(false);
  });

  it('hasModeledDb is SQL or Mongo', () => {
    expect(hasModeledDb({ database: 'postgresql' })).toBe(true);
    expect(hasModeledDb({ database: 'mongodb' })).toBe(true);
    expect(hasModeledDb({ database: 'redis' })).toBe(false);
  });
});
