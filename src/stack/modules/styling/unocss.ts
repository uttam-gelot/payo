import type { TechModule } from '../../types';
import { guidanceSection } from '../section';

/** Styling module for UnoCSS — keyed by the `stylingLibrary` answer value. */
export const unocss: TechModule = {
  id: 'unocss',
  title: 'UnoCSS',
  category: 'styling',
  appliesTo: (a) => a.stylingLibrary === 'unocss',
  questions: () => [
    {
      id: 'unocss.preset',
      type: 'select',
      summary: 'Preset',
      message: 'Primary UnoCSS preset?',
      options: [
        { value: 'wind', label: 'preset-wind (Tailwind/Windi compatible)', hint: 'recommended' },
        { value: 'uno', label: 'preset-uno (default)' },
        { value: 'attributify', label: 'preset-attributify + wind' },
      ],
    },
  ],
  guidance: (a) => {
    const attributify = a['unocss.preset'] === 'attributify';
    const lines = [
      '- Configure presets, theme, and custom rules in one `uno.config.ts`; pull spacing/colors from the theme rather than arbitrary values.',
      '- Style with atomic utility classes in markup; reach for a `shortcut` only when a utility cluster repeats — define shortcuts in the config, not ad hoc.',
      attributify
        ? '- With attributify mode, group related utilities into attributes (`text="lg blue"`); keep one consistent style (attribute vs class) per project.'
        : '- Keep the chosen preset’s utility vocabulary consistent; avoid mixing equivalent utilities from different presets.',
      '- Lean on on-demand generation — unused utilities cost nothing — but keep dynamic class names safelisted so they are not purged.',
    ];
    return guidanceSection('Styling — UnoCSS', lines);
  },
};
