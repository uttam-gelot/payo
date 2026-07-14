/**
 * Universal writer core: path/frontmatter invariants and entrypoint/shim shape.
 * These guard the Agent Skills spec requirements the old per-tool layout broke —
 * chiefly that the skill's directory name equals its `name` frontmatter field.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AGENTS_ENTRYPOINT,
  CLAUDE_SHIM,
  SKILLS_ROOT,
  skillPath,
  universalFrontmatter,
  writeAgentsEntrypoint,
  writeClaudeShim,
  writeStaticSkill,
} from '../../src/generator/universal';
import { selectSkills } from '../../src/generator/skills';
import { buildBaseRules } from '../../src/generator/rules';
import { fullStackAnswers } from '../fixtures';
import { inTempProject } from '../helpers/tmpProject';

describe('skillPath', () => {
  test('nests SKILL.md under a directory named for the id', () => {
    expect(skillPath('api-conventions')).toBe(`${SKILLS_ROOT}/api-conventions/SKILL.md`);
  });
});

describe('universalFrontmatter', () => {
  const [skill] = selectSkills(fullStackAnswers());

  test('name equals the skill id (== its directory name)', () => {
    const fm = universalFrontmatter(skill);
    expect(fm).toContain(`name: "${skill.id}"`);
    // The directory segment must match the name field or the skill is inert.
    const segments = skillPath(skill.id).split('/');
    expect(segments[segments.length - 2]).toBe(skill.id);
  });

  test('carries description and nests custom fields under metadata (spec-only top level)', () => {
    const fm = universalFrontmatter(skill);
    expect(fm).toContain('description:');
    expect(fm).toContain('metadata:');
    expect(fm).toContain('  generator: payo');
    // No tool-specific top-level keys that could trip a strict validator.
    expect(fm).not.toContain('globs:');
    expect(fm).not.toContain('applyTo:');
    expect(fm).not.toContain('alwaysApply:');
  });

  test('opens and closes with the YAML delimiter', () => {
    const fm = universalFrontmatter(skill);
    expect(fm.startsWith('---\n')).toBe(true);
    expect(fm.endsWith('\n---')).toBe(true);
  });
});

describe('writeStaticSkill', () => {
  test('writes SKILL.md with frontmatter then the supplied body', async () => {
    await inTempProject((dir) => {
      const [skill] = selectSkills(fullStackAnswers());
      const rel = writeStaticSkill(skill, 'Use strict mode everywhere.');
      expect(rel).toBe(skillPath(skill.id));
      const content = readFileSync(join(dir, rel), 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      expect(content).toContain(`# ${skill.title}`);
      expect(content).toContain('Use strict mode everywhere.');
    });
  });
});

describe('writeAgentsEntrypoint', () => {
  test('writes AGENTS.md with base rules and a skills index', async () => {
    await inTempProject((dir) => {
      const answers = fullStackAnswers();
      const sections = buildBaseRules(answers);
      const generated = selectSkills(answers).map((s) => ({
        title: s.title,
        description: s.description,
        path: skillPath(s.id),
      }));
      const rel = writeAgentsEntrypoint(sections, generated);
      expect(rel).toBe(AGENTS_ENTRYPOINT);
      const content = readFileSync(join(dir, rel), 'utf-8');
      expect(content).toContain('## Skills');
      expect(content).toContain(generated[0].path);
      expect(content).toContain('## Authentication');
      // The index must be preceded by a directive to follow the skills.
      expect(content).toContain('consult the skills below and follow the ones that apply');
    });
  });

  test('omits the Skills section when nothing was generated', async () => {
    await inTempProject((dir) => {
      writeAgentsEntrypoint(buildBaseRules(fullStackAnswers()), []);
      const content = readFileSync(join(dir, AGENTS_ENTRYPOINT), 'utf-8');
      expect(content).not.toContain('## Skills');
    });
  });
});

describe('writeClaudeShim', () => {
  test('imports AGENTS.md', async () => {
    await inTempProject((dir) => {
      const rel = writeClaudeShim();
      expect(rel).toBe(CLAUDE_SHIM);
      const content = readFileSync(join(dir, rel), 'utf-8');
      expect(content).toContain('@AGENTS.md');
    });
  });
});
