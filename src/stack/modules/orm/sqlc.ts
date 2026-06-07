import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** sqlc — generate type-safe Go from SQL. */
export const sqlc: TechModule = {
  id: 'sqlc',
  title: 'sqlc',
  category: 'orm',
  appliesTo: (a) => a.language === 'go' && isSqlDb(a),
  options: () => [{ value: 'sqlc', label: 'sqlc (SQL-first codegen)' }],
  questions: () => [
    {
      id: 'sqlc.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'golang-migrate', label: 'golang-migrate', hint: 'recommended' },
        { value: 'atlas', label: 'Atlas' },
      ],
    },
  ],
};
