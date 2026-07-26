import { describe, it, expect } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  capsFor,
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
});
