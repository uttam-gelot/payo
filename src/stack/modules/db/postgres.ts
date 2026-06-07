import type { TechModule } from '../../types';

/** DB module: keyed by the `database` answer value. Supplies follow-up questions. */
export const postgres: TechModule = {
  id: 'postgresql',
  title: 'PostgreSQL',
  category: 'db',
  appliesTo: (a) => a.database === 'postgresql',
  questions: () => [
    {
      id: 'postgresql.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'orm-managed', label: 'ORM-managed (Prisma/Drizzle/etc.)', hint: 'recommended' },
        { value: 'standalone', label: 'Standalone (Flyway / Atlas / golang-migrate)' },
        { value: 'none', label: 'None / manual' },
      ],
    },
    {
      id: 'postgresql.naming',
      type: 'select',
      summary: 'Identifier casing',
      message: 'Identifier naming convention (tables & columns)?',
      options: [
        { value: 'snake_case', label: 'snake_case', hint: 'recommended' },
        { value: 'camelCase', label: 'camelCase' },
        { value: 'PascalCase', label: 'PascalCase' },
      ],
    },
    {
      id: 'postgresql.constraintNaming',
      type: 'select',
      summary: 'Index & constraint naming',
      message: 'Index / foreign-key / constraint naming?',
      options: [
        { value: 'prefixed', label: 'Conventional prefixes (idx_, fk_, uq_)', hint: 'recommended' },
        { value: 'orm-default', label: 'ORM / framework default' },
        { value: 'none', label: 'No specific convention' },
      ],
    },
    {
      id: 'postgresql.pooling',
      type: 'confirm',
      summary: 'Connection pooler',
      message: 'Use a connection pooler (PgBouncer / framework pool)?',
      recommended: true,
    },
  ],
};
