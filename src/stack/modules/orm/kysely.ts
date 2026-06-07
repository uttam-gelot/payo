import type { TechModule } from '../../types';
import { isSqlDb, isTsJs } from '../../predicates';

/** Kysely — type-safe TS SQL query builder. */
export const kysely: TechModule = {
  id: 'kysely',
  title: 'Kysely',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isSqlDb(a),
  options: () => [{ value: 'kysely', label: 'Kysely' }],
  questions: () => [
    {
      id: 'kysely.types',
      type: 'select',
      summary: 'Type definitions',
      message: 'Database type definitions?',
      options: [
        { value: 'codegen', label: 'Generated via kysely-codegen', hint: 'recommended' },
        { value: 'handwritten', label: 'Hand-written interfaces' },
      ],
    },
    {
      id: 'kysely.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tooling?',
      options: [
        { value: 'kysely-migrator', label: 'Kysely Migrator', hint: 'recommended' },
        { value: 'external', label: 'External tool (Atlas / dbmate)' },
      ],
    },
  ],
};
