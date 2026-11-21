import type { Answers } from '../../../questions/types';
import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/**
 * The class-ordering rule for the chosen formatter, or undefined when class
 * ordering was not asked for. Biome sorts with its own `useSortedClasses` lint
 * rule; Prettier (or no formatter yet) uses prettier-plugin-tailwindcss. Any other
 * formatter has no Tailwind sorter, so the rule names none rather than pulling
 * Prettier into a toolchain that does not use it.
 */
export function classSortRule(a: Answers): string | undefined {
  if (a['tailwind.classOrder'] !== true) return undefined;
  const fmt = typeof a.formatter === 'string' ? a.formatter : '';
  if (fmt === 'biome')
    return "Sort utility classes with Biome's `useSortedClasses` lint rule (apply its safe fix); do not hand-order classes and do not add Prettier for sorting.";
  if (fmt === 'prettier' || fmt === '' || fmt === 'none')
    return 'Sort utility classes with prettier-plugin-tailwindcss; do not hand-order classes.';
  return 'Keep utility classes in one consistent order (layout, spacing, typography, color, state); do not add another formatter just to sort them.';
}

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
      // Tool-neutral on purpose: this follow-up is asked before the formatter,
      // so the tool that sorts is picked at generation (see classSortRule).
      message: 'Enforce automatic Tailwind class ordering?',
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
    const sort = classSortRule(a);
    if (sort) lines.push(`- ${sort}`);
    return guidanceSection('Styling — Tailwind CSS', lines);
  },
};
