import type { TechModule } from '../../types';
import { isCsharp, isSqlDb } from '../../predicates';
import { guidanceSection } from '../section';

/** Dapper — a lightweight micro-ORM for .NET that maps raw SQL to objects. */
export const dapper: TechModule = {
  id: 'dapper',
  title: 'Dapper',
  category: 'orm',
  appliesTo: (a) => isCsharp(a) && isSqlDb(a),
  options: () => [{ value: 'dapper', label: 'Dapper' }],
  questions: () => [
    {
      id: 'dapper.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Schema migration tool?',
      options: [
        { value: 'fluentmigrator', label: 'FluentMigrator', hint: 'recommended' },
        { value: 'dbup', label: 'DbUp (SQL scripts)' },
        { value: 'manual', label: 'Hand-managed SQL' },
      ],
    },
  ],
  guidance: () =>
    guidanceSection('Dapper', [
      '- Always use parameterized queries (`@param`); never string-concatenate SQL — it is the primary SQL-injection vector.',
      '- Keep SQL in dedicated repository/query classes, not inline in controllers or services.',
      '- Open connections late and dispose them promptly (`using`); let the connection pool manage lifetimes.',
      '- Map to explicit DTO/record types; avoid `dynamic` results so column changes fail at compile time where possible.',
    ]),
};
