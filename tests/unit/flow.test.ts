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
