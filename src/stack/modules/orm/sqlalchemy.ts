import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Python ORM for SQL databases. Recommended Python default. */
export const sqlalchemy: TechModule = {
  id: 'sqlalchemy',
  title: 'SQLAlchemy',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isSqlDb(a),
  // Recommended Python default, except on Django where the Django ORM leads.
  options: (a) => [
    {
      value: 'sqlalchemy',
      label: 'SQLAlchemy 2.0',
      ...(a.framework === 'django' ? {} : { hint: 'recommended' }),
    },
  ],
  questions: () => [
    {
      id: 'sqlalchemy.mode',
      type: 'select',
      summary: 'Sync / async',
      message: 'Sync or async SQLAlchemy?',
      options: [
        { value: 'async', label: 'Async (asyncio)', hint: 'recommended' },
        { value: 'sync', label: 'Sync' },
      ],
    },
    {
      id: 'sqlalchemy.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'alembic', label: 'Alembic', hint: 'recommended' },
        { value: 'none', label: 'None / manual' },
      ],
    },
    {
      id: 'sqlalchemy.session',
      type: 'select',
      summary: 'Session pattern',
      message: 'Session management pattern?',
      options: [
        { value: 'per-request', label: 'Session per request / unit of work', hint: 'recommended' },
        { value: 'global', label: 'Global session' },
      ],
    },
  ],
};
