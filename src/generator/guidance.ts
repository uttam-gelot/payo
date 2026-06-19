/**
 * Collects provider-specific rule sections from the selected stack modules.
 * Mirrors `resolveCommands` (commands.ts): pure, deterministic, driven entirely
 * by the collected answers. A module that defines no `guidance()` contributes
 * nothing, so unbacked options stay silent.
 *
 * Modules are keyed by their selected answer value (framework/orm/database/
 * stylingLibrary/authApproach) — the same ids `expandSelected` resolves.
 */
import type { Answers } from '../questions/types';
import type { RuleSection } from './types';
import { getModule } from '../stack/registry';

/** The guidance sections contributed by the answers' selected modules. */
export function resolveGuidance(a: Answers): RuleSection[] {
  const selected = [a.framework, a.orm, a.database, a.stylingLibrary, a.authApproach];
  return selected.flatMap((id) => getModule(id)?.guidance?.(a) ?? []);
}
