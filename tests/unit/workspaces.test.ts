import { describe, it, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { enumerateWorkspaces } from '../../src/detect/workspaces';

/** Build a throwaway repo from a {path: contents} map, run fn, clean up. */
function inRepo<T>(files: Record<string, string>, fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'payo-ws-'));
  try {
    for (const [name, body] of Object.entries(files)) {
      const full = join(dir, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, body);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('enumerateWorkspaces', () => {
  it('returns [] for a plain single-package repo', () => {
    inRepo({ 'package.json': '{}' }, (dir) => {
      expect(enumerateWorkspaces(dir)).toEqual([]);
    });
  });

  it('resolves pnpm-workspace.yaml globs to member dirs that hold a manifest', () => {
    inRepo(
      {
        'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
        'package.json': '{}',
        'apps/web/package.json': '{"dependencies":{"next":"15"}}',
        'apps/notes.txt': 'not a package', // no manifest → ignored
        'packages/ui/package.json': '{}',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir).sort();
        expect(members).toEqual(['apps/web', 'packages/ui']);
      },
    );
  });

  it('reads package.json workspaces (array form)', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["services/*"]}',
        'services/api/package.json': '{"dependencies":{"fastify":"4"}}',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir)).toEqual(['services/api']);
      },
    );
  });

  it('reads a Cargo workspace members array', () => {
    inRepo(
      {
        'Cargo.toml': '[workspace]\nmembers = ["crates/core", "app"]\n',
        'crates/core/Cargo.toml': '[package]\nname = "core"\n',
        'app/Cargo.toml': '[package]\nname = "app"\n',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir).sort()).toEqual(['app', 'crates/core']);
      },
    );
  });

  it('reads go.work use directives (single and grouped)', () => {
    inRepo(
      {
        'go.work': 'go 1.22\n\nuse (\n  ./svc-a\n  ./svc-b\n)\nuse ./tool\n',
        'svc-a/go.mod': 'module svc-a\n',
        'svc-b/go.mod': 'module svc-b\n',
        'tool/go.mod': 'module tool\n',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir).sort()).toEqual(['svc-a', 'svc-b', 'tool']);
      },
    );
  });

  it('de-duplicates members declared by more than one source', () => {
    inRepo(
      {
        'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n",
        'package.json': '{"workspaces":["packages/*"]}',
        'packages/a/package.json': '{}',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir)).toEqual(['packages/a']);
      },
    );
  });
});
