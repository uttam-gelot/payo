import { describe, it, expect } from 'bun:test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { emitHooks, mergeLefthook, hookSetupHints } from '../../src/generator/hooks';
import { detectHookRunner } from '../../src/detect/hooks';

type ClaudeCfg = {
  permissions?: { allow: string[] };
  hooks: { PreToolUse: { matcher?: string; hooks: { command: string }[] }[] };
};
type CursorCfg = { hooks: { beforeShellExecution: { failClosed: boolean }[] } };
type CopilotCfg = { event: string };
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

describe('emitHooks — mechanical (lefthook, greenfield)', () => {
  it('writes lefthook.yml with the gitleaks scan and a payo marker', () =>
    inTempProject((dir) => {
      const files = emitHooks({ gitleaks: true }, ['claude']);
      expect(files).toContain('lefthook.yml');
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      expect(yml).toContain('pre-push:');
      expect(yml).toContain('gitleaks detect --redact');
      expect(yml).toContain('# payo:payo-secret-scan');
    }));

  it('is idempotent — a second run touches nothing', () =>
    inTempProject((dir) => {
      emitHooks({ gitleaks: true }, ['claude']);
      const first = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      const second = emitHooks({ gitleaks: true }, ['claude']);
      expect(second).not.toContain('lefthook.yml');
      expect(readFileSync(join(dir, 'lefthook.yml'), 'utf8')).toBe(first);
    }));

  it('writes nothing when no hook flag is set', () =>
    inTempProject((dir) => {
      const files = emitHooks({}, ['claude']);
      expect(files).toEqual([]);
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
      expect(existsSync(join(dir, '.claude'))).toBe(false);
    }));
});

describe('emitHooks — native soft-ask', () => {
  it('writes a Claude PreToolUse ask gate for change-audit', () =>
    inTempProject((dir) => {
      const files = emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      expect(files).toContain('.claude/settings.json');
      const cfg = readJson<ClaudeCfg>(join(dir, '.claude/settings.json'));
      const command = cfg.hooks.PreToolUse[0].hooks[0].command;
      expect(command).toContain('payo:skill-gate');
      expect(command).toContain('permissionDecision":"ask'); // template baked into the sh command
      expect(command).toContain('change-audit');
      expect(command).toContain('git[[:space:]]+push');
    }));

  it('merges into an existing .claude/settings.json without dropping keys', () =>
    inTempProject((dir) => {
      mkdirSync(join(dir, '.claude'));
      writeFileSync(
        join(dir, '.claude/settings.json'),
        JSON.stringify({ permissions: { allow: ['Read'] }, hooks: { PreToolUse: [] } }, null, 2),
      );
      emitHooks({ confirmPush: true }, ['claude']);
      const cfg = readJson<ClaudeCfg>(join(dir, '.claude/settings.json'));
      expect(cfg.permissions?.allow).toEqual(['Read']); // preserved
      expect(cfg.hooks.PreToolUse.length).toBe(1);
    }));

  it('emits Cursor with failClosed and Copilot per-file', () =>
    inTempProject((dir) => {
      emitHooks({ dbSafety: true }, ['cursor', 'copilot']);
      const cursor = readJson<CursorCfg>(join(dir, '.cursor/hooks.json'));
      expect(cursor.hooks.beforeShellExecution[0].failClosed).toBe(true);
      const copilot = readJson<CopilotCfg>(join(dir, '.github/hooks/payo-pretool.json'));
      expect(copilot.event).toBe('preToolUse');
    }));

  it('replaces a stale gate from an earlier run instead of appending a second one', () =>
    inTempProject((dir) => {
      mkdirSync(join(dir, '.claude'));
      writeFileSync(
        join(dir, '.claude/settings.json'),
        JSON.stringify(
          {
            permissions: { allow: ['Read'] },
            hooks: {
              PreToolUse: [
                { matcher: 'Bash', hooks: [{ type: 'command', command: '# payo:skill-gate\nOLD' }] },
                { matcher: 'Bash', hooks: [{ type: 'command', command: 'my own hook' }] },
              ],
            },
          },
          null,
          2,
        ),
      );
      emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      const cfg = readJson<ClaudeCfg>(join(dir, '.claude/settings.json'));
      expect(cfg.permissions?.allow).toEqual(['Read']); // unrelated keys preserved
      expect(cfg.hooks.PreToolUse.length).toBe(2); // stale gate replaced, not duplicated
      const commands = cfg.hooks.PreToolUse.map((e) => e.hooks[0].command);
      expect(commands).toContain('my own hook'); // the user's own hook survives
      expect(commands.some((c) => c.includes('OLD'))).toBe(false);
      expect(commands.some((c) => c.includes('change-audit'))).toBe(true);
    }));

  it('leaves a config carrying the current gate untouched', () =>
    inTempProject((dir) => {
      emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      const first = readFileSync(join(dir, '.claude/settings.json'), 'utf8');
      const second = emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      expect(second).toEqual([]);
      expect(readFileSync(join(dir, '.claude/settings.json'), 'utf8')).toBe(first);
    }));

  it('skips tools without a soft-ask hook (codex / windsurf)', () =>
    inTempProject((dir) => {
      const files = emitHooks({ auditSkill: true }, ['codex', 'windsurf']);
      expect(files).toEqual([]);
      expect(existsSync(join(dir, '.codex'))).toBe(false);
    }));
});

