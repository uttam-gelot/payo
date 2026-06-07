import type { TechModule } from '../../types';

/** MongoDB — supplies follow-up questions when selected as the database. */
export const mongodb: TechModule = {
  id: 'mongodb',
  title: 'MongoDB',
  category: 'db',
  appliesTo: (a) => a.database === 'mongodb',
  questions: () => [
    {
      id: 'mongodb.modeling',
      type: 'select',
      summary: 'Document modeling',
      message: 'Document modeling approach?',
      options: [
        { value: 'embedding', label: 'Favor embedding (denormalized)', hint: 'recommended' },
        { value: 'referencing', label: 'Favor referencing (normalized)' },
      ],
    },
    {
      id: 'mongodb.naming',
      type: 'select',
      summary: 'Field casing',
      message: 'Field naming convention?',
      options: [
        { value: 'camelCase', label: 'camelCase', hint: 'recommended' },
        { value: 'snake_case', label: 'snake_case' },
      ],
    },
    {
      id: 'mongodb.indexes',
      type: 'confirm',
      summary: 'Explicit indexes',
      message: 'Define explicit indexes for queried fields?',
      recommended: true,
    },
  ],
};
