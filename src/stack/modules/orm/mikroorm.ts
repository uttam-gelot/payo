import type { TechModule } from '../../types';
import { isSqlDb, isTsJs } from '../../predicates';

/** MikroORM — TS/JS data-mapper ORM. */
export const mikroorm: TechModule = {
  id: 'mikroorm',
  title: 'MikroORM',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isSqlDb(a),
  options: () => [{ value: 'mikroorm', label: 'MikroORM' }],
  questions: () => [
    {
      id: 'mikroorm.identity',
      type: 'confirm',
      summary: 'Unit of Work',
      message: 'Rely on the Identity Map / Unit of Work (flush per request)?',
      recommended: true,
    },
    {
      id: 'mikroorm.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Schema management?',
      options: [
        { value: 'migrations', label: '@mikro-orm/migrations', hint: 'recommended' },
        { value: 'schema-generator', label: 'SchemaGenerator (development only)' },
      ],
    },
  ],
};
