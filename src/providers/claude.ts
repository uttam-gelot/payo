import type { AiProvider } from '../generator/types';
import { renderMarkdown } from '../generator/rules';
import { renderFrontmatter } from '../generator/frontmatter';

export const claudeProvider: AiProvider = {
  id: 'claude',
  displayName: 'Claude (Anthropic)',
  knownArtifacts: ['CLAUDE.md', '.claude/skills'],
  generate: (ctx) => [
    { path: 'CLAUDE.md', content: renderMarkdown('Project Guide for Claude', ctx.sections) },
  ],
  agent: {
    binary: 'claude',
    // Headless writes require bypassPermissions: acceptEdits still prompts on new-file
    // creation, and -p has no interactive approver, so files never get written otherwise.
    // The Write/Edit allowlist (space-separated — it is variadic) constrains the bypassed
    // agent to file writes, so it cannot run arbitrary bash.
    buildArgs: (p) => [
      '-p',
      p,
      '--allowedTools',
      'Write',
      'Edit',
      '--permission-mode',
      'bypassPermissions',
    ],
    outputPath: (id) => `.claude/skills/${id}/SKILL.md`,
    // Claude Code discovers a skill only when SKILL.md opens with YAML
    // frontmatter carrying `name` and `description`. Without it the file is inert.
    frontmatter: (skill) =>
      renderFrontmatter([
        ['name', skill.id],
        ['description', skill.description],
      ]),
  },
};
