import type { TechModule } from '../../types';
import { dbFamily } from '../../predicates';

/** SQLite — supplies follow-up questions when selected as the database. */
export const sqlite: TechModule = {
  id: 'sqlite',
  title: 'SQLite',
  category: 'db',
  // Family-aware: also covers Turso / libSQL (SQLite-compatible).
  appliesTo: (a) => dbFamily(a) === 'sqlite',
  questions: () => [
    {
      id: 'sqlite.migrations',
      type: 'select',
      summary: 'Migrations',
      message: 'Migration tool?',
      options: [
        { value: 'orm-managed', label: 'ORM-managed (Prisma/Drizzle/etc.)', hint: 'recommended' },
        { value: 'standalone', label: 'Standalone (Atlas / dbmate)' },
        { value: 'none', label: 'None / manual' },
      ],
    },
    {
      id: 'sqlite.naming',
      type: 'select',
      summary: 'Identifier casing',
      message: 'Identifier naming convention (tables & columns)?',
      options: [
        { value: 'snake_case', label: 'snake_case', hint: 'recommended' },
        { value: 'camelCase', label: 'camelCase' },
      ],
    },
    {
      id: 'sqlite.wal',
      type: 'confirm',
      summary: 'WAL journal mode',
      message: 'Enable WAL journal mode for better concurrency?',
      recommended: true,
    },
  ],
};
