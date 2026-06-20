import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Emotion — keyed by the `stylingLibrary` answer value. */
export const emotion: TechModule = {
  id: 'emotion',
  title: 'Emotion',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'emotion',
  questions: () => [
    {
      id: 'emotion.api',
      type: 'select',
      summary: 'Authoring API',
      message: 'Primary Emotion API?',
      options: [
        { value: 'styled', label: 'styled (styled.div`...`)', hint: 'recommended' },
        { value: 'css-prop', label: 'css prop (jsx pragma / @emotion/react)' },
      ],
    },
  ],
  guidance: (a) => {
    const cssProp = a['emotion.api'] === 'css-prop';
    const lines = [
      '- Provide theme via `ThemeProvider` from `@emotion/react` and read tokens through the `theme` argument — do not scatter literal colors/spacing.',
      cssProp
        ? '- Author styles with the `css` prop; enable the `@emotion/react` JSX pragma (automatic runtime) project-wide so the prop type-checks.'
        : '- Author styles with `styled` from `@emotion/styled`; name the components so they read clearly in DevTools.',
      '- Keep shared style fragments in `css` objects and compose them; avoid duplicating the same declarations across components.',
      '- For SSR frameworks, use the official Emotion cache/extractCritical setup so styles stream without hydration mismatches.',
    ];
    return guidanceSection('Styling — Emotion', lines);
  },
};
