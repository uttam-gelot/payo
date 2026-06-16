import type { TechModule } from '../../types';
import { isSqlDb, isTsJs } from '../../predicates';

/** Drizzle — TS/JS SQL ORM / query builder. */
export const drizzle: TechModule = {
  id: 'drizzle',
  title: 'Drizzle',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isSqlDb(a),
  options: () => [{ value: 'drizzle', label: 'Drizzle' }],
  questions: () => [
    {
      id: 'drizzle.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration workflow?',
      options: [
        { value: 'drizzle-kit', label: 'drizzle-kit generate + migrate', hint: 'recommended' },
        { value: 'push', label: 'drizzle-kit push (prototyping)' },
      ],
    },
    {
      id: 'drizzle.relations',
      type: 'confirm',
      summary: 'Relations API',
      message: 'Use the Drizzle relations API for joins?',
      recommended: true,
    },
  ],
  migrateCommand: (a) =>
    a['drizzle.migrations'] === 'push'
      ? 'drizzle-kit push'
      : 'drizzle-kit generate && drizzle-kit migrate',
};
