import type { TechModule } from '../../types';
import { isMongo } from '../../predicates';

/** Motor — async Python MongoDB driver (no ODM). */
export const motor: TechModule = {
  id: 'motor',
  title: 'Motor',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isMongo(a),
  options: () => [{ value: 'motor', label: 'Motor (async driver)' }],
  questions: () => [
    {
      id: 'motor.models',
      type: 'confirm',
      summary: 'Pydantic wrappers',
      message: 'Wrap documents in Pydantic models for validation?',
      recommended: true,
    },
  ],
};
