import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';

export const cursorProvider: AiProvider = {
  id: 'cursor',
  displayName: 'Cursor',
  generate: (ctx) => [
    { path: '.cursorrules', content: renderMarkdown('Cursor Rules', ctx.sections) },
  ],
  agent: {
    binary: 'cursor-agent',
    // --output-format text keeps stdout clean; --force allows file writes.
    buildArgs: (p) => ['-p', p, '--force', '--output-format', 'text'],
    outputPath: (id) => `.cursor/rules/${id}.mdc`,
  },
};
