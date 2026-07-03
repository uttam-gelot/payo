/**
 * YAML frontmatter helpers shared by the providers that require it. Providers
 * declare `frontmatter(skill)` on their AgentRunner; the generator injects the
 * block into the agent prompt and guarantees it deterministically after the
 * write (see `ensureFrontmatter` in generator/index.ts).
 */

/** Double-quote a scalar so `:`, `#`, apostrophes, etc. can't break the YAML. */
function yamlString(v: string): string {
  return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * Render a `---`-delimited YAML block from ordered key/value pairs. String
 * values are quoted; booleans are emitted bare (so `alwaysApply: false` stays a
 * boolean, not the string "false").
 */
export function renderFrontmatter(fields: Array<[string, string | boolean]>): string {
  const body = fields
    .map(([k, v]) => `${k}: ${typeof v === 'boolean' ? String(v) : yamlString(v)}`)
    .join('\n');
  return `---\n${body}\n---`;
}
