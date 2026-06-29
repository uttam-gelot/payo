/** Detect a Rust stack from Cargo.toml. */
import type { DetectionResult, DetectionSource } from './types';
import { readText, cargoDeps } from './manifest';
import {
  firstMatch,
  RUST_FRAMEWORK,
  RUST_CLI,
  RUST_DATABASE,
  RUST_ORM,
  RUST_VALIDATION,
  RUST_LOGGER,
} from './signals';

export function detectRust(cwd: string): DetectionResult | null {
  const cargo = readText(cwd, 'Cargo.toml');
  if (cargo === undefined) return null;

  const deps = cargoDeps(cargo);
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'Cargo.toml';
    }
  };

  set('language', 'rust');

  const framework = firstMatch(deps, RUST_FRAMEWORK);
  set('framework', framework);

  let projectType: string | undefined;
  if (framework) projectType = 'backend';
  else if ([...deps].some((d) => RUST_CLI.has(d))) projectType = 'cli';
  set('projectType', projectType);

  // SQL ORMs/drivers (sqlx, sea-orm, diesel) carry the DB engine as a Cargo
  // feature rather than a separate crate — read it from the raw line.
  const sqlEngine = (): string | undefined => {
    if (!['sqlx', 'sea-orm', 'diesel'].some((c) => deps.has(c))) return undefined;
    if (/\bpostgres\b/.test(cargo)) return 'postgresql';
    if (/\bmysql\b/.test(cargo)) return 'mysql';
    if (/\bsqlite\b/.test(cargo)) return 'sqlite';
    return undefined;
  };
  set('database', firstMatch(deps, RUST_DATABASE) ?? sqlEngine());
  set('orm', firstMatch(deps, RUST_ORM));
  set('validation', firstMatch(deps, RUST_VALIDATION));
  set('logger', firstMatch(deps, RUST_LOGGER));
  // Rust's toolchain is fixed: rustfmt + cargo test are universal.
  set('formatter', 'rustfmt');
  set('linter', 'clippy');
  set('testRunner', 'cargo-test');

  return { answers, sources };
}
