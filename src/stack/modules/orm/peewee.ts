import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Peewee — small Python ORM. */
export const peewee: TechModule = {
  id: 'peewee',
  title: 'Peewee',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isSqlDb(a),
  options: () => [{ value: 'peewee', label: 'Peewee' }],
  questions: () => [
    {
      id: 'peewee.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration approach?',
      options: [
        { value: 'peewee-migrate', label: 'peewee-migrate', hint: 'recommended' },
        { value: 'manual', label: 'Manual migrator' },
      ],
    },
  ],
};
