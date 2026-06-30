import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';

export const windsurfProvider: AiProvider = {
  id: 'windsurf',
  displayName: 'Windsurf',
  knownArtifacts: ['.windsurfrules'],
  generate: (ctx) => [
    { path: '.windsurfrules', content: renderMarkdown('Windsurf Rules', ctx.sections) },
  ],
};
