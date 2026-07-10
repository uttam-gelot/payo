import type { TechModule } from '../../types';
import { isRuby, isSqlDb } from '../../predicates';

/** Active Record — Rails' built-in ORM (recommended default on Rails). */
export const activeRecord: TechModule = {
  id: 'active-record',
  title: 'Active Record',
  category: 'orm',
  appliesTo: (a) => isRuby(a) && isSqlDb(a) && a.framework === 'rails',
  options: () => [{ value: 'active-record', label: 'Active Record', hint: 'recommended' }],
  questions: () => [
    {
      id: 'active-record.keys',
      type: 'select',
      summary: 'Primary keys',
      message: 'Primary key strategy?',
      options: [
        { value: 'bigint', label: 'Auto-increment bigint', hint: 'recommended' },
        { value: 'uuid', label: 'UUIDs' },
      ],
    },
  ],
  migrateCommand: () => 'bin/rails db:migrate',
};
