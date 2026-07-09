import type { TechModule } from '../../types';
import { isCsharp, isSqlDb } from '../../predicates';
import { guidanceSection } from '../section';

/** Entity Framework Core — Microsoft's modern object-relational mapper for .NET. */
export const efCore: TechModule = {
  id: 'ef-core',
  title: 'Entity Framework Core',
  category: 'orm',
  appliesTo: (a) => isCsharp(a) && isSqlDb(a),
  options: () => [{ value: 'ef-core', label: 'Entity Framework Core', hint: 'recommended' }],
  questions: () => [
    {
      id: 'ef-core.approach',
      type: 'select',
      summary: 'Modeling',
      message: 'Modeling approach?',
      options: [
        { value: 'code-first', label: 'Code-first (migrations)', hint: 'recommended' },
        { value: 'database-first', label: 'Database-first (scaffold)' },
      ],
    },
    {
      id: 'ef-core.keys',
      type: 'select',
      summary: 'Primary keys',
      message: 'Primary key strategy?',
      options: [
        { value: 'identity', label: 'Auto-increment identity', hint: 'recommended' },
        { value: 'guid', label: 'GUIDs' },
      ],
    },
  ],
  migrateCommand: (a) =>
    a['ef-core.approach'] === 'database-first'
      ? 'dotnet ef dbcontext scaffold "<ConnectionString>" <Provider>'
      : 'dotnet ef migrations add <Name> && dotnet ef database update',
  guidance: () =>
    guidanceSection('Entity Framework Core', [
      '- Keep one `DbContext` per bounded context; register it with the DI container (`AddDbContext`) and inject it — never `new` it.',
      '- Configure entities with the Fluent API in `OnModelCreating` / `IEntityTypeConfiguration<T>`, not scattered data annotations.',
      '- Every schema change goes through a migration (`dotnet ef migrations add`); never edit the database by hand.',
      '- Use `AsNoTracking()` for read-only queries; project to DTOs with `Select` to avoid over-fetching and N+1s (`Include` deliberately).',
      '- Do not enumerate `IQueryable` prematurely — keep filtering server-side; watch for client-side evaluation.',
    ]),
};
