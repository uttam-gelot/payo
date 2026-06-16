import type { TechModule } from '../../types';
import { isMongo, isSqlDb, isTsJs } from '../../predicates';

/** TS/JS ORM for SQL and MongoDB. */
export const prisma: TechModule = {
  id: 'prisma',
  title: 'Prisma',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && (isSqlDb(a) || isMongo(a)),
  // Offered for SQL and MongoDB; the recommended defaults are TypeORM (SQL) and
  // Mongoose (MongoDB), so Prisma carries no recommended hint.
  options: () => [{ value: 'prisma', label: 'Prisma' }],
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
  migrateCommand: (a) => {
    if (a['prisma.migrations'] === 'db-push') return 'prisma db push';
    if (a['prisma.migrations'] === 'manual') return undefined;
    return 'prisma migrate dev';
  },
};
