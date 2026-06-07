import type { TechModule } from '../../types';
import { isSqlDb, isTsJs } from '../../predicates';

/** TypeORM — TS/JS SQL ORM. */
export const typeorm: TechModule = {
  id: 'typeorm',
  title: 'TypeORM',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isSqlDb(a),
  options: () => [{ value: 'typeorm', label: 'TypeORM' }],
  questions: () => [
    {
      id: 'typeorm.entities',
      type: 'select',
      summary: 'Entity definition',
      message: 'Entity definition style?',
      options: [
        { value: 'decorators', label: 'Decorator-based entities', hint: 'recommended' },
        { value: 'schemas', label: 'EntitySchema definitions' },
      ],
    },
    {
      id: 'typeorm.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Schema management?',
      options: [
        { value: 'migrations', label: 'Generated migrations', hint: 'recommended' },
        { value: 'synchronize', label: 'synchronize (development only)' },
      ],
    },
  ],
};
