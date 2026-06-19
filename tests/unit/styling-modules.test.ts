import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index';
import { getModule } from '../../src/stack/registry';
import { buildBaseRules, renderMarkdown } from '../../src/generator/rules';
import { contexts } from '../fixtures';
import type { Answers } from '../../src/questions/types';

const md = (a: Answers): string => renderMarkdown('G', buildBaseRules(a));

describe('styling modules', () => {
  it('registers the styling modules under their answer-value ids', () => {
    for (const id of ['tailwind', 'shadcn', 'css-modules']) {
      expect(getModule(id)?.category).toBe('styling');
    }
  });

  it('expose no selectable options (lists stay in stylingOptions)', () => {
    for (const id of ['tailwind', 'shadcn', 'css-modules']) {
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

  it('contributes nothing for an unbacked styling option (e.g. mui)', () => {
    const out = md({ ...contexts.tsFullstack, stylingLibrary: 'mui' });
    expect(out).not.toContain('## Styling — ');
    expect(out).toContain('- Styling: mui');
  });
});
