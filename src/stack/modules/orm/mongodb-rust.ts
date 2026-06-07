import type { TechModule } from '../../types';
import { isMongo } from '../../predicates';

/** Official mongodb crate for Rust. Recommended Rust+Mongo default. */
export const mongodbRust: TechModule = {
  id: 'mongodb-rust',
  title: 'mongodb (Rust)',
  category: 'orm',
  appliesTo: (a) => a.language === 'rust' && isMongo(a),
  options: () => [{ value: 'mongodb-rust', label: 'mongodb crate', hint: 'recommended' }],
  questions: () => [
    {
      id: 'mongodb-rust.serde',
      type: 'confirm',
      summary: 'serde models',
      message: 'Model documents with serde structs?',
      recommended: true,
    },
  ],
};
