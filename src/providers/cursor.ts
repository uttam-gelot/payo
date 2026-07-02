import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';
import { renderFrontmatter } from '../generator/frontmatter';

export const cursorProvider: AiProvider = {
  id: 'cursor',
  displayName: 'Cursor',
  knownArtifacts: ['.cursorrules', '.cursor/rules'],
  generate: (ctx) => [
    { path: '.cursorrules', content: renderMarkdown('Cursor Rules', ctx.sections) },
  ],
  agent: {
    binary: 'cursor-agent',
    // --output-format text keeps stdout clean; --force allows file writes.
    buildArgs: (p) => ['-p', p, '--force', '--output-format', 'text'],
    outputPath: (id) => `.cursor/rules/${id}.mdc`,
    // Cursor auto-attaches a rule via its `.mdc` frontmatter: `description`
    // (for agent-requested rules), `globs` (glob-attach), `alwaysApply`.
    frontmatter: (skill) =>
      renderFrontmatter([
        ['description', skill.description],
        ['globs', '**/*'],
        ['alwaysApply', false],
      ]),
  },
};
