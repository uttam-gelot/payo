import path from 'path';
import type { AiProvider } from '../generator/types';
import { SKILLS_ROOT } from '../generator/universal';

/**
 * codex's workspace-write sandbox covers the workspace but denies writes to
 * dot-directories inside it, so `.agents/skills/**` is EPERM ("Operation not
 * permitted") and the run ends 0 having written nothing. Naming the dot-root as
 * an extra writable root re-allows exactly that subtree and nothing else. It has
 * to be `.agents` rather than `.agents/skills`: a writable root may be created
 * by the agent, but its still-read-only parent may not, so a deeper root breaks
 * on a project that has no `.agents/` yet. TOML basic strings take JSON's
 * escaping, so JSON.stringify quotes the path.
 */
const writableRootsOverride = (): string => {
  const [dotRoot] = SKILLS_ROOT.split('/');
  return `sandbox_workspace_write.writable_roots=[${JSON.stringify(
    path.join(process.cwd(), dotRoot),
  )}]`;
};

export const codexProvider: AiProvider = {
  id: 'codex',
  displayName: 'Codex CLI',
  knownArtifacts: ['AGENTS.md'],
  agent: {
    binary: 'codex',
    helpArgs: ['exec', '--help'],
    // Newer codex runs `exec` in a read-only sandbox and refuses to start outside
    // a git repo, so a bare `codex exec` exits 0 having written nothing.
    // workspace-write is the narrowest policy that lets it author files (still
    // confined to cwd). Both flags are gated on the installed CLI advertising
    // them: older versions wrote files by default and abort on unknown argv.
    buildArgs: (p, caps) => [
      'exec',
      ...(caps?.supports('--sandbox')
        ? ['--sandbox', 'workspace-write', '--config', writableRootsOverride()]
        : []),
      ...(caps?.supports('--skip-git-repo-check') ? ['--skip-git-repo-check'] : []),
      p,
    ],
  },
};
