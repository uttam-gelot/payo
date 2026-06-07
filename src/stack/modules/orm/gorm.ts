import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Go ORM for SQL databases. Recommended Go default. */
export const gorm: TechModule = {
  id: 'gorm',
  title: 'GORM',
  category: 'orm',
  appliesTo: (a) => a.language === 'go' && isSqlDb(a),
  options: () => [{ value: 'gorm', label: 'GORM', hint: 'recommended' }],
  questions: () => [
    {
      id: 'gorm.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration approach?',
      options: [
        {
          value: 'versioned',
          label: 'Versioned migrations (golang-migrate / Atlas)',
          hint: 'recommended',
        },
        { value: 'automigrate', label: 'AutoMigrate (development only)' },
      ],
    },
    {
      id: 'gorm.naming',
      type: 'select',
      summary: 'Naming strategy',
      message: 'Identifier naming strategy?',
      options: [
        { value: 'snake_case', label: 'snake_case (GORM default)', hint: 'recommended' },
        { value: 'custom', label: 'Custom naming strategy' },
      ],
    },
  ],
};
