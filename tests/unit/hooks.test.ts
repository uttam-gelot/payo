import { describe, it, expect } from 'bun:test';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import { initGitRepo, commitEmpty } from '../helpers/gitRepo';
import { emitHooks, mergeLefthook, hookSetupHints } from '../../src/generator/hooks';
import { detectHookRunner } from '../../src/detect/hooks';
import { planHooks, auditReceiptCommand } from '../../src/generator/hookplan';

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

describe('emitHooks — mechanical (the chosen greenfield runner)', () => {
  it('writes husky shell hooks when husky is chosen', () =>
    inTempProject((dir) => {
      const files = emitHooks({ gitleaks: true, hookRunner: 'husky' }, ['claude']);
      expect(files).toContain('.husky/pre-push');
      expect(existsSync(join(dir, 'lefthook.yml'))).toBe(false);
      const sh = readFileSync(join(dir, '.husky/pre-push'), 'utf8');
      expect(sh.startsWith('#!/usr/bin/env sh\n')).toBe(true);
      expect(sh).toContain('npx husky'); // the install banner
      // `|| exit 1` per line: sh exits with the status of the last line only.
      expect(sh).toContain('gitleaks detect --redact || exit 1  # payo:payo-secret-scan');
    }));

  it('writes a valid fresh .pre-commit-config.yaml when pre-commit is chosen', () =>
    inTempProject((dir) => {
      const files = emitHooks({ gitleaks: true, hookRunner: 'pre-commit' }, ['claude']);
      expect(files).toContain('.pre-commit-config.yaml');
      const yml = readFileSync(join(dir, '.pre-commit-config.yaml'), 'utf8');
      // The top-level key is what makes the file loadable at all.
      expect(yml).toContain('\nrepos:\n');
      expect(yml).toContain('- repo: local');
      expect(yml).toContain('entry: gitleaks detect --redact');
      expect(yml).toContain('stages: [push]');
    }));

  it('writes .githooks scripts when native git hooks are chosen', () =>
    inTempProject((dir) => {
      const files = emitHooks({ gitleaks: true, hookRunner: 'native' }, ['claude']);
      expect(files).toContain('.githooks/pre-push');
      const sh = readFileSync(join(dir, '.githooks/pre-push'), 'utf8');
      expect(sh).toContain('git config core.hooksPath .githooks'); // the banner
      // `|| exit 1` per line: sh exits with the status of the last line only.
      expect(sh).toContain('gitleaks detect --redact || exit 1  # payo:payo-secret-scan');
    }));

  it('guards every check so an early failure still blocks the push', () =>
    inTempProject((dir) => {
      // sh exits with the status of its LAST line, so a bare list of commands
      // would let a failing secret scan through whenever the format check that
      // followed it passed.
      const a = {
        gitleaks: true,
        verifyTiming: 'push',
        testRunner: 'bun-test',
        hookRunner: 'native',
      };
      emitHooks(a, ['claude']);
      const abs = join(dir, '.githooks/pre-push');
      const checks = readFileSync(abs, 'utf8')
        .split('\n')
        .filter((l) => l.includes('# payo:'));
      expect(checks.length).toBeGreaterThan(1);
      for (const line of checks) expect(line).toContain(' || exit 1  # payo:');

      // And the guard does what it claims: a failing first check exits non-zero.
      writeFileSync(
        abs,
        readFileSync(abs, 'utf8').replace(/^(?!#).*\|\| exit 1/m, 'false || exit 1'),
      );
      expect(() => execSync(abs, { cwd: dir, shell: '/bin/sh', stdio: 'ignore' })).toThrow();
    }));

  it('writes no mechanical config when the user wants no runner', () =>
    inTempProject((dir) => {
      const files = emitHooks({ gitleaks: true, hookRunner: 'none' }, ['claude']);
      expect(files).toEqual([]);
      for (const rel of ['lefthook.yml', '.husky', '.pre-commit-config.yaml', '.githooks']) {
        expect(existsSync(join(dir, rel))).toBe(false);
      }
    }));

  // A fresh project per runner: once one config is written, detection sees a
  // runner and the second run takes the existing-runner path by design.
  for (const [hookRunner, rel] of [
    ['husky', '.husky/pre-push'],
    ['pre-commit', '.pre-commit-config.yaml'],
    ['native', '.githooks/pre-push'],
  ] as const) {
    it(`is idempotent for ${hookRunner} — a second run touches nothing`, () =>
      inTempProject((dir) => {
        const a = { gitleaks: true, hookRunner };
        emitHooks(a, ['claude']);
        const first = readFileSync(join(dir, rel), 'utf8');
        expect(emitHooks(a, ['claude'])).not.toContain(rel);
        expect(readFileSync(join(dir, rel), 'utf8')).toBe(first);
      }));
  }
});

describe('emitHooks — native pre-tool gate', () => {
  it('denies for change-audit, so the reason reaches the agent rather than the user', () =>
    inTempProject((dir) => {
      // `ask` only raises a human prompt; approving it runs the push and the
      // audit never happens. Only `deny` feeds the instruction back to the agent.
      const files = emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      expect(files).toContain('.claude/settings.json');
      const command = readJson<ClaudeCfg>(join(dir, '.claude/settings.json')).hooks.PreToolUse[0]
        .hooks[0].command;
      expect(command).toContain('payo:skill-gate');
      expect(command).toContain('permissionDecision":"deny');
      expect(command).not.toContain('permissionDecision":"ask');
      expect(command).toContain('change-audit');
      expect(command).toContain('git[[:space:]]+push');
    }));

  it('keeps ask for the gates that are genuinely a human decision', () =>
    inTempProject((dir) => {
      emitHooks({ confirmPush: true, dbSafety: true }, ['claude']);
      const command = readJson<ClaudeCfg>(join(dir, '.claude/settings.json')).hooks.PreToolUse[0]
        .hooks[0].command;
      expect(command).toContain('permissionDecision":"ask');
      expect(command).not.toContain('permissionDecision":"deny');
    }));

  it('keeps both push gates so the audit retry still reaches confirm-push', () =>
    inTempProject((dir) => {
      emitHooks({ auditSkill: true, auditTiming: 'push', confirmPush: true }, ['claude']);
      const command = readJson<ClaudeCfg>(join(dir, '.claude/settings.json')).hooks.PreToolUse[0]
        .hooks[0].command;
      expect(command).toContain('permissionDecision":"deny');
      expect(command).toContain('permissionDecision":"ask');
    }));

  it('stays denied on a blind retry, and opens only once the skill records a pass', () =>
    inTempProject((dir) => {
      initGitRepo(dir);
      emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      const command = readJson<ClaudeCfg>(join(dir, '.claude/settings.json')).hooks.PreToolUse[0]
        .hooks[0].command;
      const push = (): string =>
        execSync(command, {
          cwd: dir,
          shell: '/bin/sh',
          input: JSON.stringify({ tool_input: { command: 'git push origin main' } }),
        }).toString();

      expect(push()).toContain('"deny"');
      expect(push()).toContain('"deny"'); // blind retry: no receipt yet, still blocked

      // Stand in for the change-audit skill's final step: record a pass for HEAD.
      execSync(auditReceiptCommand('push'), { cwd: dir, shell: '/bin/sh' });
      expect(push()).toBe(''); // receipt matches HEAD — gate opens

      // A new commit is a new change set; the stale receipt no longer matches.
      commitEmpty(dir, 'second');
      expect(push()).toContain('"deny"');

      // The gate only READS the receipt — it never writes it (that is the fix).
      expect(command).toContain('cat "$R"');
      expect(command).not.toMatch(/>\s*"?\$R/);
      expect(command).not.toContain('payo-audit-gate');
    }));

  it('stays silent on a command it does not guard', () =>
    inTempProject((dir) => {
      initGitRepo(dir);
      emitHooks({ auditSkill: true, auditTiming: 'push' }, ['claude']);
      const command = readJson<ClaudeCfg>(join(dir, '.claude/settings.json')).hooks.PreToolUse[0]
        .hooks[0].command;
      const out = execSync(command, {
        cwd: dir,
        shell: '/bin/sh',
        input: JSON.stringify({ tool_input: { command: 'ls -la' } }),
      }).toString();
      expect(out).toBe('');
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
                {
                  matcher: 'Bash',
                  hooks: [{ type: 'command', command: '# payo:skill-gate\nOLD' }],
                },
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
        {
          gitleaks: true,
          verifyTiming: 'push',
          testRunner: 'vitest',
          packageManager: 'npm',
          hookPolicy: 'merge',
        },
        ['claude'],
      );
      const yml = readFileSync(join(dir, 'lefthook.yml'), 'utf8');
      expect(yml.match(/gitleaks/g)?.length).toBe(1); // secret scan not duplicated
      expect(yml).toContain('payo-verify'); // verify was missing → added
    }));

  it('leaves an existing runner byte-identical unless the user opted into merging', () =>
    inTempProject((dir) => {
      const before = 'pre-commit:\n  commands:\n    mine:\n      run: echo hi\n';
      writeFileSync(join(dir, 'lefthook.yml'), before);
      const files = emitHooks(
        { gitleaks: true, verifyTiming: 'push', testRunner: 'vitest', packageManager: 'npm' },
        ['claude'],
      );
      expect(files).toEqual([]);
      expect(readFileSync(join(dir, 'lefthook.yml'), 'utf8')).toBe(before);
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
    {
      name: 'payo-secret-scan',
      run: 'gitleaks detect --redact',
      stage: 'pre-push' as const,
      capability: 'secret-scan' as const,
    },
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
      {
        name: 'payo-verify',
        run: 'bun test',
        stage: 'pre-commit' as const,
        capability: 'verify' as const,
      },
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

  it('says plainly which checks nothing will run when the setup was left alone', () =>
    inTempProject((dir) => {
      mkdirSync(join(dir, '.husky'));
      writeFileSync(join(dir, '.husky/pre-commit'), '#!/usr/bin/env sh\nnpx lint-staged\n');
      const a = { gitleaks: true, hookPolicy: 'leave' };
      const hints = hookSetupHints([], a, planHooks(a));
      const deferred = hints.find((h) => h.includes('untouched'));
      expect(deferred).toContain('.husky');
      expect(deferred).toContain('secret scanning');
      // Nothing was written, so there is no runner or binary to set up.
      expect(hints.some((h) => h.includes('lefthook install'))).toBe(false);
      expect(hints.some((h) => h.includes('Install gitleaks'))).toBe(false);
    }));

  it('gives the activation command for whichever runner was written', () =>
    inTempProject(() => {
      const hintsFor = (hookRunner: string): string =>
        hookSetupHints(
          [],
          { gitleaks: true, hookRunner },
          planHooks({ gitleaks: true, hookRunner }),
        ).join('\n');

      expect(hintsFor('lefthook')).toContain('lefthook install');
      expect(hintsFor('husky')).toContain('npx husky');
      expect(hintsFor('husky')).not.toContain('lefthook');
      expect(hintsFor('pre-commit')).toContain('pre-commit install --hook-type pre-push');
      expect(hintsFor('native')).toContain('git config core.hooksPath .githooks');
    }));

  it('says nothing runs the checks when no runner was chosen', () =>
    inTempProject(() => {
      const a = { gitleaks: true, hookRunner: 'none' };
      const hints = hookSetupHints([], a, planHooks(a));
      expect(hints.join('\n')).toContain('No hook runner was added — nothing runs secret scanning');
      // Nothing was written, so no binary is worth installing.
      expect(hints.some((h) => h.includes('Install gitleaks'))).toBe(false);
    }));
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
