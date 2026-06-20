import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for daisyUI — keyed by the `stylingLibrary` answer value. */
export const daisyui: TechModule = {
  id: 'daisyui',
  title: 'daisyUI',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'daisyui',
  questions: () => [
    {
      id: 'daisyui.themes',
      type: 'confirm',
      summary: 'Built-in themes',
      message: 'Use daisyUI built-in themes (data-theme switching)?',
      recommended: true,
    },
  ],
  guidance: (a) => {
    const lines = [
      '- daisyUI is a Tailwind plugin: build UI from its component classes (`btn`, `card`, `modal`) and refine with Tailwind utilities — keep one consistent approach.',
      '- Use daisyUI semantic color classes (`bg-primary`, `text-base-content`) instead of raw Tailwind palette colors so themes apply automatically.',
      '- Enable the plugin in the Tailwind config and list only the themes/components you use to keep CSS small.',
      '- Reach for plain Tailwind utilities for layout/spacing; use daisyUI for the component skin.',
    ];
    if (a['daisyui.themes'] === true)
      lines.push(
        '- Switch themes by setting `data-theme` on a root element (not by editing component classes); define enabled themes in the config.',
      );
    return guidanceSection('Styling — daisyUI', lines);
  },
};
