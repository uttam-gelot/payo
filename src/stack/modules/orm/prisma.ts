import type { TechModule } from '../../types';
import { isMongo, isSqlDb, isTsJs } from '../../predicates';

/** TS/JS ORM for SQL and MongoDB. Recommended default for SQL databases. */
export const prisma: TechModule = {
  id: 'prisma',
  title: 'Prisma',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && (isSqlDb(a) || isMongo(a)),
  // Recommended for SQL; on MongoDB the recommended default is Mongoose instead.
  options: (a) => [
    { value: 'prisma', label: 'Prisma', ...(isSqlDb(a) ? { hint: 'recommended' } : {}) },
  ],
  questions: () => [
    {
      id: 'prisma.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Prisma migration workflow?',
      options: [
        { value: 'migrate', label: 'prisma migrate (versioned)', hint: 'recommended' },
        { value: 'db-push', label: 'prisma db push (prototyping)' },
        { value: 'manual', label: 'Manual SQL migrations' },
      ],
    },
    {
      id: 'prisma.client',
      type: 'select',
      summary: 'Client instantiation',
      message: 'PrismaClient instantiation?',
      options: [
        { value: 'singleton', label: 'Shared singleton instance', hint: 'recommended' },
        { value: 'per-request', label: 'Per-request instance' },
      ],
    },
  ],
};
