import type { TechModule } from '../../types';
import { dbFamily } from '../../predicates';

/** MySQL — supplies follow-up questions when selected as the database. */
export const mysql: TechModule = {
  id: 'mysql',
  title: 'MySQL',
  category: 'db',
  // Family-aware: also covers MariaDB (MySQL-compatible).
  appliesTo: (a) => dbFamily(a) === 'mysql',
  questions: () => [
    {
      id: 'mysql.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'orm-managed', label: 'ORM-managed (Prisma/Drizzle/etc.)', hint: 'recommended' },
        { value: 'standalone', label: 'Standalone (Flyway / Atlas)' },
        { value: 'none', label: 'None / manual' },
      ],
    },
    {
      id: 'mysql.naming',
      type: 'select',
      summary: 'Identifier casing',
      message: 'Identifier naming convention (tables & columns)?',
      options: [
        { value: 'snake_case', label: 'snake_case', hint: 'recommended' },
        { value: 'camelCase', label: 'camelCase' },
      ],
    },
    {
      id: 'mysql.pooling',
      type: 'confirm',
      summary: 'Connection pool',
      message: 'Use a connection pool?',
      recommended: true,
    },
  ],
};
