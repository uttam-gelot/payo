import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for Bootstrap — keyed by the `stylingLibrary` answer value. */
export const bootstrap: TechModule = {
  id: 'bootstrap',
  title: 'Bootstrap',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'bootstrap',
  questions: () => [
    {
      id: 'bootstrap.customize',
      type: 'select',
      summary: 'Customization',
      message: 'How is Bootstrap customized?',
      options: [
        { value: 'sass-vars', label: 'Sass variables (override + import)', hint: 'recommended' },
        { value: 'cdn-default', label: 'Default build / CDN, utilities only' },
      ],
    },
  ],
  guidance: (a) => {
    const sass = a['bootstrap.customize'] !== 'cdn-default';
    const lines = [
      '- Build layouts with the grid (`container`/`row`/`col-*`) and utility classes; avoid custom CSS for spacing/flex that a utility already provides.',
      sass
        ? '- Customize by overriding Sass variables before importing Bootstrap and pulling in only the needed components/utilities — do not override compiled classes with `!important`.'
        : '- Using the default build, layer customizations as a separate stylesheet loaded after Bootstrap; keep overrides minimal and scoped.',
      '- Prefer Bootstrap’s component markup/JS (modals, dropdowns, collapse) over re-implementing the same behavior.',
      '- Use responsive utility variants (`col-md-*`, `d-lg-flex`) instead of hand-written media queries.',
    ];
    return guidanceSection('Styling — Bootstrap', lines);
  },
};
