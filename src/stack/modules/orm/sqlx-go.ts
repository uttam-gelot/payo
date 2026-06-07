import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** sqlx — Go extension over database/sql. */
export const sqlxGo: TechModule = {
  id: 'sqlx-go',
  title: 'sqlx (Go)',
  category: 'orm',
  appliesTo: (a) => a.language === 'go' && isSqlDb(a),
  options: () => [{ value: 'sqlx-go', label: 'sqlx' }],
  questions: () => [
    {
      id: 'sqlx-go.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'golang-migrate', label: 'golang-migrate', hint: 'recommended' },
        { value: 'goose', label: 'goose' },
      ],
    },
  ],
};
