import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Panda CSS — keyed by the `stylingLibrary` answer value. */
export const panda: TechModule = {
  id: 'panda',
  title: 'Panda CSS',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'panda',
  questions: () => [
    {
      id: 'panda.api',
      type: 'select',
      summary: 'Authoring API',
      message: 'Primary Panda authoring API?',
      options: [
        { value: 'css-fn', label: 'css() function + patterns', hint: 'recommended' },
        { value: 'jsx-styled', label: 'styled JSX factory (styled.div)' },
      ],
    },
  ],
  guidance: (a) => {
    const jsx = a['panda.api'] === 'jsx-styled';
    const lines = [
      '- Define tokens, semantic tokens, and recipes in `panda.config.ts`; every value comes from a token — Panda generates static CSS at build time, so arbitrary values defeat the system.',
      jsx
        ? '- Author with the `styled` JSX factory and `cva`/`sva` recipes for variants; keep variant logic in recipes, not inline conditionals.'
        : '- Author with the `css()` function and layout `patterns` (stack, grid); extract repeated style objects into `cva` recipes.',
      '- Run `panda codegen` after config changes and commit the generated `styled-system` (or keep it git-ignored consistently) — keep it in sync with the config.',
      '- Use semantic/conditional tokens for theming so color modes resolve from tokens, not branched styles.',
    ];
    return guidanceSection('Styling — Panda CSS', lines);
  },
};
