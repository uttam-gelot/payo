import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Mantine — keyed by the `stylingLibrary` answer value. */
export const mantine: TechModule = {
  id: 'mantine',
  title: 'Mantine',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'mantine',
  questions: () => [
    {
      id: 'mantine.styling',
      type: 'select',
      summary: 'Custom styling',
      message: 'How are styles customized beyond props?',
      options: [
        { value: 'css-modules', label: 'CSS Modules + Mantine vars', hint: 'recommended' },
        { value: 'sx-style', label: 'style/styles props inline' },
      ],
    },
  ],
  guidance: (a) => {
    const cssMods = a['mantine.styling'] !== 'sx-style';
    const lines = [
      '- Wrap the app in one `MantineProvider` and define overrides (colors, fonts, spacing, default radius) in a single `createTheme`.',
      '- Drive component appearance through Mantine props and theme tokens first; do not hand-write CSS for what a prop already controls.',
      cssMods
        ? '- For custom styling use CSS Modules referencing Mantine CSS variables (`var(--mantine-color-*)`) so light/dark themes follow automatically.'
        : '- Use the `style`/`styles` props for targeted tweaks; promote anything repeated into the theme rather than copying inline styles.',
      '- Toggle color scheme through Mantine’s scheme manager, not by editing component styles.',
    ];
    return guidanceSection('Styling — Mantine', lines);
  },
};
