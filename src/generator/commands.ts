/**
 * Resolves the scaffold / dev / test / build / migrate commands for the selected
 * stack by reading the colocated fields on the relevant `TechModule`s. Pure and
 * deterministic — driven entirely by the collected answers. Fields no module
 * defines come back `undefined`, letting callers fall back to generic wording.
 *
 * scaffold/dev/test/build come from the framework module; migrate comes from the
 * ORM module (it owns the migration tooling), with the DB module as a fallback
 * for DB-native migration.
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
  /** Schema-migration command (from the ORM, or the DB as a fallback). */
  migrate?: string;
}

/** The resolved commands for the answers' stack, each omitted when unknown. */
export function resolveCommands(a: Answers): StackCommands {
  const framework = getModule(a.framework);
  const orm = getModule(a.orm);
  const db = getModule(a.database);
  return {
    scaffold: framework?.scaffold?.(a),
    dev: framework?.devCommand?.(a),
    test: framework?.testCommand?.(a),
    build: framework?.buildCommand?.(a),
    migrate: orm?.migrateCommand?.(a) ?? db?.migrateCommand?.(a),
  };
}
