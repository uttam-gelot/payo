import type { TechModule } from '../../types';
import { isMongo } from '../../predicates';

/** Official MongoDB driver for Go. Recommended Go+Mongo default. */
export const mongoGoDriver: TechModule = {
  id: 'mongo-go-driver',
  title: 'MongoDB Go Driver',
  category: 'orm',
  appliesTo: (a) => a.language === 'go' && isMongo(a),
  options: () => [
    { value: 'mongo-go-driver', label: 'Official MongoDB Go Driver', hint: 'recommended' },
  ],
  questions: () => [
    {
      id: 'mongo-go-driver.structs',
      type: 'confirm',
      summary: 'Typed structs',
      message: 'Model documents with typed structs and bson tags?',
      recommended: true,
    },
  ],
};
