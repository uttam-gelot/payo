import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry (vocab reads it)
import { llmDetect, type LlmDeps } from '../../src/detect/llm';
import type { DetectionResult } from '../../src/detect/types';
import type { AgentRunner } from '../../src/generator/types';

const fakeRunner = {
  binary: 'fake',
  buildArgs: () => [],
  outputPath: () => 'out',
} as AgentRunner;

/** Base: a TS/Next full-stack project with a few Tier-1 ids already found. */
const base = (): DetectionResult => ({
  answers: { language: 'typescript', framework: 'nextjs', projectType: 'full-stack' },
  sources: { language: 'config', framework: 'package.json', projectType: 'package.json' },
});

function deps(
  readResultVal: Record<string, unknown> | undefined,
  opts: { available?: boolean; ok?: boolean; runner?: AgentRunner | undefined } = {},
): LlmDeps {
  return {
    resolveRunner: () => ('runner' in opts ? opts.runner : fakeRunner),
    isAvailable: () => opts.available ?? true,
    runAgent: () => Promise.resolve({ ok: opts.ok ?? true }),
    readResult: () => readResultVal,
    cleanup: () => {},
  };
}

describe('llmDetect — Stage 2', () => {
  it('merges valid values and fills only blanks (never overrides Stage 1)', async () => {
    const d = deps({ logger: 'pino', validation: 'zod', framework: 'express' });
    const res = await llmDetect(base(), 'claude', 'partial', '/tmp', d);
    expect(res.answers.logger).toBe('pino');
    expect(res.answers.validation).toBe('zod');
    // framework was already detected by Stage 1 — LLM must not override it.
    expect(res.answers.framework).toBe('nextjs');
    expect(res.sources.logger).toBe('llm');
    expect(res.sources.framework).toBe('package.json');
  });

  it('drops off-vocab values and unknown ids', async () => {
    const d = deps({ logger: 'not-a-real-logger', bogusId: 'x', validation: 'zod' });
    const res = await llmDetect(base(), 'claude', 'partial', '/tmp', d);
    expect('logger' in res.answers).toBe(false);
    expect('bogusId' in res.answers).toBe(false);
    expect(res.answers.validation).toBe('zod');
  });

  it('pre-fills Tier-2 structure only in "everything" mode', async () => {
    const everything = await llmDetect(
      base(),
      'claude',
      'everything',
      '/tmp',
      deps({ structure: 'monorepo' }),
    );
    expect(everything.answers.structure).toBe('monorepo');

    const partial = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({ structure: 'monorepo' }),
    );
    expect('structure' in partial.answers).toBe(false);
  });

  it('falls back to base when no agent resolves', async () => {
    const res = await llmDetect(
      base(),
      undefined,
      'partial',
      '/tmp',
      deps({ logger: 'pino' }, { runner: undefined }),
    );
    expect(res).toEqual(base());
  });

  it('falls back when the agent is unavailable', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({ logger: 'pino' }, { available: false }),
    );
    expect(res).toEqual(base());
  });

  it('falls back when the agent run fails', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({ logger: 'pino' }, { ok: false }),
    );
    expect(res).toEqual(base());
  });

  it('falls back when no parseable result is written', async () => {
    const res = await llmDetect(base(), 'claude', 'partial', '/tmp', deps(undefined));
    expect(res).toEqual(base());
  });
});
