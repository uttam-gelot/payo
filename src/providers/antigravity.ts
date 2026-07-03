import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';
import { renderFrontmatter } from '../generator/frontmatter';

export const antigravityProvider: AiProvider = {
  id: 'antigravity',
  displayName: 'Antigravity (Google)',
  knownArtifacts: ['AGENTS.md', '.agents/skills'],
  generate: (ctx) => [
    { path: 'AGENTS.md', content: renderMarkdown('Project Guide for Antigravity', ctx.sections) },
  ],
  agent: {
    binary: 'agy',
    // -p/--print runs one headless prompt; --dangerously-skip-permissions
    // auto-approves tool calls so file writes happen without interactive prompts.
    buildArgs: (p) => ['-p', p, '--dangerously-skip-permissions'],
    outputPath: (id) => `.agents/skills/${id}.md`,
    // Skill metadata frontmatter so the file is discoverable as a named skill.
    frontmatter: (skill) =>
      renderFrontmatter([
        ['name', skill.id],
        ['description', skill.description],
      ]),
  },
};