describe('emitHooks — content-aware dedup (existing runner)', () => {
  it('does not re-add gitleaks when the existing lefthook.yml already runs it', () =>
    inTempProject((dir) => {
      writeFileSync(
        join(dir, 'lefthook.yml'),
        'pre-push:\n  commands:\n    secrets:\n      run: gitleaks detect\n',
      );
      const files = emitHooks({ gitleaks: true }, ['claude']);
      expect(files).toEqual([]); // nothing to add
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      expect(yml.match(/gitleaks/g)?.length).toBe(1); // no duplicate
      expect(yml).not.toContain('payo-secret-scan');
    }));

  it('does not re-add a verify check when husky already runs tests', () =>
    inTempProject((dir) => {
      mkdirSync(join(dir, '.husky'));
      writeFileSync(join(dir, '.husky/pre-push'), '#!/usr/bin/env sh\nnpm test\n');
      const files = emitHooks(
        { verifyTiming: 'push', testRunner: 'vitest', packageManager: 'npm' },
        ['claude'],
      );
      expect(files).toEqual([]);
      const hook = readFileSync(join(dir, '.husky/pre-push'), 'utf8');
      expect(hook).not.toContain('payo-verify');
    }));

  it('adds only the uncovered check, leaving the covered one alone', () =>
    inTempProject((dir) => {
      // Repo already scans secrets, but has no test hook.
      writeFileSync(
        join(dir, 'lefthook.yml'),
        'pre-push:\n  commands:\n    secrets:\n      run: gitleaks detect\n',
      );
      emitHooks(
        { gitleaks: true, verifyTiming: 'push', testRunner: 'vitest', packageManager: 'npm' },
        ['claude'],
      );
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      expect(yml.match(/gitleaks/g)?.length).toBe(1); // secret scan not duplicated
      expect(yml).toContain('payo-verify'); // verify was missing → added
    }));
});

describe('emitHooks — test-command fallback for frameworkless stacks', () => {
  it('uses the package-manager test script when no framework provides one', () =>
    inTempProject((dir) => {
      emitHooks({ verifyTiming: 'commit', testRunner: 'bun-test', packageManager: 'bun' }, [
        'claude',
      ]);
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      expect(yml).toContain('pre-commit:');
      expect(yml).toContain('payo-verify');
      expect(yml).toContain('bun run test');
    }));

  it('omits the verify check when the user declined testing', () =>
    inTempProject(() => {
      const files = emitHooks({ verifyTiming: 'commit', packageManager: 'bun' }, ['claude']);
      expect(files).toEqual([]); // no test setup → no verify → nothing written
    }));
});

describe('mergeLefthook', () => {
  const check = [
    { name: 'payo-secret-scan', run: 'gitleaks detect --redact', stage: 'pre-push' as const },
  ];

  it('appends under an existing pre-push commands map, keeping the custom entry', () => {
    const existing = ['pre-push:', '  commands:', '    my-check:', '      run: echo hi', ''].join(
      '\n',
    );
    const merged = mergeLefthook(existing, check);
    expect(merged).toContain('my-check:'); // custom preserved
    expect(merged).toContain('payo-secret-scan:');
    expect(merged.match(/pre-push:/g)?.length).toBe(1); // no duplicate stage key
  });

  it('adds the stage block when the stage is absent', () => {
    const merged = mergeLefthook('pre-commit:\n  commands:\n    x:\n      run: echo x\n', check);
    expect(merged).toContain('pre-push:');
    expect(merged).toContain('payo-secret-scan:');
  });

  it('is a no-op when the payo marker is already present', () => {
    const already =
      'pre-push:\n  commands:\n    payo-secret-scan:\n      run: x  # payo:payo-secret-scan\n';
    expect(mergeLefthook(already, check)).toBe(already);
  });

  it('adds a newly enabled check to a config Payo already wrote', () => {
    // The marker guard is per-check: enabling verify on a later run must still land.
    const already =
      'pre-push:\n  commands:\n    payo-secret-scan:\n      run: x  # payo:payo-secret-scan\n';
    const merged = mergeLefthook(already, [
      ...check,
      { name: 'payo-verify', run: 'bun test', stage: 'pre-commit' as const },
    ]);
    expect(merged).toContain('payo-verify:');
    expect(merged).toContain('pre-commit:');
    expect(merged.match(/payo-secret-scan:/g)?.length).toBe(1); // covered one not duplicated
  });
});

describe('hookSetupHints', () => {
  it('tells the user to run lefthook install when lefthook.yml was written', () => {
    const hints = hookSetupHints(['lefthook.yml'], { gitleaks: true });
    expect(hints.some((h) => h.includes('lefthook install'))).toBe(true);
  });

  it('is empty when no hooks were written', () => {
    expect(hookSetupHints([], { gitleaks: true })).toEqual([]);
  });

  it('does not ask to run lefthook install for a merged runner', () => {
    const hints = hookSetupHints(['.husky/pre-push'], { gitleaks: false });
    expect(hints.some((h) => h.includes('lefthook install'))).toBe(false);
  });
});

describe('detectHookRunner', () => {
  it('returns null on a bare repo', () =>
    inTempProject(() => {
      expect(detectHookRunner()).toBeNull();
    }));

  it('detects lefthook by its config file', () =>
    inTempProject((dir) => {
      writeFileSync(join(dir, 'lefthook.yml'), 'pre-commit:\n');
      expect(detectHookRunner()?.runner).toBe('lefthook');
    }));

  it('detects husky by the .husky dir', () =>
    inTempProject((dir) => {
      mkdirSync(join(dir, '.husky'));
      expect(detectHookRunner()?.runner).toBe('husky');
    }));
});
