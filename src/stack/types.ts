/**
 * Tech-stack module contract. A module owns: when it is offered as a choice,
 * its option entry, and the follow-up questions asked once it is selected.
 */
import type { Answers, Option, Question } from '../questions/types';

export type ContributorCategory =
  | 'framework'
  | 'orm'
  | 'styling'
  | 'api'
  | 'lint'
  | 'format'
  | 'config'
  | 'db';

export interface TechModule {
  /** e.g. 'nestjs' | 'nextjs' | 'postgresql' */
  id: string;
  /** Display name for the recommended-settings gate, e.g. 'Next.js'. */
  title?: string;
  category: ContributorCategory;
  /** Whether this module is offered as a choice given current answers. */
  appliesTo(a: Answers): boolean;
  /** This module's entry in its category's select list. */
  options?(a: Answers): Option<string>[];
  /** Follow-up questions asked after this module is selected. */
  questions(a: Answers): Question[];
}
