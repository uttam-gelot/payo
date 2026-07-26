import type { AiProvider } from '../generator/types';

export const antigravityProvider: AiProvider = {
  id: 'antigravity',
  displayName: 'Antigravity (Google)',
  knownArtifacts: ['AGENTS.md', '.agents/skills'],
  agent: {
    binary: 'agy',
    // -p/--print runs one headless prompt; --dangerously-skip-permissions
    // auto-approves tool calls so file writes happen without interactive prompts.
    // --sandbox re-restricts the terminal, so the auto-approval cannot be
    // steered into running shell commands by prompt-injected content.
    // --add-dir pins the workspace to this project: with no active workspace agy
    // writes into its own scratch dir (~/.gemini/antigravity-cli/scratch) and
    // still exits 0, so payo sees no file. Gated on the flag existing, since
    // pre-workspace builds of agy do not have it.
    buildArgs: (p, caps) => [
      '-p',
      p,
      ...(caps?.supports('--add-dir') ? ['--add-dir', process.cwd()] : []),
      '--dangerously-skip-permissions',
      '--sandbox',
    ],
  },
};
