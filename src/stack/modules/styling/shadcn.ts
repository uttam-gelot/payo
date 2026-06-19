import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for shadcn/ui — keyed by the `stylingLibrary` answer value. */
export const shadcn: TechModule = {
  id: 'shadcn',
  title: 'shadcn/ui',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'shadcn',
  questions: () => [
    {
      id: 'shadcn.dir',
      type: 'select',
      summary: 'Component directory',
      message: 'Where do shadcn components live?',
      options: [
        { value: 'components-ui', label: 'components/ui', hint: 'recommended' },
        { value: 'app-components', label: 'app/components/ui' },
        { value: 'custom', label: 'Custom path (per components.json)' },
      ],
    },
    {
      id: 'shadcn.theming',
      type: 'select',
      summary: 'Theming',
      message: 'Theming approach?',
      options: [
        { value: 'css-vars', label: 'CSS variables (light/dark via tokens)', hint: 'recommended' },
        { value: 'utility', label: 'Utility classes only' },
      ],
    },
  ],
  guidance: (a) => {
    const dir =
      a['shadcn.dir'] === 'app-components'
        ? 'app/components/ui'
        : a['shadcn.dir'] === 'custom'
          ? 'the path configured in components.json'
          : 'components/ui';
    const lines = [
      `- Add components with the shadcn CLI (\`npx shadcn@latest add <name>\`); generated files land in ${dir}.`,
      '- shadcn components are copied into the repo and owned by you — edit them in place; do not treat them as an upstream dependency.',
      '- Compose app UI from these primitives; do not reinstall a component that already exists.',
      '- Keep the `cn()` helper (clsx + tailwind-merge) as the single class-merging utility.',
    ];
    lines.push(
      a['shadcn.theming'] === 'utility'
        ? '- Theme via utility classes directly on components.'
        : '- Drive theming through CSS variables (the generated `:root` / `.dark` tokens); switch themes by toggling the class, not by editing components.',
    );
    return guidanceSection('Styling — shadcn/ui', lines);
  },
};
