/**
 * Regression test for the bug where existing-project detection was silently
 * skipped on every run (#60 follow-up). `selectAiTool` answers 'aiTool' via
 * `recordAnswer`, which returns a NEW session rather than mutating in place —
 * `run()` used to read freshness off that reassigned session, so 'aiTool'
 * being already in `answered` made every fresh session look resumed.
 * `selectAiToolTracked` fixes this by snapshotting freshness before the
 * (injected) `selectAiTool` call runs. No module mocking, no @clack/prompts,
 * no processes — a plain fake passed via `deps`, so this cannot race with any
 * other test file regardless of how bun schedules concurrency.
 */
import { describe, it, expect } from 'bun:test';
import { selectAiToolTracked } from '../../src/cli/index';
import { createSession, recordAnswer } from '../../src/state/index';

describe('selectAiToolTracked', () => {
  it('reports the session as fresh even though the fake selectAiTool answers aiTool', async () => {
    const session = createSession();
    const fakeSelectAiTool = (s: typeof session): Promise<typeof session> =>
      Promise.resolve(recordAnswer(s, 'aiTool', 'claude'));

    const { session: after, isFreshSession } = await selectAiToolTracked(session, {
      selectAiTool: fakeSelectAiTool,
    });

    // The regression: reading freshness off `after` here would be false.
    expect(isFreshSession).toBe(true);
    expect(after.answered).toContain('aiTool');
  });

  it('is not fresh when the session already carries prior answers', async () => {
    const session = recordAnswer(createSession(), 'projectType', 'backend');

    const { isFreshSession } = await selectAiToolTracked(session, {
      selectAiTool: (s) => Promise.resolve(s),
    });

    expect(isFreshSession).toBe(false);
  });
});
