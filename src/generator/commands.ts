/**
 * Resolves the scaffold / dev / test / build commands for the selected stack by
 * reading the colocated fields on the framework `TechModule`. Pure and
 * deterministic — driven entirely by the collected answers. Fields the module
 * does not define come back `undefined`, letting callers fall back to generic
 * wording. This replaces the old central scaffold lookup.
 */
import type { Answers } from '../questions/types';
import { getModule } from '../stack/registry';

export interface StackCommands {
  /** Official generator/init command, or undefined when the stack has none. */
  scaffold?: string;
  /** Dev-server command. */
  dev?: string;
  /** Test command. */
  test?: string;
  /** Production build command. */
  build?: string;
}

/** The resolved commands for the answers' framework, each omitted when unknown. */
export function resolveCommands(a: Answers): StackCommands {
  const mod = getModule(a.framework);
  if (!mod) return {};
  return {
    scaffold: mod.scaffold?.(a),
    dev: mod.devCommand?.(a),
    test: mod.testCommand?.(a),
    build: mod.buildCommand?.(a),
  };
}
