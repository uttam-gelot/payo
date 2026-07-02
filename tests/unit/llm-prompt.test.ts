import { describe, it, expect } from 'bun:test';
import '../../src/stack/modules/index'; // populate the module registry (vocab reads it)
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildPrompt, targetIds, llmDetect, type LlmDeps } from '../../src/detect/llm';
import type { DetectionResult } from '../../src/detect/types';
import type { AgentRunner } from '../../src/generator/types';

const fakeRunner = { binary: 'fake', buildArgs: () => [], outputPath: () => 'out' } as AgentRunner;

function deps(raw: Record<string, unknown> | undefined): LlmDeps {
  return {
    resolveRunner: () => fakeRunner,
    isAvailable: () => true,
    runAgent: () => Promise.resolve({ ok: true }),
    readResult: () => raw,
    cleanup: () => {},
  };
}

describe('targetIds', () => {
  const base = (answers: Record<string, unknown>): DetectionResult => ({ answers, sources: {} });

  it('targets Tier-1 ids that Stage 1 missed, never already-known ones', () => {
    const ids = targetIds(base({ language: 'typescript', framework: 'nextjs' }), 'partial');
    expect(ids).toContain('database');
    expect(ids).toContain('logger');
    expect(ids).not.toContain('language'); // already known
    expect(ids).not.toContain('framework'); // already known
  });

  it('excludes Tier-2 conventions in partial mode', () => {
    expect(targetIds(base({ language: 'typescript' }), 'partial')).not.toContain('structure');
  });

  it('includes the hintable Tier-2 (structure) only in everything mode', () => {
    expect(targetIds(base({ language: 'typescript' }), 'everything')).toContain('structure');
  });

  it('never targets non-enumerable tsconfig.* ids', () => {
    const ids = targetIds(base({}), 'everything');
    expect(ids.some((id) => id.startsWith('tsconfig.'))).toBe(false);
  });
});

describe('buildPrompt', () => {
  function withProject<T>(files: Record<string, string>, fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'payo-prompt-'));
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

  it('includes the manifest body, the dir tree, and the per-id allowed vocab', () => {
    withProject(
      { 'package.json': '{"name":"acme","dependencies":{"next":"15"}}', 'src/app.ts': '' },
      (dir) => {
        const base: DetectionResult = {
          answers: { language: 'typescript', projectType: 'full-stack' },
          sources: {},
        };
        const prompt = buildPrompt(dir, ['database', 'logger'], base);
        expect(prompt).toContain('"acme"'); // manifest body
        expect(prompt).toContain('src/app.ts'); // tree path
        expect(prompt).toContain('database:'); // schema line
        expect(prompt).toContain('postgresql'); // allowed value listed
        expect(prompt).toContain('detection-llm.json'); // target file
        expect(prompt).toContain('Already known'); // known-section guard
      },
    );
  });

  it('M3: sends the manifest matching Stage 1’s ecosystem, not always package.json', () => {
    withProject(
      {
        'package.json': '{"name":"tooling-only","devDependencies":{"prettier":"3"}}',
        'pyproject.toml': '[project]\nname = "svc"\ndependencies = ["fastapi"]',
      },
      (dir) => {
        // Stage 1 chose Python; a stray package.json exists for tooling.
        const base: DetectionResult = { answers: { language: 'python' }, sources: {} };
        const prompt = buildPrompt(dir, ['framework'], base);
        expect(prompt).toContain('Manifest (pyproject.toml)');
        expect(prompt).toContain('fastapi'); // python manifest body sent
        expect(prompt).not.toContain('tooling-only'); // node manifest NOT sent
      },
    );
  });

  it('M3: falls back to the priority list when Stage 1 found no language', () => {
    withProject({ 'package.json': '{"name":"acme"}' }, (dir) => {
      const prompt = buildPrompt(dir, ['framework'], { answers: {}, sources: {} });
      expect(prompt).toContain('Manifest (package.json)');
      expect(prompt).toContain('"acme"');
    });
  });

  it('never leaks source file contents — only the manifest body and paths', () => {
    const secret = 'SECRET_API_KEY_9f8e7d';
    withProject(
      {
        'package.json': '{"name":"svc","dependencies":{"express":"4"}}',
        'src/secret.ts': `export const KEY = "${secret}";`,
      },
      (dir) => {
        const prompt = buildPrompt(dir, ['logger'], { answers: {}, sources: {} });
        expect(prompt).toContain('src/secret.ts'); // path is fine
        expect(prompt).not.toContain(secret); // contents are not
      },
    );
  });
});

describe('llmDetect — value validation edge cases', () => {
  const tsBase = (extra: Record<string, unknown> = {}): DetectionResult => ({
    answers: { language: 'typescript', projectType: 'full-stack', ...extra },
    sources: {},
  });

  it('keeps the valid subset of a list field, drops invalid entries', async () => {
    const res = await llmDetect(
      tsBase(),
      'claude',
      'partial',
      '/tmp',
      deps({
        testTypes: ['unit', 'bogus', 'e2e'],
      }),
    );
    expect(res.answers.testTypes).toEqual(['unit', 'e2e']);
  });

  it('drops a list field that has no valid entry', async () => {
    const res = await llmDetect(
      tsBase(),
      'claude',
      'partial',
      '/tmp',
      deps({
        testTypes: ['bogus', 'nope'],
      }),
    );
    expect('testTypes' in res.answers).toBe(false);
  });

  it('drops non-string scalar values', async () => {
    const res = await llmDetect(
      tsBase(),
      'claude',
      'partial',
      '/tmp',
      deps({
        logger: 123,
        validation: { a: 1 },
      }),
    );
    expect('logger' in res.answers).toBe(false);
    expect('validation' in res.answers).toBe(false);
  });

  it('never overrides a value Stage 1 already set', async () => {
    const res = await llmDetect(
      tsBase({ logger: 'pino' }),
      'claude',
      'partial',
      '/tmp',
      deps({
        logger: 'winston',
      }),
    );
    expect(res.answers.logger).toBe('pino');
  });
});
