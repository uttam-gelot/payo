import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';
import { renderFrontmatter } from '../generator/frontmatter';

export const copilotProvider: AiProvider = {
  id: 'copilot',
  displayName: 'GitHub Copilot',
  knownArtifacts: ['.github/copilot-instructions.md', '.github/instructions'],
  generate: (ctx) => [
    {
      path: '.github/copilot-instructions.md',
      content: renderMarkdown('Copilot Instructions', ctx.sections),
    },
  ],
  agent: {
    binary: 'copilot',
    // -s silences session metadata; --no-ask-user keeps it non-interactive.
    // --allow-tool write auto-approves file edits only — shell and other tools
    // stay denied, so prompt-injected content cannot execute commands.
    buildArgs: (p) => ['-p', p, '-s', '--no-ask-user', '--allow-tool', 'write'],
    outputPath: (id) => `.github/instructions/${id}.instructions.md`,
    // Copilot scopes an `.instructions.md` file via its `applyTo` glob; without
    // it the file's applicability is version-dependent. `**` = the whole repo.
    frontmatter: (skill) =>
      renderFrontmatter([
        ['description', skill.description],
        ['applyTo', '**'],
      ]),
  },
};
