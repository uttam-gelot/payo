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

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The Cargo.toml text that configures a single dependency `crate`: either its
 * `[dependencies.<crate>]` (or dev/build/target variant) sub-table up to the
 * next section header, or its inline `crate = { ... }` / `crate = "x"` line.
 * Scopes feature reads to the right crate instead of the whole manifest.
 */
function cargoDepSpec(cargo: string, crate: string): string | undefined {
  const lines = cargo.split('\n');
  const name = escapeRe(crate);
  const headerRe = new RegExp(`^\\s*\\[[^\\]]*dependencies\\.${name}\\]\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) {
      const body: string[] = [];
      for (let j = i + 1; j < lines.length && !/^\s*\[/.test(lines[j]); j++) body.push(lines[j]);
      return body.join('\n');
    }
  }
  const inlineRe = new RegExp(`^\\s*${name}\\s*=`);
  return lines.find((l) => inlineRe.test(l));
}

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

  // SQL ORMs (sqlx, sea-orm, diesel) carry the DB engine as a Cargo feature
  // rather than a separate crate. Read it from *that crate's* dependency spec
  // only — scanning the whole file mis-fires on any unrelated crate name or
  // comment that mentions an engine, and hard-codes postgres over any other.
  const sqlEngine = (): string | undefined => {
    const orm = ['sqlx', 'sea-orm', 'diesel'].find((c) => deps.has(c));
    if (!orm) return undefined;
    const spec = cargoDepSpec(cargo, orm);
    if (spec === undefined) return undefined;
    // Pick the engine whose token appears first, so a `["mysql", "postgres"]`
    // feature list reflects the declared order instead of a fixed precedence.
    const engines: readonly (readonly [RegExp, string])[] = [
      [/\bpostgres\b/, 'postgresql'],
      [/\bmysql\b/, 'mysql'],
      [/\bsqlite\b/, 'sqlite'],
    ];
    let best: { idx: number; val: string } | undefined;
    for (const [re, val] of engines) {
      const m = re.exec(spec);
      if (m && (best === undefined || m.index < best.idx)) best = { idx: m.index, val };
    }
    return best?.val;
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
