/**
 * Discovery shims for the two tools that do NOT read `.agents/skills/` natively:
 * Claude Code (`.claude/skills/`) and Windsurf (`.windsurf/skills/`). For each
 * generated skill we create `<root>/<id>` pointing at `../../.agents/skills/<id>`
 * so both tools discover the exact same SKILL.md with no duplicated content.
 *
 * Preferred mechanism is a relative symlink (Claude Code officially supports and
 * dedupes symlinked skill dirs). Where symlinks are unavailable — Windows without
 * Developer Mode raises EPERM — we fall back to a recursive directory copy. Both
 * paths are idempotent: any stale link/copy is removed first, so a re-run
 * self-heals copy drift.
 */
import fs from 'fs';
import path from 'path';
import { resolveContained } from './paths';
import { SKILLS_ROOT } from './universal';

/** Project dirs that need a shim per skill, in the order they're created. */
export const SHIM_ROOTS = ['.claude/skills', '.windsurf/skills'] as const;

/** One shim `<root>/<id>` and how it was materialized. */
export interface ShimResult {
  path: string;
  mode: 'symlink' | 'copy';
}

/**
 * Create (or refresh) the shim entries for `skillIds` under every SHIM_ROOT.
 * Skills whose source dir is absent (e.g. a static run that wrote no per-skill
 * file) are skipped. Returns the shims actually created.
 */
export function createSkillShims(skillIds: string[]): ShimResult[] {
  const results: ShimResult[] = [];
  for (const root of SHIM_ROOTS) {
    for (const id of skillIds) {
      const sourceRel = `${SKILLS_ROOT}/${id}`;
      if (!fs.existsSync(resolveContained(sourceRel))) continue;
      const linkRel = `${root}/${id}`;
      const linkAbs = resolveContained(linkRel);
      fs.mkdirSync(path.dirname(linkAbs), { recursive: true });
      // Clear any prior link or copy so both branches stay idempotent.
      fs.rmSync(linkAbs, { recursive: true, force: true });

      // Relative target: up out of `<root>` (two segments) back to repo root,
      // then into the canonical skill dir. Keeps the link valid if the repo moves.
      const target = path.join('..', '..', SKILLS_ROOT, id);
      try {
        fs.symlinkSync(target, linkAbs, 'dir');
        results.push({ path: linkRel, mode: 'symlink' });
      } catch {
        // Symlinks unavailable (e.g. Windows w/o Developer Mode): copy instead.
        fs.cpSync(resolveContained(sourceRel), linkAbs, { recursive: true });
        results.push({ path: linkRel, mode: 'copy' });
      }
    }
  }
  return results;
}
