import type { TechModule } from '../../types';
import { isMongo, isTsJs } from '../../predicates';

/** TS/JS ODM for MongoDB. Recommended MongoDB default. */
export const mongoose: TechModule = {
  id: 'mongoose',
  title: 'Mongoose',
  category: 'orm',
  appliesTo: (a) => isTsJs(a) && isMongo(a),
  options: () => [{ value: 'mongoose', label: 'Mongoose', hint: 'recommended' }],
  questions: () => [
    {
      id: 'mongoose.schema',
      type: 'select',
      summary: 'Schema strictness',
      message: 'Schema strictness?',
      options: [
        { value: 'strict', label: 'Strict schemas', hint: 'recommended' },
        { value: 'flexible', label: 'Flexible / mixed' },
      ],
    },
    {
      id: 'mongoose.validation',
      type: 'confirm',
      summary: 'Schema validation',
      message: 'Enforce schema-level validation?',
      recommended: true,
    },
  ],
};
