import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Material UI (MUI) — keyed by the `stylingLibrary` answer value. */
export const mui: TechModule = {
  id: 'mui',
  title: 'Material UI (MUI)',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'mui',
  questions: () => [
    {
      id: 'mui.styling',
      type: 'select',
      summary: 'Styling API',
      message: 'How are MUI components customized?',
      options: [
        { value: 'sx-styled', label: 'sx prop + styled()', hint: 'recommended' },
        { value: 'theme-only', label: 'Theme overrides only' },
      ],
    },
  ],
  guidance: (a) => {
    const themeOnly = a['mui.styling'] === 'theme-only';
    const lines = [
      '- Centralize design decisions in a single `createTheme` (palette, typography, spacing) and wrap the app in one `ThemeProvider`; pull values from the theme, not literals.',
      themeOnly
        ? '- Customize components through `theme.components` `styleOverrides`/`defaultProps` so every instance stays consistent; avoid per-instance overrides.'
        : '- Tweak one-off instances with the `sx` prop and build reusable variants with `styled()`; promote a repeated `sx` into the theme once it recurs.',
      '- Compose UI from MUI components rather than re-styling raw HTML; reach for `sx` before writing separate CSS.',
      '- Use Grid/Stack and theme breakpoints for layout instead of hand-rolled media queries.',
    ];
    return guidanceSection('Styling — Material UI (MUI)', lines);
  },
};
