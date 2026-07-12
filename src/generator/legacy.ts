/**
 * Retired per-tool artifacts. Before the universal layout, Payo (and other
 * tools) wrote these tool-specific files; the universal `AGENTS.md` +
 * `.agents/skills/` tree now supersedes them. They are still listed on each
 * provider's `knownArtifacts` for *detection*, but as output they are dead —
 * so on a regen we offer to remove any that linger, to avoid two sources of
 * truth drifting apart.
 *
 * Deliberately excludes the current universal targets (`AGENTS.md`, `CLAUDE.md`,
 * `.agents/skills`, `.claude/skills`, `.windsurf/skills`) — those are written,
 * not cleaned.
 */
import fs from 'fs';
import { resolveContained } from './paths';

/** Project-relative files/dirs the universal layout replaces. */
export const LEGACY_ARTIFACTS: readonly string[] = [
  '.cursorrules',
  '.windsurfrules',
  '.cursor/rules',
  '.github/copilot-instructions.md',
  '.github/instructions',
  'AI_RULES.md',
];

/** The legacy artifacts that actually exist in the project, in declared order. */
export function findLegacyArtifacts(): string[] {
  return LEGACY_ARTIFACTS.filter((rel) => fs.existsSync(resolveContained(rel)));
}

/** Delete the given legacy artifacts (files or dirs); returns the ones removed. */
export function removeLegacyArtifacts(relPaths: string[]): string[] {
  const removed: string[] = [];
  for (const rel of relPaths) {
    const abs = resolveContained(rel);
    if (!fs.existsSync(abs)) continue;
    fs.rmSync(abs, { recursive: true, force: true });
    removed.push(rel);
  }
  return removed;
}
