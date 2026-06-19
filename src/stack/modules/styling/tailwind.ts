import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/**
 * Styling module: keyed by the `stylingLibrary` answer value. Not selectable on
 * its own (the option lives in `stylingOptions`) — it only adds follow-ups and
 * provider guidance once Tailwind is chosen.
 */
export const tailwind: TechModule = {
  id: 'tailwind',
  title: 'Tailwind CSS',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'tailwind',
  questions: () => [
    {
      id: 'tailwind.config',
      type: 'select',
      summary: 'Config style',
      message: 'Tailwind configuration style?',
      options: [
        { value: 'css-first', label: 'CSS-first (@theme in CSS, v4)', hint: 'recommended' },
        { value: 'js-config', label: 'tailwind.config.{js,ts}' },
      ],
    },
    {
      id: 'tailwind.classOrder',
      type: 'confirm',
      summary: 'Class sorting',
      message: 'Enforce class ordering with prettier-plugin-tailwindcss?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const cssFirst = a['tailwind.config'] !== 'js-config';
    const lines = [
      cssFirst
        ? '- Configure the theme CSS-first with `@theme` in the main stylesheet (Tailwind v4); avoid a JS config unless a plugin requires one.'
        : '- Keep theme tokens (colors, spacing, fonts) in `tailwind.config`; extend rather than override defaults.',
      '- Style with utility classes in markup; do not write parallel custom CSS for what a utility already covers.',
      '- Extract a component (or `@apply` in a component layer) only when a utility cluster repeats; do not pre-abstract.',
      '- Pull spacing, color, and typography from theme tokens — never hard-code hex values or arbitrary pixel values when a token exists.',
    ];
    if (a['tailwind.classOrder'] === true)
      lines.push(
        '- Sort utility classes with prettier-plugin-tailwindcss; do not hand-order classes.',
      );
    return guidanceSection('Styling — Tailwind CSS', lines);
  },
};
