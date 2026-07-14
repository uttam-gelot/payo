/**
 * The detection tier split (see STACK_DETECTION_RND.md §7).
 *
 * Tier 1 — stack facts a manifest can authoritatively answer. Safe to
 * confirm-and-skip: detected values are `recordAnswer`d so the interview walks
 * past them.
 *
 * Tier 2 — conventions / intent a manifest cannot encode. Handled by depth:
 *   - "partial": never applied — left entirely to the interview.
 *   - "everything": recorded like Tier-1 and confirmed once at the review screen;
 *     the remaining un-detected convention gates are auto-filled with recommended
 *     defaults (see runFlow's autoRecommendGates), never asked inline.
 *
 * This is the single source of truth both the CLI apply step and the Stage-2 LLM
 * scope read from.
 */

/** Stack facts — detected and skippable. */
export const TIER1: ReadonlySet<string> = new Set([
  'projectType',
  'language',
  'framework',
  'apiArchitecture',
  'stylingLibrary',
  'database',
  'orm',
  'formatter',
  'linter',
  'logger',
  'testTypes',
  'testRunner',
  'e2eTool',
  'authApproach',
  'packageManager',
  'runtime',
  'validation',
  'stateManagement',
]);

/** Conventions / preferences — always interviewed, pre-fill only. */
export const TIER2: ReadonlySet<string> = new Set([
  'structure',
  'projectDefinition',
  'codingStandards',
  'documentation',
  'gitWorkflow',
  'aiAttribution',
  'commitScope',
  'commitScratchGuard',
  'confirmPush',
  'verifyTiming',
  'atomicCommits',
  'envExampleOnly',
  'rbac',
]);

/**
 * Tier-2 convention ids Stage 2 is allowed to infer in "everything" mode. Kept
 * deliberately narrow: only conventions a directory tree can show (e.g. monorepo
 * `structure`) belong here. Git/commit policy and pure-intent conventions stay
 * manual — the git log is never sent (see §10). Extend as new tree-inferable
 * convention questions land.
 */
export const TIER2_HINTABLE: readonly string[] = ['structure'];

/** True for a Tier-1 id, including the `tsconfig.*` compiler-config family. */
export function isTier1(id: string): boolean {
  return TIER1.has(id) || id.startsWith('tsconfig.');
}

/** True for a Tier-2 convention id. */
export function isTier2(id: string): boolean {
  return TIER2.has(id);
}

/**
 * Partition a detected answer map into its two tiers. Ids that are neither
 * (unknown) are dropped — only classified ids are ever applied.
 */
export function splitByTier<T>(answers: Record<string, T>): {
  tier1: Record<string, T>;
  tier2: Record<string, T>;
} {
  const tier1: Record<string, T> = {};
  const tier2: Record<string, T> = {};
  for (const [id, value] of Object.entries(answers)) {
    if (isTier1(id)) tier1[id] = value;
    else if (isTier2(id)) tier2[id] = value;
  }
  return { tier1, tier2 };
}
