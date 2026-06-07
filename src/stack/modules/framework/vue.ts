import type { TechModule } from '../../types';
import { isTsJs } from '../../predicates';

/** Vue SPA framework. */
export const vue: TechModule = {
  id: 'vue',
  title: 'Vue',
  category: 'framework',
  appliesTo: (a) => isTsJs(a) && a.projectType === 'frontend',
  options: () => [{ value: 'vue', label: 'Vue' }],
  questions: () => [
    {
      id: 'vue.apiStyle',
      type: 'select',
      summary: 'API style',
      message: 'Component API style?',
      options: [
        { value: 'composition', label: 'Composition API (<script setup>)', hint: 'recommended' },
        { value: 'options', label: 'Options API' },
      ],
    },
    {
      id: 'vue.router',
      type: 'select',
      summary: 'Routing',
      message: 'Client-side routing?',
      options: [
        { value: 'vue-router', label: 'Vue Router', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ],
    },
  ],
};
