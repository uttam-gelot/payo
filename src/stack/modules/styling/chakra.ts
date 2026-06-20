import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Chakra UI — keyed by the `stylingLibrary` answer value. */
export const chakra: TechModule = {
  id: 'chakra',
  title: 'Chakra UI',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'chakra',
  questions: () => [
    {
      id: 'chakra.theming',
      type: 'confirm',
      summary: 'Custom theme',
      message: 'Maintain a custom theme (extended tokens, semantic colors)?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- Style through Chakra style props and the `sx`-style shorthand; read colors/spacing from theme tokens rather than literal values.',
      '- Compose layouts with `Box`/`Flex`/`Stack`/`Grid` and responsive array/object props instead of custom media queries.',
      '- Build reusable variants with `defineStyleConfig` (component recipes) rather than repeating prop clusters across call sites.',
      '- Use semantic tokens for color-mode-aware values so light/dark switch without per-component branching.',
    ];
    if (a['chakra.theming'] === true)
      lines.push(
        '- Keep the custom theme in one module passed to the provider; extend the base theme rather than replacing it wholesale.',
      );
    return guidanceSection('Styling — Chakra UI', lines);
  },
};
