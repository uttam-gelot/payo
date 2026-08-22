/**
 * Regression coverage for the product flow (#60 follow-up): pick a tool ->
 * confirm it works -> check whether this is an existing project -> if so,
 * that flow continues (detected facts get applied); if not (fresh pick, or
 * nothing detected, or a resumed session), the fresh-project flow continues
 * untouched. `selectAiToolTracked` only pins the freshness *flag*; this pins
 * that `runExistingProjectGate` actually branches on it and on what detection
 * finds. All external effects (detectStack, the prompts, the LLM pass) are
 * injected fakes, so this is a pure unit test — no module mocking, no races.
 */
import { describe, it, expect } from 'bun:test';
import { runExistingProjectGate } from '../../src/cli/index';
import { createSession, recordAnswer } from '../../src/state/index';
import type { DetectionResult } from '../../src/detect/index';

/** Session shape right before the gate runs in `run()`: aiTool already answered. */
const sessionWithAiTool = () => recordAnswer(createSession(), 'aiTool', 'claude');

const detectedExisting: DetectionResult = {
  answers: { language: 'typescript', projectType: 'backend' },
  sources: { language: 'package.json', projectType: 'package.json' },
};

describe('runExistingProjectGate', () => {
  it('existing project + user confirms -> existing-project flow continues', async () => {
    const { session, startedFromExisting, autoRecommendGates } = await runExistingProjectGate(
      sessionWithAiTool(),
      /* isFreshSession */ true,
      '/fake/cwd',
      {
        detectStack: () => detectedExisting,
        scanExistingAiConfigs: () => [],
        confirmStartMode: () => Promise.resolve('existing'),
        confirmDetectionDepth: () => Promise.resolve('partial'),
        willLlmDetectRun: () => false,
      },
    );

    expect(startedFromExisting).toBe(true);
    expect(autoRecommendGates).toBe(false);
    // The detected facts were applied and skipped, not left for the interview.
    expect(session.answered).toContain('language');
    expect(session.answered).toContain('projectType');
    expect(session.answers.language).toBe('typescript');
    expect(session.answers.projectType).toBe('backend');
    expect(session.answers.startedFromExisting).toBe(true);
  });

  it('existing project detected but user picks "start fresh" -> fresh flow continues', async () => {
    let startModeCalls = 0;
    const { session, startedFromExisting } = await runExistingProjectGate(
      sessionWithAiTool(),
      true,
      '/fake/cwd',
      {
        detectStack: () => detectedExisting,
        scanExistingAiConfigs: () => [],
        confirmStartMode: () => {
          startModeCalls++;
          return Promise.resolve('fresh');
        },
        confirmDetectionDepth: () => Promise.resolve('partial'),
        willLlmDetectRun: () => false,
      },
    );

    expect(startModeCalls).toBe(1);
    expect(startedFromExisting).toBe(false);
    // Nothing detected was seeded — the interview asks these fresh.
    expect(session.answered).not.toContain('language');
    expect(session.answered).not.toContain('projectType');
    expect(session.answers.startedFromExisting).toBeUndefined();
  });

  it('nothing detected (greenfield dir) -> gate never prompts, fresh flow continues', async () => {
    let startModeCalls = 0;
    const before = sessionWithAiTool();
    const { session, startedFromExisting } = await runExistingProjectGate(
      before,
      true,
      '/fake/cwd',
      {
        detectStack: () => ({ answers: {}, sources: {} }),
        confirmStartMode: () => {
          startModeCalls++;
          return Promise.resolve('existing');
        },
      },
    );

    expect(startModeCalls).toBe(0);
    expect(startedFromExisting).toBe(false);
    expect(session).toBe(before);
  });

  it('empty dir inside a git work tree (git-only signal) -> gate never prompts, fresh flow continues', async () => {
    // A freshly `git init`'d empty directory still reports branch/commit
    // conventions (git-ness comes from the enclosing work tree, not any
    // project file), so a git-only answer set must not read as "existing project".
    let startModeCalls = 0;
    const before = sessionWithAiTool();
    const { session, startedFromExisting } = await runExistingProjectGate(
      before,
      true,
      '/fake/cwd',
      {
        detectStack: () => ({
          answers: { branchNaming: 'kebab', commitConvention: 'conventional' },
          sources: { branchNaming: 'git', commitConvention: 'git' },
        }),
        confirmStartMode: () => {
          startModeCalls++;
          return Promise.resolve('existing');
        },
      },
    );

    expect(startModeCalls).toBe(0);
    expect(startedFromExisting).toBe(false);
    expect(session).toBe(before);
  });

  it('resumed session (not fresh) -> gate is skipped entirely, even in an existing project', async () => {
    let detectStackCalls = 0;
    let startModeCalls = 0;
    const before = sessionWithAiTool();
    const { session, startedFromExisting } = await runExistingProjectGate(
      before,
      /* isFreshSession */ false,
      '/fake/cwd',
      {
        detectStack: () => {
          detectStackCalls++;
          return detectedExisting;
        },
        confirmStartMode: () => {
          startModeCalls++;
          return Promise.resolve('existing');
        },
      },
    );

    expect(detectStackCalls).toBe(0);
    expect(startModeCalls).toBe(0);
    expect(startedFromExisting).toBe(false);
    expect(session).toBe(before);
  });
});
