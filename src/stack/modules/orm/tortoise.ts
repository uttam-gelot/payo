import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Tortoise ORM — async Python ORM. */
export const tortoise: TechModule = {
  id: 'tortoise',
  title: 'Tortoise ORM',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isSqlDb(a),
  options: () => [{ value: 'tortoise', label: 'Tortoise ORM' }],
  questions: () => [
    {
      id: 'tortoise.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'aerich', label: 'Aerich', hint: 'recommended' },
        { value: 'none', label: 'None / manual' },
      ],
    },
  ],
};
