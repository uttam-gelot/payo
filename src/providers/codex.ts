import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';

export const codexProvider: AiProvider = {
  id: 'codex',
  displayName: 'Codex CLI',
  knownArtifacts: ['AGENTS.md'],
  generate: (ctx) => [{ path: 'AGENTS.md', content: renderMarkdown('Agent Guide', ctx.sections) }],
  agent: {
    binary: 'codex',
    buildArgs: (p) => ['exec', p],
    // Codex reads one master AGENTS.md, so skills are staged in parallel and
    // merged into it (singleFile); outputPath names that master target.
    singleFile: true,
    outputPath: () => 'AGENTS.md',
  },
};
