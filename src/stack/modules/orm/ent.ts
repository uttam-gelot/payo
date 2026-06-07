import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Ent — Facebook's Go entity framework. */
export const ent: TechModule = {
  id: 'ent',
  title: 'Ent',
  category: 'orm',
  appliesTo: (a) => a.language === 'go' && isSqlDb(a),
  options: () => [{ value: 'ent', label: 'Ent' }],
  questions: () => [
    {
      id: 'ent.schema',
      type: 'confirm',
      summary: 'Code-defined schema',
      message: 'Define schema in Go and generate the client (ent generate)?',
      recommended: true,
    },
  ],
};
