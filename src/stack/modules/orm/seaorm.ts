import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Rust async ORM for SQL databases. Recommended Rust default. */
export const seaorm: TechModule = {
  id: 'seaorm',
  title: 'SeaORM',
  category: 'orm',
  appliesTo: (a) => a.language === 'rust' && isSqlDb(a),
  options: () => [{ value: 'seaorm', label: 'SeaORM', hint: 'recommended' }],
  questions: () => [
    {
      id: 'seaorm.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration approach?',
      options: [
        { value: 'sea-orm-migration', label: 'sea-orm-migration', hint: 'recommended' },
        { value: 'manual', label: 'Manual SQL' },
      ],
    },
    {
      id: 'seaorm.entities',
      type: 'select',
      summary: 'Entity generation',
      message: 'Entity generation?',
      options: [
        { value: 'sea-orm-cli', label: 'Generate via sea-orm-cli', hint: 'recommended' },
        { value: 'handwritten', label: 'Hand-written entities' },
      ],
    },
  ],
};
