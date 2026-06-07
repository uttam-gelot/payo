import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** SQLModel — Pydantic + SQLAlchemy ORM (Python). */
export const sqlmodel: TechModule = {
  id: 'sqlmodel',
  title: 'SQLModel',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isSqlDb(a),
  options: () => [{ value: 'sqlmodel', label: 'SQLModel' }],
  questions: () => [
    {
      id: 'sqlmodel.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'alembic', label: 'Alembic', hint: 'recommended' },
        { value: 'none', label: 'None / manual' },
      ],
    },
  ],
};
