import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';

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
  },
};
