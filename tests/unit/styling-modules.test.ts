import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index';
import { getModule } from '../../src/stack/registry';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const md = (a: Answers): string => renderMarkdown('G', buildBaseRules(a));

describe('styling modules', () => {
  const stylingIds = [
    'tailwind',
    'shadcn',
    'css-modules',
    'styled-components',
    'emotion',
    'mui',
    'mantine',
    'chakra',
    'antd',
    'unocss',
    'panda',
    'bootstrap',
    'daisyui',
    'vanilla-css',
  ];

  it('registers the styling modules under their answer-value ids', () => {
    for (const id of stylingIds) {
      expect(getModule(id)?.category).toBe('styling');
    }
  });

  it('expose no selectable options (lists stay in stylingOptions)', () => {
    for (const id of stylingIds) {
      expect(typeof getModule(id)?.options).toBe('undefined');
    }
  });

  it('emits a Tailwind guidance section when stylingLibrary=tailwind', () => {
    const out = md({ ...contexts.tsFullstack, stylingLibrary: 'tailwind' });
    expect(out).toContain('## Styling — Tailwind CSS');
    expect(out).toContain('utility classes');
  });

  it('emits a shadcn guidance section referencing the chosen component dir', () => {
    const out = md({
      ...contexts.tsFullstack,
      stylingLibrary: 'shadcn',
      'shadcn.dir': 'app-components',
    });
    expect(out).toContain('## Styling — shadcn/ui');
    expect(out).toContain('app/components/ui');
  });

  it('emits a Material UI guidance section when stylingLibrary=mui', () => {
    const out = md({ ...contexts.tsFullstack, stylingLibrary: 'mui' });
    expect(out).toContain('## Styling — Material UI (MUI)');
    expect(out).toContain('createTheme');
  });

  it('contributes nothing for the none styling option', () => {
    const out = md({ ...contexts.tsFullstack, stylingLibrary: 'none' });
    expect(out).not.toContain('## Styling — ');
  });
});
