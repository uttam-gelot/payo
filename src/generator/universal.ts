/**
 * The universal output layout. Regardless of which agent CLI authored the
 * content, Payo emits ONE canonical tree that every skills-compatible tool can
 * read:
 *
 *   AGENTS.md                     — entrypoint (base rules + skills index)
 *   CLAUDE.md                     — shim that imports AGENTS.md for Claude Code
 *   .agents/skills/<id>/SKILL.md  — one Agent Skills spec file per skill
 *
 * The two tools that do not read `.agents/skills/` (Claude Code, Windsurf) are
 * covered by directory shims — see ./shims.
 *
 * Frontmatter is deliberately spec-only (`name`, `description`, `metadata`): a
 * strict validator in any consuming tool must accept every SKILL.md we write, so
 * no tool-specific top-level keys (Cursor `globs`, Copilot `applyTo`, …) appear.
 */
import type { RuleSection } from './types';
import type { SkillSpec } from './skills';
import { renderFrontmatter } from './frontmatter';
import { renderMarkdown } from './rules';
import { writeArtifact } from './paths';
import pkg from '../../package.json';

/** The tool-agnostic entrypoint every AGENTS.md-aware tool reads by default. */
export const AGENTS_ENTRYPOINT = 'AGENTS.md';
/** Claude Code shim — imports the entrypoint so its content lands there too. */
export const CLAUDE_SHIM = 'CLAUDE.md';
/** Root of the Agent Skills tree read natively by Codex, Cursor, Copilot, … */
export const SKILLS_ROOT = '.agents/skills';

/**
 * Project-relative path of a skill's spec file. The `<id>` directory name MUST
 * equal the `name` frontmatter field (see `universalFrontmatter`) or the skill
 * is undiscoverable — this is the invariant the old flat-file layout violated.
 */
export function skillPath(id: string): string {
  return `${SKILLS_ROOT}/${id}/SKILL.md`;
}

/**
 * Spec frontmatter for a skill: `name` (== its directory), `description` (drives
 * activation), and a `metadata` block for Payo's own marker. Custom fields live
 * under `metadata` because the spec sanctions only that for non-standard keys.
 */
export function universalFrontmatter(skill: SkillSpec): string {
  const base = renderFrontmatter([
    ['name', skill.id],
    ['description', skill.description],
  ]);
  const metadata = ['metadata:', '  generator: payo', `  payo-version: "${pkg.version}"`].join(
    '\n',
  );
  // Insert the nested metadata block before the closing delimiter.
  return base.replace(/\n---$/, `\n${metadata}\n---`);
}

/** Details the entrypoint needs to index one generated skill. */
export interface SkillIndexEntry {
  title: string;
  description: string;
  path: string;
}

/**
 * Write the universal `AGENTS.md`: the deterministic base rules plus an index of
 * the skills this run generated (so a reader knows the `.agents/skills/` files
 * exist and when each applies). Replaces the former per-provider entrypoint.
 */
export function writeAgentsEntrypoint(
  sections: RuleSection[],
  generated: SkillIndexEntry[],
): string {
  const rules = renderMarkdown('Project Guide', sections).trimEnd();
  const index = generated
    .map((s) => `- **${s.title}** — \`${s.path}\`: ${s.description}`)
    .join('\n');
  // The index alone only tells a reader the skills exist; this directive tells
  // the agent to actually consult and obey the applicable ones before working.
  const directive =
    'Before writing or changing code in this project, consult the skills below and ' +
    'follow the ones that apply. Each skill file states when it applies; load it and ' +
    'obey its rules for any matching work.';
  const body = index ? `${rules}\n\n## Skills\n\n${directive}\n\n${index}\n` : `${rules}\n`;
  writeArtifact({ path: AGENTS_ENTRYPOINT, content: body });
  return AGENTS_ENTRYPOINT;
}

/**
 * Write the `CLAUDE.md` shim. Claude Code does not read `AGENTS.md` natively but
 * expands an `@AGENTS.md` import at load time, so this one line routes the
 * entrypoint content into Claude Code with zero duplication or drift.
 */
export function writeClaudeShim(): string {
  const content = [
    '@AGENTS.md',
    '',
    '<!-- Payo: this file imports the universal AGENTS.md entrypoint. Edit AGENTS.md, not this shim. -->',
    '',
  ].join('\n');
  writeArtifact({ path: CLAUDE_SHIM, content });
  return CLAUDE_SHIM;
}

/**
 * Write a skill's SKILL.md deterministically from a finished markdown body — the
 * no-CLI floor. The body must be presentation content (not an agent prompt); the
 * caller supplies it (e.g. the matching `buildBaseRules` section). Spec
 * frontmatter and the title heading are added here so the file is discoverable.
 */
export function writeStaticSkill(skill: SkillSpec, body: string): string {
  const rel = skillPath(skill.id);
  const content = `${universalFrontmatter(skill)}\n\n# ${skill.title}\n\n${body.trim()}\n`;
  writeArtifact({ path: rel, content });
  return rel;
}
