import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for CSS Modules — keyed by the `stylingLibrary` answer value. */
export const cssModules: TechModule = {
  id: 'css-modules',
  title: 'CSS Modules',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'css-modules',
  questions: () => [
    {
      id: 'css-modules.naming',
      type: 'select',
      summary: 'Class naming',
      message: 'Class-name convention in *.module.css?',
      options: [
        { value: 'camelCase', label: 'camelCase (clean JS access)', hint: 'recommended' },
        { value: 'kebab-case', label: 'kebab-case (bracket access)' },
      ],
    },
  ],
  guidance: (a) => {
    const camel = a['css-modules.naming'] !== 'kebab-case';
    const lines = [
      '- Colocate a `*.module.css` next to each component; import styles as a scoped object.',
      camel
        ? '- Name classes in camelCase so they read as `styles.cardHeader` without bracket access.'
        : '- Name classes in kebab-case and access them with bracket notation (`styles["card-header"]`).',
      '- Keep global CSS to a single resets/tokens entry file; everything component-specific goes in its module.',
      '- Share values through CSS custom properties (design tokens), not duplicated literals across modules.',
    ];
    return guidanceSection('Styling — CSS Modules', lines);
  },
};
