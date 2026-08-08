/**
 * Zed's instruction-file precedence.
 *
 * Zed reads exactly ONE project instruction file — the first that exists from a
 * fixed 9-entry chain — and ignores the rest. Payo's entrypoint, `AGENTS.md`, is
 * 7th, so any of the six higher-priority files silently shadows everything Payo
 * generated.
 *
 * This module only warns. Unlike `legacy.ts`, nothing here is deleted: Payo never
 * wrote `.rules`, `.clinerules`, or `AGENT.md`, and removing another tool's config
 * is not Payo's call. The three entries that Payo *can* clean up are already in
 * LEGACY_ARTIFACTS, which is why the CLI runs this check after the cleanup prompt.
 */
import fs from 'fs';
import { resolveContained } from './paths';

/**
 * The files Zed reads *before* `AGENTS.md`, in Zed's own precedence order.
 * Deliberately stops at `AGENT.md`: everything below AGENTS.md in the chain
 * (`CLAUDE.md`, `GEMINI.md`) loses to it and shadows nothing.
 */
export const ZED_SHADOWS_AGENTS: readonly string[] = [
  '.rules',
  '.cursorrules',
  '.windsurfrules',
  '.clinerules',
  '.github/copilot-instructions.md',
  'AGENT.md',
];

/**
 * One warning per shadowing file present in the project, in precedence order.
 * Empty unless Zed is among the supported tools — an undefined `tools` means the
 * user never answered the support question, so no Zed-specific advice applies.
 */
export function zedShadowWarnings(tools?: string[]): string[] {
  if (!tools?.includes('zed')) return [];
  return ZED_SHADOWS_AGENTS.filter((rel) => fs.existsSync(resolveContained(rel))).map(
    (rel) =>
      `${rel} — Zed reads this instead of AGENTS.md; delete it or fold its rules into AGENTS.md`,
  );
}
