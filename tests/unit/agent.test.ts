import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  capsFor,
  checkAgentReady,
  clearCapsCache,
  isAvailable,
  probeCommand,
  runAgent,
} from '../../src/generator/agent';
import type { AgentRunner } from '../../src/generator/types';
import { inTempProject } from '../helpers/tmpProject';

/** A runner whose argv is a fixed `sh -c` command (the prompt is ignored). */
const shRunner = (cmd: string, timeoutMs?: number): AgentRunner => ({
  binary: 'sh',
  buildArgs: () => ['-c', cmd],
  ...(timeoutMs ? { timeoutMs } : {}),
});

describe('probeCommand', () => {
  it('uses `where` on Windows', () => {
    expect(probeCommand('win32')).toBe('where');
  });

  it('uses `which` elsewhere', () => {
    expect(probeCommand('linux')).toBe('which');
    expect(probeCommand('darwin')).toBe('which');
  });
});

describe('isAvailable', () => {
  it('is true for a binary on PATH', () => {
    expect(isAvailable(shRunner(':'))).toBe(true);
  });

  it('is false for a missing binary', () => {
    const missing: AgentRunner = {
      binary: 'definitely-missing-bin-xyz',
      buildArgs: () => [],
    };
    expect(isAvailable(missing)).toBe(false);
  });
});

describe('capsFor', () => {
  /** A runner whose "help" is a fixed echo, standing in for a CLI's --help. */
  const helpRunner = (help: string): AgentRunner => ({
    binary: 'sh',
    helpArgs: ['-c', `echo '${help}'`],
    buildArgs: () => [],
  });

  it('reports a flag the help text lists', () => {
    clearCapsCache();
    expect(capsFor(helpRunner('--sandbox <MODE>  sandbox policy')).supports('--sandbox')).toBe(
      true,
    );
  });

  it('reports a flag the help text omits (older CLI)', () => {
    clearCapsCache();
    expect(capsFor(helpRunner('-p  print mode')).supports('--add-dir')).toBe(false);
  });

  it('does not match a flag that is only a prefix of another', () => {
    clearCapsCache();
    expect(capsFor(helpRunner('--sandbox-mode <MODE>')).supports('--sandbox')).toBe(false);
  });

  it('reports nothing supported when the probe fails', () => {
    clearCapsCache();
    const missing: AgentRunner = { binary: 'definitely-missing-bin-xyz', buildArgs: () => [] };
    expect(capsFor(missing).supports('--sandbox')).toBe(false);
  });
});

describe('runAgent', () => {
  it('success → ok, and the command writes its file', async () => {
    await inTempProject(async (dir) => {
      const res = await runAgent(shRunner('printf hi > out.md'), 'prompt');
      expect(res.ok).toBe(true);
      expect(existsSync(join(dir, 'out.md'))).toBe(true);
      expect(readFileSync(join(dir, 'out.md'), 'utf-8')).toBe('hi');
    });
  });

  it('non-zero exit → ok false with a stderr diagnostic', async () => {
    const res = await runAgent(shRunner('exit 1'), 'prompt');
    expect(res.ok).toBe(false);
    expect(typeof res.stderr).toBe('string');
  });

  it('captures the stdout tail on a clean exit that wrote nothing', async () => {
    const res = await runAgent(shRunner('echo "I cannot write: read-only sandbox"'), 'prompt');
    expect(res.ok).toBe(true);
    expect(res.stdout).toContain('read-only sandbox');
  });

  it('carries the stdout tail alongside a non-zero exit diagnostic', async () => {
    const res = await runAgent(shRunner('echo refused; exit 3'), 'prompt');
    expect(res.ok).toBe(false);
    expect(res.stdout).toBe('refused');
  });

  it('timeout → ok false, stderr "timed out"', async () => {
    // Long sleep + small runner timeout so the only way this resolves in time
    // is the runAgent timeout firing — no race with the test-framework cap.
    const res = await runAgent(shRunner('sleep 30', 200), 'prompt');
    expect(res.ok).toBe(false);
    expect(res.stderr).toBe('timed out');
  }, 10000);

  it('spawn() throwing synchronously still resolves (never rejects), with a transcript', async () => {
    // A NUL byte in the binary name reliably makes node's spawn() throw
    // synchronously — the same failure shape as an npm .cmd/.ps1 shim on
    // Windows, without needing an actual Windows host to reproduce it.
    const throwingRunner: AgentRunner = {
      binary: 'bad\0name',
      buildArgs: () => ['x'],
    };
    const res = await runAgent(throwingRunner, 'prompt');
    expect(res.ok).toBe(false);
    expect(typeof res.stderr).toBe('string');
    expect(res.transcript).toBeDefined();
    expect(res.transcript?.argv).toEqual(['bad\0name', 'x']);
  });
});

describe('checkAgentReady', () => {
  it('binary missing on PATH → not-found', async () => {
    const missing: AgentRunner = { binary: 'definitely-missing-bin-xyz', buildArgs: () => [] };
    expect(await checkAgentReady(missing)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('binary on PATH and exits clean → ok', async () => {
    expect(await checkAgentReady(shRunner('exit 0'))).toEqual({ ok: true });
  });

  it('binary on PATH but exits non-zero → failed, with a diagnostic', async () => {
    const result = await checkAgentReady(shRunner('echo boom; exit 1'));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('failed');
    expect(result.detail).toContain('exited with code 1');
  });

  it('binary on PATH but hangs → failed, timed out', async () => {
    // The check ignores the runner's own timeoutMs and uses its own (shorter)
    // budget; shrink that budget via env so the test doesn't wait out a real one.
    const prior = process.env.PAYO_AGENT_HELLO_TIMEOUT_MS;
    process.env.PAYO_AGENT_HELLO_TIMEOUT_MS = '200';
    try {
      const result = await checkAgentReady(shRunner('sleep 30'));
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('failed');
      expect(result.detail).toBe('timed out');
    } finally {
      if (prior === undefined) delete process.env.PAYO_AGENT_HELLO_TIMEOUT_MS;
      else process.env.PAYO_AGENT_HELLO_TIMEOUT_MS = prior;
    }
  }, 10000);
});
