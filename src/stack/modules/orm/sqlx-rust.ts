import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** sqlx — async, compile-time-checked Rust SQL. */
export const sqlxRust: TechModule = {
  id: 'sqlx-rust',
  title: 'sqlx (Rust)',
  category: 'orm',
  appliesTo: (a) => a.language === 'rust' && isSqlDb(a),
  options: () => [{ value: 'sqlx-rust', label: 'sqlx' }],
  questions: () => [
    {
      id: 'sqlx-rust.macros',
      type: 'confirm',
      summary: 'Checked query macros',
      message: 'Use compile-time-checked query!/query_as! macros?',
      recommended: true,
    },
    {
      id: 'sqlx-rust.migrations',
      type: 'confirm',
      summary: 'sqlx migrate',
      message: 'Manage schema with sqlx migrate?',
      recommended: true,
    },
  ],
};
