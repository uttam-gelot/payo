import type { TechModule } from '../../types';
import { isMongo } from '../../predicates';

/** Python async ODM for MongoDB (Pydantic-based). Recommended Python+Mongo default. */
export const beanie: TechModule = {
  id: 'beanie',
  title: 'Beanie',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isMongo(a),
  options: () => [{ value: 'beanie', label: 'Beanie (async ODM)', hint: 'recommended' }],
  questions: () => [
    {
      id: 'beanie.models',
      type: 'select',
      summary: 'Document models',
      message: 'Document modeling approach?',
      options: [
        { value: 'pydantic', label: 'Pydantic-based Document models', hint: 'recommended' },
        { value: 'raw', label: 'Raw dict access' },
      ],
    },
  ],
};
