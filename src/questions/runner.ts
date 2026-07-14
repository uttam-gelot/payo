import { select, multiselect, text, confirm, isCancel, cancel, note } from '@clack/prompts';
import type { Answers, Option, Question } from './types';

// ---------------------------------------------------------------------------
// Cancel guard — call after every prompt return value
// ---------------------------------------------------------------------------

export function guardCancel<T>(value: T | symbol): asserts value is NonNullable<T> {
  if (isCancel(value)) {
    cancel('Operation cancelled. Your progress has been saved.');
    process.exit(0);
  }
}

export const OTHER = '__other__';

/** Stable-sort options so recommended-hinted ones lead, preserving order otherwise. */
export function hoistRecommended(options: Option<string>[]): Option<string>[] {
  const recommended = options.filter((o) => o.hint === 'recommended');
  if (recommended.length === 0 || recommended.length === options.length) return options;
  return [...recommended, ...options.filter((o) => o.hint !== 'recommended')];
}

export function resolveOptions(q: Question, a: Answers): Option<string>[] {
  return hoistRecommended(q.optionsFrom ? q.optionsFrom(a) : (q.options ?? []));
}

/** Whether to append an "Other (specify)" choice — on by default, opt out with `allowOther: false`. */
export function offersOther(q: Question, options: Option<string>[]): boolean {
  if (q.allowOther === false) return false;
  return !options.some((o) => o.value === 'other' || o.value === 'custom');
}

async function runSelect(q: Question, a: Answers): Promise<string> {
  const options = resolveOptions(q, a);
  const finalOptions = offersOther(q, options)
    ? [...options, { value: OTHER, label: 'Other (specify)' }]
    : options;

  // Pre-select a seeded/prior value when it is a valid option (e.g. a detected
  // answer under the "review & edit" path). Ignored when out of range.
  const prior = a[q.id];
  const initialValue =
    typeof prior === 'string' && finalOptions.some((o) => o.value === prior) ? prior : undefined;

  const value = await select({ message: q.message, options: finalOptions, initialValue });
  guardCancel(value);

  if (value === OTHER || value === 'other' || value === 'custom') {
    const custom = await text({
      message: 'Please specify:',
      validate: (input) => (!input?.trim() ? 'Please provide a value.' : undefined),
    });
    guardCancel(custom);
    return custom;
  }
  return value;
}

