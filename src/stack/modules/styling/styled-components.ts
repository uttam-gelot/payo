import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Styled Components — keyed by the `stylingLibrary` answer value. */
export const styledComponents: TechModule = {
  id: 'styled-components',
  title: 'Styled Components',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'styled-components',
  questions: () => [
    {
      id: 'styled-components.ssr',
      type: 'confirm',
      summary: 'SSR setup',
      message: 'Server-side rendering (needs the styled-components registry/babel plugin)?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- Define a single `ThemeProvider` at the app root and read every color/spacing/font from `theme` props — never hard-code values a token already covers.',
      '- Co-locate styled components with the component that uses them; export shared primitives from a `ui/` module rather than redefining them.',
      '- Name styled components (`const Card = styled.div`) so they show up readably in the DevTools tree.',
      '- Keep dynamic styling in template interpolations driven by props/theme; avoid inline `style={}` for anything themeable.',
    ];
    if (a['styled-components.ssr'] === true)
      lines.push(
        '- Render through the SSR registry (`ServerStyleSheet` / framework registry) and enable the babel/SWC plugin so class names stay stable across server and client — otherwise hydration mismatches.',
      );
    return guidanceSection('Styling — Styled Components', lines);
  },
};
