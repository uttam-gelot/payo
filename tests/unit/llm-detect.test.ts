import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry (vocab reads it)
import { llmDetect, willLlmDetectRun, type LlmDeps } from '../../src/detect/llm';
import type { DetectionResult } from '../../src/detect/types';
import type { AgentRunner } from '../../src/generator/types';

const fakeRunner = {
  binary: 'fake',
  buildArgs: () => [],
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

describe('willLlmDetectRun', () => {
  it('is true when an agent is available and there are blanks to fill', () => {
    expect(willLlmDetectRun(base(), 'claude', 'partial', deps({}))).toBe(true);
  });

  it('is false when no agent resolves', () => {
    expect(willLlmDetectRun(base(), undefined, 'partial', deps({}, { runner: undefined }))).toBe(
      false,
    );
  });

  it('is false when the agent is unavailable', () => {
    expect(willLlmDetectRun(base(), 'claude', 'partial', deps({}, { available: false }))).toBe(
      false,
    );
  });

  it('is false when every target id is already filled', () => {
    // A fully-detected project leaves nothing for Stage 2 to do.
    const full: DetectionResult = {
      answers: Object.fromEntries(
        [
          'projectType',
          'language',
          'framework',
          'apiArchitecture',
          'stylingLibrary',
          'database',
          'orm',
          'formatter',
          'linter',
          'logger',
          'testTypes',
          'testRunner',
          'e2eTool',
          'authApproach',
          'packageManager',
          'runtime',
          'validation',
          'stateManagement',
          'structure',
        ].map((id) => [id, 'x']),
      ),
      sources: {},
    };
    expect(willLlmDetectRun(full, 'claude', 'everything', deps({}))).toBe(false);
  });
});

describe('llmDetect — __conflicts channel', () => {
  it('keeps a well-formed conflict against a Stage-1 answer', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({
        database: 'postgresql',
        __conflicts: [
          { id: 'projectType', suggested: 'backend', evidence: 'README: Rust Lambda backend' },
        ],
      }),
    );
    expect(res.conflicts).toEqual([
      { id: 'projectType', suggested: 'backend', evidence: 'README: Rust Lambda backend' },
    ]);
    // The conflicting id itself is NOT overridden.
    expect(res.answers.projectType).toBe('full-stack');
  });

  it('drops conflicts for unknown ids, off-vocab suggestions, and same-as-current values', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({
        database: 'postgresql',
        __conflicts: [
          { id: 'database', suggested: 'mysql', evidence: 'not answered by Stage 1' },
          { id: 'projectType', suggested: 'bogus-type', evidence: 'off vocab' },
          { id: 'projectType', suggested: 'full-stack', evidence: 'same as current' },
        ],
      }),
    );
    expect(res.conflicts).toBeUndefined();
  });

  it('caps conflicts at 5 and de-duplicates by id', async () => {
    const conflictOptions = ['backend', 'frontend', 'cli', 'script', 'library'];
    const spam = Array.from({ length: 12 }, (_, i) => ({
      id: 'projectType',
      suggested: conflictOptions[i % conflictOptions.length],
      evidence: `n${i}`,
    }));
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({ database: 'postgresql', __conflicts: spam }),
    );
    expect(res.conflicts).toHaveLength(1); // one id → one conflict, rest deduped
  });

  it('truncates evidence and tolerates malformed entries', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({
        database: 'postgresql',
        __conflicts: [
          null,
          'garbage',
          { id: 42 },
          { id: 'projectType', suggested: 'backend', evidence: 'e'.repeat(500) },
        ],
      }),
    );
    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts![0].evidence.length).toBe(200);
  });

  it('conflicts alone (no fills) still come back', async () => {
    const res = await llmDetect(
      base(),
      'claude',
      'partial',
      '/tmp',
      deps({
        __conflicts: [{ id: 'projectType', suggested: 'backend', evidence: 'docs' }],
      }),
    );
    expect(res.conflicts).toHaveLength(1);
  });

  it('preserves a monorepo base: packages and secondary survive the Stage-2 merge', async () => {
    const mono: DetectionResult = {
      ...base(),
      packages: [{ path: 'services', language: 'rust' }],
      secondary: ['rust'],
    };
    const res = await llmDetect(
      mono,
      'claude',
      'partial',
      '/tmp',
      deps({ database: 'postgresql' }),
    );
    expect(res.answers.database).toBe('postgresql');
    expect(res.packages).toEqual([{ path: 'services', language: 'rust' }]);
    expect(res.secondary).toEqual(['rust']);
  });
});
