/**
 * Declarative question model. Questions are plain data so the engine can walk
 * them generically — that is what makes the flow dynamic.
 */
export type Option<Value> = { value: Value; label: string; hint?: string };

export type Answers = Record<string, unknown>;

export type QuestionType = 'select' | 'multiselect' | 'text' | 'confirm';

export interface Question {
  /** Stable storage key, e.g. 'framework' or 'nestjs.arch'. */
  id: string;
  type: QuestionType;
  message: string;
  /** Short noun-phrase label for the recommended-defaults note (e.g. 'Router'). */
  summary?: string;
  /** Static options (select / multiselect). */
  options?: Option<string>[];
  /** Dynamic options computed from prior answers. Takes precedence over `options`. */
  optionsFrom?: (a: Answers) => Option<string>[];
  /** Skip this question when it returns false. */
  when?: (a: Answers) => boolean;
  /**
   * Append an "Other (specify)" choice to a select/multiselect. Defaults to on;
   * set `false` only to force a closed set. (Ignored for confirm/text.)
   */
  allowOther?: boolean;
  /** multiselect: require at least one. */
  required?: boolean;
  /**
   * multiselect: dynamic initial checks derived from prior answers, used when
   * there is no stored answer yet. Unlike the `recommended` hint, this seeds the
   * default selection without tagging any option "recommended".
   */
  initialFrom?: (a: Answers) => string[];
  /** text: validation message or undefined when valid. */
  validate?: (v: string) => string | undefined;
  /** text: placeholder shown in the input — static or derived from prior answers. */
  placeholder?: string | ((a: Answers) => string);
  /**
   * Explicit recommended default for confirm/text questions. For select and
   * multiselect, the recommended value is derived from the option(s) carrying
   * `hint: 'recommended'`; this field overrides that when set.
   */
  recommended?: string | string[] | boolean;
  /**
   * "Detect everything" only: keep the recommended default even when the question
   * was not detected. Marks a safe assistant-behavior policy (e.g. confirm-before-push)
   * rather than a code-derived project fact — undetected facts are skipped instead of
   * fabricated, but these policies are applied (and surfaced explicitly to the user).
   */
  policyDefault?: boolean;
}

/** Yields zero or more questions given current answers. Unit of composition. */
export type QuestionProducer = (a: Answers) => Question[];

/**
 * A group of questions in the flow. When `recommendable`, the engine offers a
 * single "use recommended" gate that shows the defaults and, on yes, applies
 * them and skips the group. Single-question sections omit `recommendable`.
 */
export interface FlowSection {
  /** Opt-in: offer the "use recommended" skip for this group. */
  recommendable?: boolean;
  /** Gate identity, resolved from answers (tech title comes from the selected module). */
  gate?: (a: Answers) => { id: string; title: string } | null;
  questions(a: Answers): Question[];
}
