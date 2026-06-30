/**
 * Existing AI-config detection.
 *
 * Two concerns, both reading each provider's `knownArtifacts` (the registry is
 * the single source of truth):
 *
 *  - `scanExistingAiConfigs` — every AI-config artifact present on disk, across
 *    *all* tools. The overwrite guard unions this with the selected tool's own
 *    targets so a pre-existing config for a different tool is never clobbered
 *    silently (e.g. a CLAUDE.md when the user picked Antigravity).
 *  - `detectAiTool` — infer which tool the repo already uses, to pre-fill Q1.
 */
import fs from 'fs';
import path from 'path';
import { listProviders } from '../providers/index';
import type { AiTool } from '../types/index';

/** Project-relative paths of existing AI-config artifacts, across every tool. */
export function scanExistingAiConfigs(cwd: string = process.cwd()): string[] {
  const found = new Set<string>();
  for (const provider of listProviders()) {
    for (const rel of provider.knownArtifacts) {
      if (!found.has(rel) && fs.existsSync(path.join(cwd, rel))) found.add(rel);
    }
  }
  return [...found];
}

/**
 * Infer the AI tool a project already uses from its config artifacts, or
 * undefined when none are present. A provider identified by a path unique to it
 * wins; a path shared by several tools (AGENTS.md) only decides ties by
 * registration order — so a bare AGENTS.md resolves to Codex, while an
 * `.agents/skills/` dir resolves to Antigravity.
 */
export function detectAiTool(cwd: string = process.cwd()): AiTool | undefined {
  const providers = listProviders();

  // How many providers claim each artifact path — >1 means it can't identify one tool.
  const claims = new Map<string, number>();
  for (const provider of providers) {
    for (const rel of provider.knownArtifacts) claims.set(rel, (claims.get(rel) ?? 0) + 1);
  }

  let sharedMatch: AiTool | undefined;
  for (const provider of providers) {
    const present = provider.knownArtifacts.filter((rel) => fs.existsSync(path.join(cwd, rel)));
    if (present.length === 0) continue;
    if (present.some((rel) => (claims.get(rel) ?? 0) === 1)) return provider.id;
    if (sharedMatch === undefined) sharedMatch = provider.id;
  }
  return sharedMatch;
}
