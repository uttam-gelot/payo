import { describe, it, expect } from 'bun:test';
import { flow } from '../../src/questions/flow';
import { planRecommended } from '../../src/questions/engine';
import { contexts, freshSession } from '../fixtures';

/**
 * Regression guard for the catalog: for every context, every recommendable
 * group whose gate resolves must be gate-eligible — i.e. `planRecommended`
 * returns non-null, meaning every askable follow-up has a recommended default.
 */
describe('flow gate-eligibility', () => {
  for (const [name, answers] of Object.entries(contexts)) {
    it(`every recommendable group is gate-eligible: ${name}`, () => {
      const session = freshSession(answers);
      const notEligible: string[] = [];
      for (const section of flow) {
        if (!section.recommendable) continue;
        const gate = section.gate?.(session.answers);
        if (!gate) continue;
        if (planRecommended(section, session) === null) notEligible.push(gate.title);
      }
      expect(notEligible).toEqual([]);
    });
  }
});
