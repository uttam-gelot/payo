import { select, multiselect, text, confirm, isCancel, cancel } from '@clack/prompts';
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

export function resolveOptions(q: Question, a: Answers): Option<string>[] {
  return q.optionsFrom ? q.optionsFrom(a) : (q.options ?? []);
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

  const value = await select({ message: q.message, options: finalOptions });
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

async function runMultiselect(q: Question, a: Answers): Promise<string[]> {
  const options = resolveOptions(q, a);
  const finalOptions = offersOther(q, options)
    ? [...options, { value: OTHER, label: 'Other (specify)' }]
    : options;

  const picked = await multiselect({
    message: q.message,
    options: finalOptions,
    required: q.required ?? true,
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
      const value = await text({
        message: q.message,
        placeholder: q.placeholder,
        validate: validate
          ? (v: string | undefined): string | undefined => validate(v ?? '')
          : undefined,
      });
      guardCancel(value);
      return value;
    }

    case 'confirm': {
      const value = await confirm({ message: q.message });
      guardCancel(value);
      return value;
    }
  }
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

/** Final confirm before generation — last chance to catch a wrong answer. */
export async function confirmGenerate(): Promise<boolean> {
  const value = await confirm({
    message: 'Generate config with these settings?',
    initialValue: true,
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
