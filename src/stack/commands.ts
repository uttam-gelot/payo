/**
 * Shared command helpers for tech modules. Modules colocate their scaffold /
 * dev / test / build commands (see `TechModule`), and these helpers keep the
 * package-manager prefixing in one place so every module stays a one-liner and
 * the emitted strings are consistent.
 */
import type { Answers } from '../questions/types';

/** Read the chosen package manager, treating empty / 'none' as unset (mirrors rules.ts). */
export function pm(a: Answers): string | undefined {
  const v = a.packageManager;
  if (typeof v !== 'string' || !v || v === 'none') return undefined;
  return v;
}

/**
 * The package manager's `create <gen>` scaffold form, e.g. `pnpm create next-app`.
 * pnpm/yarn/bun run the generator directly; npm (and the unset case) pins it to
 * its latest release. Extra args are passed after `--` (e.g. a Vite template).
 */
export function pmCreate(a: Answers, gen: string, args?: string): string {
  const suffix = args ? ` -- ${args}` : '';
  switch (pm(a)) {
    case 'pnpm':
      return `pnpm create ${gen}${suffix}`;
    case 'yarn':
      return `yarn create ${gen}${suffix}`;
    case 'bun':
      return `bun create ${gen}${suffix}`;
    default:
      return `npm create ${gen}@latest${suffix}`;
  }
}

/**
 * Run a package.json script with the chosen manager, e.g. `pnpm dev`,
 * `npm run build`. pnpm/yarn invoke scripts bare; npm (and unset) and bun use
 * their `run` form.
 */
export function pmRun(a: Answers, script: string): string {
  switch (pm(a)) {
    case 'pnpm':
      return `pnpm ${script}`;
    case 'yarn':
      return `yarn ${script}`;
    case 'bun':
      return `bun run ${script}`;
    default:
      return `npm run ${script}`;
  }
}
