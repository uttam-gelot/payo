import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry
import { flow } from '../../src/questions/flow';
import type { Answers } from '../../src/questions/types';

/** Question ids reachable for a given set of answers (mirrors engine gating). */
const reachable = (a: Answers): Set<string> => {
  const ids = new Set<string>();
  for (const section of flow) {
    for (const q of section.questions(a)) {
      if (q.when && !q.when(a)) continue;
      ids.add(q.id);
    }
  }
  return ids;
};

describe('flow gating by project type', () => {
  it('standalone CLI skips UI / server / auth questions but keeps data + tooling', () => {
    const ids = reachable({ projectType: 'cli', language: 'typescript' });
    // Not applicable to a standalone executable:
    expect(ids.has('apiArchitecture')).toBe(false);
    expect(ids.has('stylingLibrary')).toBe(false);
    expect(ids.has('stateManagement')).toBe(false);
    expect(ids.has('authApproach')).toBe(false);
    expect(ids.has('authStrategy')).toBe(false);
    expect(ids.has('rbac')).toBe(false);
    // Still relevant:
    expect(ids.has('framework')).toBe(true); // CLI arg-parsing libs
    expect(ids.has('database')).toBe(true);
    expect(ids.has('logger')).toBe(true);
    expect(ids.has('validation')).toBe(true);
  });

  it('standalone script is like CLI but has no framework question', () => {
    const ids = reachable({ projectType: 'script', language: 'python' });
    expect(ids.has('framework')).toBe(false);
    expect(ids.has('apiArchitecture')).toBe(false);
    expect(ids.has('stylingLibrary')).toBe(false);
    expect(ids.has('authApproach')).toBe(false);
    expect(ids.has('database')).toBe(true);
    expect(ids.has('logger')).toBe(true);
  });

  it('alias databases expand their wire-compatible engine module (dbFamily)', () => {
    const base = { projectType: 'backend', language: 'typescript' };
    // Neon / Supabase / CockroachDB are Postgres under the hood; MariaDB is
    // MySQL; Turso is SQLite. Each must surface its engine's follow-ups.
    for (const database of ['neon', 'supabase', 'cockroachdb']) {
      expect(reachable({ ...base, database }).has('postgresql.migrations')).toBe(true);
    }
    expect(reachable({ ...base, database: 'mariadb' }).has('mysql.migrations')).toBe(true);
    expect(reachable({ ...base, database: 'turso' }).has('sqlite.migrations')).toBe(true);
    // Identity path unchanged.
    expect(reachable({ ...base, database: 'postgresql' }).has('postgresql.migrations')).toBe(true);
  });

  it('asks the change-audit opt-in on every project but hides timing until opted in', () => {
    const base = { projectType: 'backend', language: 'go' };
    // Opt-in is always reachable.
    expect(reachable(base).has('auditSkill')).toBe(true);
    // Timing follow-up is gated on the opt-in.
    expect(reachable(base).has('auditTiming')).toBe(false);
    expect(reachable({ ...base, auditSkill: true }).has('auditTiming')).toBe(true);
    expect(reachable({ ...base, auditSkill: false }).has('auditTiming')).toBe(false);
  });

  it('asks about existing hooks only when there is something they do not cover', () => {
    const base = { projectType: 'backend', language: 'go', gitleaks: true };
    const husky = (coverage: Record<string, string[]>): Answers => ({
      ...base,
      existingHooks: { runner: 'husky', configPath: '.husky', coverage },
    });

    // Greenfield repo — nothing to respect, so nothing to ask.
    expect(reachable(base).has('hookPolicy')).toBe(false);
    // A runner that already scans for secrets covers the only wanted check.
    expect(
      reachable(husky({ 'pre-commit': [], 'pre-push': ['secret-scan'] })).has('hookPolicy'),
    ).toBe(false);
    // A runner that lints but does not scan is missing one — worth asking about.
    expect(reachable(husky({ 'pre-commit': ['lint'], 'pre-push': [] })).has('hookPolicy')).toBe(
      true,
    );
    // simple-git-hooks can never be written into, so the question is pointless.
    expect(
      reachable({
        ...base,
        existingHooks: {
          runner: 'simple-git-hooks',
          configPath: 'package.json',
          coverage: { 'pre-commit': [], 'pre-push': [] },
        },
      }).has('hookPolicy'),
    ).toBe(false);
  });

  it('asks which hook runner to set up only on a repo that has none', () => {
    const base = { projectType: 'backend', language: 'go', gitleaks: true };

    // Greenfield repo that wants a secret scan — the one case worth asking.
    expect(reachable(base).has('hookRunner')).toBe(true);
    // Nothing to run means no runner to pick.
    expect(reachable({ ...base, gitleaks: false }).has('hookRunner')).toBe(false);
    // A repo with a runner gets hookPolicy instead — never both.
    const withHusky = reachable({
      ...base,
      existingHooks: { runner: 'husky', configPath: '.husky', coverage: {} },
    });
    expect(withHusky.has('hookRunner')).toBe(false);
    expect(withHusky.has('hookPolicy')).toBe(true);
  });

  it('existing shapes are unchanged: backend keeps API, frontend keeps styling', () => {
    const backend = reachable({ projectType: 'backend', language: 'go' });
    expect(backend.has('apiArchitecture')).toBe(true);
    expect(backend.has('authApproach')).toBe(true);
    expect(backend.has('stylingLibrary')).toBe(false);

    const frontend = reachable({ projectType: 'frontend', language: 'typescript' });
    expect(frontend.has('stylingLibrary')).toBe(true);
    expect(frontend.has('stateManagement')).toBe(true);
    expect(frontend.has('apiArchitecture')).toBe(false);
    expect(frontend.has('database')).toBe(false);
    expect(frontend.has('logger')).toBe(true);
  });
});
