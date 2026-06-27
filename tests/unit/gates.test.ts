import { describe, it, expect } from 'bun:test';
import { confirmStartMode, confirmDetectionDepth } from '../../src/questions/runner';

/** A SelectPrompt stub that always returns the given value. */
const pick = (value: string) => () => Promise.resolve(value);

describe('detection gates', () => {
  it('Gate 1 returns the chosen start mode', async () => {
    expect(await confirmStartMode(pick('existing'))).toBe('existing');
    expect(await confirmStartMode(pick('fresh'))).toBe('fresh');
  });

  it('Gate 2 returns the chosen detection depth', async () => {
    expect(await confirmDetectionDepth(pick('everything'))).toBe('everything');
    expect(await confirmDetectionDepth(pick('partial'))).toBe('partial');
  });
});