/** Split a comma-separated custom entry into trimmed, de-duplicated values. */
export function parseCustom(raw: string, chosen: string[]): string[] {
  const seen = new Set(chosen);
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const v = part.trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Merge a raw custom entry into a multiselect result, dropping the OTHER sentinel. */
export function mergeMultiselect(picked: string[], raw: string): string[] {
  const kept = picked.filter((v) => v !== OTHER);
  return [...kept, ...parseCustom(raw, kept)];
}

/**
 * What starts checked in a multiselect: a prior/seeded answer wins (filtered to
 * valid options); otherwise the recommended options, so the "recommended" tag
 * matches what actually starts selected.
 */
export function multiselectSeed(prior: unknown, options: Option<string>[]): string[] {
  if (Array.isArray(prior)) {
    const valid = new Set(options.map((o) => o.value));
    return prior.filter((v): v is string => typeof v === 'string' && valid.has(v));
  }
  return options.filter((o) => o.hint === 'recommended').map((o) => o.value);
}

async function runMultiselect(q: Question, a: Answers): Promise<string[]> {
  const options = resolveOptions(q, a);
  const finalOptions = offersOther(q, options)
    ? [...options, { value: OTHER, label: 'Other (specify)' }]
    : options;

  // A stored answer wins; otherwise a question-supplied dynamic default seeds the
  // checks (no "recommended" tag); otherwise fall back to the recommended options.
  const prior = a[q.id];
  const seed = prior ?? (q.initialFrom ? q.initialFrom(a) : undefined);
  const initialValues = multiselectSeed(seed, finalOptions);

  const picked = await multiselect({
    message: q.message,
    options: finalOptions,
    required: q.required ?? true,
    ...(initialValues && initialValues.length ? { initialValues } : {}),
  });
  guardCancel(picked);
  if (!picked.includes(OTHER)) return picked;

  const custom = await text({
    message: 'Add your own — comma-separated:',
    validate: (input) => (!input?.trim() ? 'Please provide at least one value.' : undefined),
  });
  guardCancel(custom);

  return mergeMultiselect(picked, custom);
}

/** Render one question via @clack and return its answer. */
export async function runQuestion(q: Question, a: Answers): Promise<unknown> {
  switch (q.type) {
    case 'select':
      return runSelect(q, a);

    case 'multiselect':
      return runMultiselect(q, a);

    case 'text': {
      const validate = q.validate;
      const placeholder = typeof q.placeholder === 'function' ? q.placeholder(a) : q.placeholder;
      const value = await text({
        message: q.message,
        placeholder,
        validate: validate
          ? (v: string | undefined): string | undefined => validate(v ?? '')
          : undefined,
      });
      guardCancel(value);
      return value;
    }

    case 'confirm': {
      // Pre-select a seeded/prior boolean (e.g. a detected tsconfig flag).
      const prior = a[q.id];
      const value = await confirm({
        message: q.message,
        ...(typeof prior === 'boolean' ? { initialValue: prior } : {}),
      });
      guardCancel(value);
      return value;
    }
  }
}

/** Friendly label per detected answer id, for the detection summary. */
const DETECT_LABELS: Record<string, string> = {
  language: 'Language',
  projectType: 'Project type',
  framework: 'Framework',
  apiArchitecture: 'API architecture',
  packageManager: 'Package manager',
  runtime: 'Runtime',
  formatter: 'Formatter',
  linter: 'Linter',
  testRunner: 'Test runner',
  testTypes: 'Test types',
  e2eTool: 'E2E tool',
  database: 'Database',
  orm: 'ORM',
  stylingLibrary: 'Styling',
  validation: 'Validation',
  stateManagement: 'State management',
  authApproach: 'Auth',
  logger: 'Logger',
  // tsconfig knobs read straight from tsconfig.json — every recorded id is
  // listed so the summary never hides an answer it silently pre-filled.
  'tsconfig.strict': 'TS strict',
  'tsconfig.target': 'TS target',
  'tsconfig.module-resolution': 'TS module res',
  'tsconfig.path-aliases': 'TS path aliases',
  // Tier-2 conventions detection can infer (shown so "detect everything" is visible).
  structure: 'Structure',
};

/** Order detected lines read top-down like the questionnaire. */
const DETECT_ORDER = Object.keys(DETECT_LABELS);

/** Gate 1 — whether to detect the existing project at all, or start fresh. */
export async function confirmStartMode(ask: SelectPrompt = select): Promise<'fresh' | 'existing'> {
  const value = await ask({
    message: 'This directory looks like an existing project. How should payo proceed?',
    options: [
      {
        value: 'existing',
        label: 'Work with the existing project — detect its stack and pre-fill answers',
      },
      { value: 'fresh', label: 'Start fresh — ignore what is here and answer everything' },
    ],
  });
  guardCancel(value);
  return value as 'fresh' | 'existing';
}

/** Gate 2 — how deep detection should reach. */
export async function confirmDetectionDepth(
  ask: SelectPrompt = select,
): Promise<'everything' | 'partial'> {
  const value = await ask({
    message: 'How much should payo detect?',
    options: [
      {
        value: 'everything',
        label:
          'Detect everything — stack and conventions auto-filled; you review before generating',
      },
      { value: 'partial', label: 'Just the high-level stack — answer conventions yourself' },
    ],
  });
  guardCancel(value);
  return value as 'everything' | 'partial';
}

/** Build the "Detected from your project" lines — one per recorded id, in order. */
export function detectionSummaryLines(detected: { answers: Record<string, unknown> }): string[] {
  return DETECT_ORDER.filter((id) => id in detected.answers).map((id) => {
    const label = DETECT_LABELS[id];
    return `• ${label.padEnd(16)} ${String(detected.answers[id])}`;
  });
}

/** Read-only summary of what detection produced, shown before the interview continues. */
export function summarizeDetection(detected: { answers: Record<string, unknown> }): void {
  const lines = detectionSummaryLines(detected);
  if (lines.length === 0) return;
  note(lines.join('\n'), 'Detected from your project');
}

/** Resume / restart decision shown when a prior session exists. */
export async function confirmResume(answeredCount: number): Promise<boolean> {
  const value = await confirm({
    message: `You have an existing session (${answeredCount} answered). Resume it?`,
    initialValue: true,
  });
  guardCancel(value);
  return value;
}

/**
 * The slice of @clack's `select` these helpers use. Injectable so unit tests can
 * drive the choice deterministically without mocking the @clack module (bun's
 * process-wide `mock.module` collides across test files).
 */
type SelectPrompt = (opts: {
  message: string;
  options: { value: string; label: string }[];
}) => Promise<string | symbol>;

/** Review-screen choice: generate now, or edit a prior answer first. */
export async function reviewAction(ask: SelectPrompt = select): Promise<'generate' | 'edit'> {
  const value = await ask({
    message: 'Generate config with these settings?',
    options: [
      { value: 'generate', label: 'Generate' },
      { value: 'edit', label: 'Edit an answer' },
    ],
  });
  guardCancel(value);
  return value as 'generate' | 'edit';
}

/** Pick which answered question to re-answer; returns undefined for "back". */
export async function selectAnswerToEdit(
  items: { id: string; label: string }[],
  ask: SelectPrompt = select,
): Promise<string | undefined> {
  const BACK = '__back__';
  const value = await ask({
    message: 'Which answer would you like to change?',
    options: [
      ...items.map((i) => ({ value: i.id, label: i.label })),
      { value: BACK, label: '← Back' },
    ],
  });
  guardCancel(value);
  return value === BACK ? undefined : value;
}

/** What to do when generation would overwrite files that already exist. */
export type OverwriteChoice = 'overwrite' | 'backup' | 'skip';

/**
 * Asked before any generation work starts (so no agent call is wasted) when
 * one or more target files already exist in the project.
 */
export async function confirmOverwrite(existing: string[]): Promise<OverwriteChoice> {
  const shown = existing.slice(0, 3).join(', ');
  const more = existing.length > 3 ? ` and ${existing.length - 3} more` : '';
  const value = await select({
    message: `${shown}${more} already exist${existing.length === 1 ? 's' : ''}. What should payo do?`,
    options: [
      { value: 'backup', label: 'Back up — rename existing to *.bak, then write fresh files' },
      { value: 'overwrite', label: 'Overwrite — replace the existing files' },
      { value: 'skip', label: 'Skip — keep existing files and generate nothing' },
    ],
  });
  guardCancel(value);
  return value;
}

/**
 * Offer to delete legacy per-tool config the universal layout supersedes.
 * Default off — deletion is destructive, so the user opts in explicitly.
 */
export async function confirmLegacyCleanup(files: string[]): Promise<boolean> {
  const shown = files.slice(0, 3).join(', ');
  const more = files.length > 3 ? ` and ${files.length - 3} more` : '';
  const value = await confirm({
    message: `Remove legacy config now replaced by the universal layout (${shown}${more})?`,
    initialValue: false,
  });
  guardCancel(value);
  return value;
}

/** Offer the post-generation bootstrap prompt once generation is done. */
export async function confirmBootstrapPrompt(): Promise<boolean> {
  const value = await confirm({
    message: 'Generate a starter prompt to scaffold a working project from these skills?',
    initialValue: true,
  });
  guardCancel(value);
  return value;
}
