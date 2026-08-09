/**
 * Regression test for the bug where `selectAiTool` (added in #60) answers
 * `aiTool` before the existing-project detection guard runs. `recordAnswer`
 * pushes 'aiTool' into `session.answered`, so a naive `session.answered.length
 * === 0` freshness check — read AFTER selectAiTool ran — is never true again,
 * and the whole existing-project flow (stack detection, Gate 1
 * `confirmStartMode`, Gate 2 `confirmDetectionDepth`) is silently skipped on
 * every run. `run()` must still detect an existing project and ask Gate 1
 * even though `aiTool` is answered first.
 *
 * Only the interactive prompt layer (`questions/runner`) needs mocking: with
 * `confirmOverwrite` scripted to 'skip', `run()` returns right after the
 * overwrite guard — before `generate()`, hooks, or the bootstrap prompt are
 * ever touched — so detection, state, and the generator all run for real.
 */
import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as realRunner from '../../src/questions/runner';
import * as realClack from '@clack/prompts';
import * as realAgent from '../../src/generator/agent';
import * as realLlm from '../../src/detect/llm';
import { recommendedAnswer } from '../../src/questions/recommend';
import { inTempProject } from '../helpers/tmpProject';
import type { Answers, Question } from '../../src/questions/types';

void mock.module('@clack/prompts', () => ({ ...realClack, note: () => undefined }));

// aiToolOptions() only offers providers with an `.agent` (src/questions/options.ts:16),
// so any value the real aiTool question can return will make selectAiTool run
// checkAgentReady. Stub it ok so the test doesn't depend on a real CLI being
// installed/authenticated on the machine running the suite.
void mock.module('../../src/generator/agent', () => ({
  ...realAgent,
  checkAgentReady: () => Promise.resolve({ ok: true }),
}));

// Real `willLlmDetectRun` would spawn the actual `claude` CLI (if this machine
// has it on PATH) to analyze the temp project — slow and unrelated to what
// this test checks. Stage 2 is additive/optional by design, so skipping it
// entirely does not affect the Gate 1 assertions below.
void mock.module('../../src/detect/llm', () => ({
  ...realLlm,
  willLlmDetectRun: () => false,
}));

let sawConfirmStartMode = false;
let sawConfirmDetectionDepth = false;
let askedIds: string[] = [];

void mock.module('../../src/questions/runner', () => ({
  ...realRunner,
  confirmStartMode: (): Promise<'existing' | 'fresh'> => {
    sawConfirmStartMode = true;
    return Promise.resolve('existing');
  },
  confirmDetectionDepth: (): Promise<'everything' | 'partial'> => {
    sawConfirmDetectionDepth = true;
    return Promise.resolve('partial');
  },
  confirmOverwrite: (): Promise<'overwrite' | 'backup' | 'skip'> => Promise.resolve('skip'),
  reviewAction: (): Promise<'generate' | 'edit'> => Promise.resolve('generate'),
  // 'claude' is a real, agent-bearing provider — a valid aiTool option, so
  // `reconcile` never flags it as out-of-range and re-asks it.
  runQuestion: (q: Question, a: Answers): Promise<unknown> => {
    askedIds.push(q.id);
    if (q.id === 'aiTool') return Promise.resolve('claude');
    if (q.id.endsWith('__recommended')) return Promise.resolve(true);
    const rec = recommendedAnswer(q, a);
    if (rec !== undefined) return Promise.resolve(rec);
    switch (q.type) {
      case 'multiselect':
        return Promise.resolve([]);
      case 'confirm':
        return Promise.resolve(false);
      case 'text':
        return Promise.resolve('test');
      default:
        return Promise.resolve(realRunner.resolveOptions(q, a)[0]?.value ?? 'none');
    }
  },
}));

// Import after the mocks are registered.
const { run } = await import('../../src/cli/index');

beforeEach(() => {
  sawConfirmStartMode = false;
  sawConfirmDetectionDepth = false;
  askedIds = [];
});

describe('run() — existing-project detection survives selectAiTool', () => {
  it('still asks Gate 1 (confirmStartMode) even though aiTool is answered first', async () => {
    await inTempProject(async (dir) => {
      // Non-empty package.json ⇒ detectStack() returns non-empty answers,
      // which is what gates entry into the existing-project branch at all.
      writeFileSync(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'x', dependencies: { react: '18' } }),
      );
      // predictTargets() always includes the entrypoint file, so this
      // guarantees existingTargets(...) is non-empty regardless of which AI
      // tool gets picked — the real (non-mocked) trigger for confirmOverwrite,
      // which is how this test gets a clean early exit before generate().
      writeFileSync(join(dir, 'AGENTS.md'), '# existing\n');

      await run();
    });

    expect(sawConfirmStartMode).toBe(true);
    expect(sawConfirmDetectionDepth).toBe(true);
    expect(askedIds.filter((id) => id === 'aiTool')).toEqual(['aiTool']);
  });
});
