import { describe, it, expect } from 'bun:test';
import { spinnerLabel } from '../../src/cli/index';

/**
 * A clack spinner frame is `${symbol}  ${label}${dots}` — 3 columns of prefix
 * plus up to 3 animated dots. It must stay inside one terminal row, or clack's
 * erase step leaves the wrapped-off first row on screen once per tick.
 */
const frameWidth = (label: string) => 3 + label.length + 3;

describe('spinnerLabel', () => {
  it('leaves a label that already fits untouched', () => {
    expect(spinnerLabel('Analyzing your project with claude', 80)).toBe(
      'Analyzing your project with claude',
    );
  });

  it('keeps the rendered frame within one row at any width', () => {
    const text = 'Generating bootstrap prompt with Claude (Anthropic)';
    for (const columns of [120, 80, 70, 60, 50, 40, 30, 20]) {
      expect(frameWidth(spinnerLabel(text, columns))).toBeLessThanOrEqual(columns);
    }
  });

  it('truncates with an ellipsis once the frame would wrap', () => {
    // 51-char label + 6 columns of chrome = 57 > 50, so it must be clamped.
    const clamped = spinnerLabel('Generating bootstrap prompt with Claude (Anthropic)', 50);
    expect(clamped).not.toBe('Generating bootstrap prompt with Claude (Anthropic)');
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped.startsWith('Generating bootstrap prompt')).toBe(true);
  });

  it('gives up rather than emitting a stub on an absurdly narrow terminal', () => {
    expect(spinnerLabel('Generating bootstrap prompt', 10)).toBe('Generating bootstrap prompt');
  });
});
