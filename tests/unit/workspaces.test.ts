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

describe('enumerateWorkspaces — nested workspace roots & undeclared members', () => {
  it('finds an undeclared nested Cargo workspace and its crates', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["apps/*"]}',
        'apps/web/package.json': '{"dependencies":{"react":"18"}}',
        'services/Cargo.toml': '[workspace]\nmembers = ["client-api", "models"]\n',
        'services/client-api/Cargo.toml': '[package]\nname = "client-api"\n',
        'services/models/Cargo.toml': '[package]\nname = "models"\n',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir);
        expect(members).toContain('apps/web');
        expect(members).toContain('services');
        expect(members).toContain('services/client-api');
        expect(members).toContain('services/models');
      },
    );
  });

  it('finds a nested go.work workspace', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["web"]}',
        'web/package.json': '{}',
        'backend/go.work': 'go 1.22\n\nuse ./svc\n',
        'backend/svc/go.mod': 'module svc\n',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir);
        expect(members).toContain('backend/svc');
      },
    );
  });

  it('does not duplicate a nested workspace already declared as a member', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["services"]}',
        'services/Cargo.toml': '[workspace]\nmembers = ["api"]\n',
        'services/api/Cargo.toml': '[package]\nname = "api"\n',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir);
        expect(members.filter((m) => m === 'services')).toHaveLength(1);
      },
    );
  });

  it('adds undeclared manifest dirs only when the repo already reads as a monorepo', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["web"]}',
        'web/package.json': '{}',
        'backend/go.mod': 'module backend\n',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir)).toContain('backend');
      },
    );
  });

  it('a stray subdir manifest never turns a single-package repo into a monorepo', () => {
    inRepo(
      {
        'package.json': '{"name":"app","dependencies":{"react":"18"}}',
        'examples/demo/package.json': '{}',
      },
      (dir) => {
        expect(enumerateWorkspaces(dir)).toEqual([]);
      },
    );
  });

  it('the nested scan skips generated/, but a declared literal member there still resolves', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["generated/client", "web"]}',
        'web/package.json': '{}',
        'generated/client/package.json': '{}',
        'generated/other/Cargo.toml': '[workspace]\nmembers = ["x"]\n',
        'generated/other/x/Cargo.toml': '[package]\nname = "x"\n',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir);
        expect(members).toContain('generated/client'); // declared literal survives
        expect(members).not.toContain('generated/other'); // scan never enters generated/
        expect(members).not.toContain('generated/other/x');
      },
    );
  });

  it('never descends into a declared member looking for nested workspaces', () => {
    inRepo(
      {
        'package.json': '{"workspaces":["app"]}',
        'app/package.json': '{}',
        'app/embedded/Cargo.toml': '[workspace]\nmembers = ["y"]\n',
        'app/embedded/y/Cargo.toml': '[package]\nname = "y"\n',
      },
      (dir) => {
        const members = enumerateWorkspaces(dir);
        expect(members).toContain('app');
        expect(members).not.toContain('app/embedded');
      },
    );
  });
});
