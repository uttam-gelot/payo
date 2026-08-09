import { describe, it, expect } from 'bun:test';
import { shouldOfferBootstrapPrompt } from '../../src/cli/index';
import { createSession } from '../../src/state/index';

describe('shouldOfferBootstrapPrompt', () => {
  it('skips the prompt during the current existing-project run', () => {
    expect(shouldOfferBootstrapPrompt(createSession(), true)).toBe(false);
  });

  it('skips the prompt when the existing-project mode is stored on the session', () => {
    const session = {
      ...createSession(),
      answers: { startedFromExisting: true },
      answered: ['startedFromExisting'],
    };

    expect(shouldOfferBootstrapPrompt(session, false)).toBe(false);
  });

  it('offers the prompt for greenfield runs', () => {
    expect(shouldOfferBootstrapPrompt(createSession(), false)).toBe(true);
  });

  it('offers the prompt when an existing directory was intentionally started fresh', () => {
    const session = {
      ...createSession(),
      answers: { language: 'typescript' },
      answered: ['language'],
    };

    expect(shouldOfferBootstrapPrompt(session, false)).toBe(true);
  });
});
