import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Diesel — synchronous Rust ORM / query builder. */
export const diesel: TechModule = {
  id: 'diesel',
  title: 'Diesel',
  category: 'orm',
  appliesTo: (a) => a.language === 'rust' && isSqlDb(a),
  options: () => [{ value: 'diesel', label: 'Diesel' }],
  questions: () => [
    {
      id: 'diesel.migrations',
      type: 'confirm',
      summary: 'Diesel CLI migrations',
      message: 'Manage schema with the Diesel CLI (diesel migration)?',
      recommended: true,
    },
  ],
};
