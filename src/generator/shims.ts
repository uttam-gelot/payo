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

/**
 * The only tools that do NOT read `.agents/skills/` natively, mapped to the
 * project dir each one discovers skills in. Every other supported tool reads the
 * universal `.agents/skills/` directly, so it needs no shim. Selecting such a
 * tool for support is a no-op here — see `shimRootsForTools`.
 */
export const SHIM_TOOLS: Record<string, string> = {
  claude: '.claude/skills',
  windsurf: '.windsurf/skills',
};

/** The shim roots to write for the given support-tool selection, in order. */
export function shimRootsForTools(tools?: string[]): string[] {
  const order = Object.keys(SHIM_TOOLS);
  // Undefined ⇒ all roots (back-compat for programmatic callers/tests); an
  // explicit list ⇒ only the selected tools that actually need a shim.
  const wanted = tools ? order.filter((id) => tools.includes(id)) : order;
  return wanted.map((id) => SHIM_TOOLS[id]);
}

/** One shim `<root>/<id>` and how it was materialized. */
export interface ShimResult {
  path: string;
  mode: 'symlink' | 'copy';
}

/**
 * Create (or refresh) the shim entries for `skillIds` under the shim roots the
 * `tools` selection calls for (all roots when `tools` is undefined). Skills whose
 * source dir is absent (e.g. a static run that wrote no per-skill file) are
 * skipped. Returns the shims actually created.
 */
export function createSkillShims(skillIds: string[], tools?: string[]): ShimResult[] {
  const results: ShimResult[] = [];
  for (const root of shimRootsForTools(tools)) {
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
