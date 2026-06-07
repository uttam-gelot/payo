import type { TechModule } from '../../types';
import { isMongo } from '../../predicates';

/** MongoEngine — synchronous Python MongoDB ODM. */
export const mongoengine: TechModule = {
  id: 'mongoengine',
  title: 'MongoEngine',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isMongo(a),
  options: () => [{ value: 'mongoengine', label: 'MongoEngine' }],
  questions: () => [
    {
      id: 'mongoengine.models',
      type: 'confirm',
      summary: 'Document classes',
      message: 'Model collections with Document classes?',
      recommended: true,
    },
  ],
};
