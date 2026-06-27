/**
 * The id → allowed-option-values oracle, shared by the Stage-1 options-membership
 * test invariant and Stage-2 LLM output validation. Both must agree on exactly
 * which values a question accepts, so they read from one place and can't drift.
 *
 * A detected/LLM-proposed value is only honoured if it appears in the list this
 * returns for its id. Unknown ids (or ids whose vocab can't be enumerated here,
 * e.g. `tsconfig.*` module questions) return [] → the caller drops them.
 */
import type { Answers } from '../questions/types';
import type { Option } from '../questions/types';
import {
  frameworkOptions,
  databaseOptions,
  ormOptions,
  stylingOptions,
  validationOptions,
  stateManagementOptions,
  packageManagerOptions,
  formatterOptions,
  linterOptions,
  testRunnerOptions,
  testTypeOptions,
  loggerOptions,
  apiArchitectureOptions,
  authApproachOptions,
  e2eToolOptions,
  structureOptions,
  projectTypeOptions,
  languageOptions,
  runtimeOptions,
  gitWorkflowOptions,
  codingStandardOptions,
  documentationOptions,
} from '../questions/options';

const vals = (opts: Option<string>[]): string[] => opts.map((o) => o.value);

/** Per-id option-list builders, evaluated against the current answers. */
const VOCAB: Record<string, (a: Answers) => string[]> = {
  // Tier 1 — stack facts
  projectType: () => vals(projectTypeOptions),
  language: (a) => vals(languageOptions(a)),
  framework: (a) => vals(frameworkOptions(a)),
  apiArchitecture: () => vals(apiArchitectureOptions),
  stylingLibrary: () => vals(stylingOptions),
  database: () => vals(databaseOptions),
  orm: (a) => vals(ormOptions(a)),
  formatter: (a) => vals(formatterOptions(a)),
  linter: (a) => vals(linterOptions(a)),
  logger: (a) => vals(loggerOptions(a)),
  testTypes: (a) => vals(testTypeOptions(a)),
  testRunner: (a) => vals(testRunnerOptions(a)),
  e2eTool: () => vals(e2eToolOptions),
  authApproach: (a) => vals(authApproachOptions(a)),
  packageManager: (a) => vals(packageManagerOptions(a)),
  runtime: () => vals(runtimeOptions),
  validation: (a) => vals(validationOptions(a)),
  stateManagement: (a) => vals(stateManagementOptions(a)),
  // Tier 2 — conventions that can be hinted from the tree
  structure: () => vals(structureOptions),
  gitWorkflow: () => vals(gitWorkflowOptions),
  codingStandards: () => vals(codingStandardOptions),
  documentation: () => vals(documentationOptions),
};

/** Allowed option values for a question id under the given answers, or [] if unknown. */
export function optionValuesFor(id: string, a: Answers = {}): string[] {
  return VOCAB[id]?.(a) ?? [];
}

/** Whether a question id has an enumerable option vocabulary here. */
export function hasVocab(id: string): boolean {
  return id in VOCAB;
}
