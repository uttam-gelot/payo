import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for plain/vanilla CSS — keyed by the `stylingLibrary` answer value. */
export const vanillaCss: TechModule = {
  id: 'vanilla-css',
  title: 'Vanilla CSS',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'vanilla-css',
  questions: () => [
    {
      id: 'vanilla-css.methodology',
      type: 'select',
      summary: 'Methodology',
      message: 'CSS organization methodology?',
      options: [
        { value: 'bem', label: 'BEM naming', hint: 'recommended' },
        { value: 'cascade-layers', label: 'Cascade layers (@layer)' },
        { value: 'utility', label: 'Hand-rolled utility classes' },
      ],
    },
  ],
  guidance: (a) => {
    const method = a['vanilla-css.methodology'];
    const lines = [
      '- Define design tokens once as CSS custom properties on `:root` (colors, spacing, typography) and reference `var(--token)` everywhere — never duplicate literal values.',
      method === 'cascade-layers'
        ? '- Organize with `@layer` (reset → tokens → base → components → utilities) to keep specificity predictable; avoid `!important`.'
        : method === 'utility'
          ? '- Keep utility classes single-purpose and composable; document the set so they stay consistent and are not reinvented per component.'
          : '- Name classes with BEM (`block__element--modifier`) to keep specificity flat; avoid deep descendant selectors and ID selectors.',
      '- Keep selector specificity low and flat; prefer class selectors over nesting tags or IDs.',
      '- Co-locate component styles with their component and load a single global entry for resets/tokens.',
    ];
    return guidanceSection('Styling — Vanilla CSS', lines);
  },
};
