import type { TechModule } from '../../types';
import { isSqlDb, isTsJs } from '../../predicates';

/** Sequelize — TS/JS SQL ORM. */
export const sequelize: TechModule = {
  id: 'sequelize',
  title: 'Sequelize',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isSqlDb(a),
  options: () => [{ value: 'sequelize', label: 'Sequelize' }],
  questions: () => [
    {
      id: 'sequelize.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Schema management?',
      options: [
        {
          value: 'umzug',
          label: 'Versioned migrations (sequelize-cli / Umzug)',
          hint: 'recommended',
        },
        { value: 'sync', label: 'sequelize.sync (development only)' },
      ],
    },
  ],
  // sequelize.sync builds the schema in-process, so there is no migrate command.
  migrateCommand: (a) =>
    a['sequelize.migrations'] === 'sync' ? undefined : 'sequelize-cli db:migrate',
};
