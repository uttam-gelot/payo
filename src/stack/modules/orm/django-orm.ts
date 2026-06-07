import type { TechModule } from '../../types';
import { isSqlDb } from '../../predicates';

/** Django ORM — recommended default on Django projects. */
export const djangoOrm: TechModule = {
  id: 'django-orm',
  title: 'Django ORM',
  category: 'orm',
  appliesTo: (a) => a.language === 'python' && isSqlDb(a) && a.framework === 'django',
  options: () => [{ value: 'django-orm', label: 'Django ORM', hint: 'recommended' }],
  questions: () => [
    {
      id: 'django-orm.migrations',
      type: 'confirm',
      summary: 'Django migrations',
      message: 'Use Django migrations (makemigrations / migrate)?',
      recommended: true,
    },
  ],
};
