import type { TechModule } from '../../types';

/** Rocket — Rust web framework. */
export const rocket: TechModule = {
  id: 'rocket',
  title: 'Rocket',
  category: 'framework',
  appliesTo: (a) =>
    a.language === 'rust' && (a.projectType === 'backend' || a.projectType === 'full-stack'),
  options: () => [{ value: 'rocket', label: 'Rocket' }],
  questions: () => [
    {
      id: 'rocket.state',
      type: 'confirm',
      summary: 'Managed state',
      message: 'Use managed state (State<T>) for shared resources?',
      recommended: true,
    },
    {
      id: 'rocket.guards',
      type: 'confirm',
      summary: 'Request guards',
      message: 'Use request guards for auth/validation?',
      recommended: true,
    },
  ],
};
