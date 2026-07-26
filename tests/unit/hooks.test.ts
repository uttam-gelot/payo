import { describe, it, expect } from 'bun:test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { emitHooks, mergeLefthook } from '../../src/generator/hooks';
import { detectHookRunner } from '../../src/detect/hooks';

type ClaudeCfg = {
  permissions?: { allow: string[] };
  hooks: { PreToolUse: { hooks: { command: string }[] }[] };
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

  it('skips tools without a soft-ask hook (codex / windsurf)', () =>
    inTempProject((dir) => {
      const files = emitHooks({ auditSkill: true }, ['codex', 'windsurf']);
      expect(files).toEqual([]);
      expect(existsSync(join(dir, '.codex'))).toBe(false);
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
