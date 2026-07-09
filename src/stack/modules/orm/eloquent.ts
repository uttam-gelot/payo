import type { TechModule } from '../../types';
import { isPhp, isSqlDb } from '../../predicates';

/** Eloquent — Laravel's built-in Active Record ORM (recommended default on Laravel). */
export const eloquent: TechModule = {
  id: 'eloquent',
  title: 'Eloquent',
  category: 'orm',
  appliesTo: (a) => isPhp(a) && isSqlDb(a) && a.framework === 'laravel',
  options: () => [{ value: 'eloquent', label: 'Eloquent', hint: 'recommended' }],
  questions: () => [
    {
      id: 'eloquent.keys',
      type: 'select',
      summary: 'Primary keys',
      message: 'Primary key strategy?',
      options: [
        { value: 'auto-increment', label: 'Auto-increment integers', hint: 'recommended' },
        { value: 'uuid', label: 'UUIDs' },
        { value: 'ulid', label: 'ULIDs' },
      ],
    },
  ],
  migrateCommand: () => 'php artisan migrate',
};
