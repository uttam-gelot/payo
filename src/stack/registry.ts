/**
 * Tech-module registry. Keyed by module id. Modules register themselves via
 * src/stack/modules/index.ts (imported once at startup).
 */
import type { ContributorCategory, TechModule } from './types';
import type { Answers } from '../questions/types';

const registry = new Map<string, TechModule>();

export function registerModule(module: TechModule): void {
  registry.set(module.id, module);
}

export function getModule(id: unknown): TechModule | undefined {
  return typeof id === 'string' ? registry.get(id) : undefined;
}

export function listModules(): TechModule[] {
  return [...registry.values()];
}

/** Modules in a category that apply to the current answers. */
export function modulesFor(category: ContributorCategory, a: Answers): TechModule[] {
  return listModules().filter((m) => m.category === category && m.appliesTo(a));
}
