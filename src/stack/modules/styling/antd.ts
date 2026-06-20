import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Ant Design — keyed by the `stylingLibrary` answer value. */
export const antd: TechModule = {
  id: 'antd',
  title: 'Ant Design',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'antd',
  questions: () => [
    {
      id: 'antd.theming',
      type: 'select',
      summary: 'Theming',
      message: 'How is Ant Design themed?',
      options: [
        { value: 'config-provider', label: 'ConfigProvider design tokens', hint: 'recommended' },
        { value: 'css-override', label: 'CSS / className overrides' },
      ],
    },
  ],
  guidance: (a) => {
    const tokens = a['antd.theming'] !== 'css-override';
    const lines = [
      '- Compose UI from antd components and their props; do not re-implement controls antd already ships.',
      tokens
        ? '- Theme via `ConfigProvider` `theme.token`/`components` (CSS-in-JS design tokens); avoid overriding antd internals with global CSS.'
        : '- Limit CSS overrides to documented class hooks and keep them scoped; prefer token/`ConfigProvider` config where one exists.',
      '- Use the Form component’s controlled state and validation rules rather than wiring inputs by hand.',
      '- Keep layout on antd `Layout`/`Grid` (`Row`/`Col`) with its responsive props instead of custom breakpoints.',
    ];
    return guidanceSection('Styling — Ant Design', lines);
  },
};
