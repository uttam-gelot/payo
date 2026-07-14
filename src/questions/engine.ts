/**
 * Walks the flow sections in order against live answers, so each question sees
 * everything answered before it and expansion points resolve dynamically.
 * Recommendable sections offer a single "use recommended" gate that shows the
 * defaults and, on yes, applies them and skips the rest of the group.
 * Already-answered ids are skipped (resume); `when`-gated questions are skipped
 * when their condition is false.
 */
import { note } from '@clack/prompts';
import type { Answers, FlowSection, Question } from './types';
import {
  runQuestion,
  reviewAction,
  selectAnswerToEdit,
  offersOther,
  resolveOptions,
} from './runner';
import { answerLabel, questionSummary, recommendedAnswer, recommendedLabel } from './recommend';
import { recordAnswer, forgetAnswers, type Session } from '../state/index';

interface PlannedDefault {
  question: Question;
  value: string | string[] | boolean;
}

/**
 * Project the questions this section would ask, in order, applying recommended
 * defaults so dependent `when` conditions resolve as they will under the skip.
 * Returns null when any askable question lacks a default (group not skippable).
 */
export function planRecommended(section: FlowSection, session: Session): PlannedDefault[] | null {
  const sim: Answers = { ...session.answers };
  const plan: PlannedDefault[] = [];
  for (const q of section.questions(sim)) {
    if (session.answered.includes(q.id)) continue;
    if (q.when && !q.when(sim)) continue;
    const value = recommendedAnswer(q, sim);
    if (value === undefined) return null;
    plan.push({ question: q, value });
    sim[q.id] = value;
  }
  return plan;
}

/** The "not applicable" value stored for a question skipped via the group gate. */
function skipValue(q: Question): string | string[] | boolean {
  switch (q.type) {
    case 'multiselect':
      return [];
    case 'confirm':
      return false;
    default:
      // select / text — the generator treats '' and 'none' as unset.
      return 'none';
  }
}

/**
 * Project the questions this section would ask, assigning each a "skip" sentinel
 * so dependent `when` conditions resolve as they will once the group is skipped.
 * Unlike planRecommended this never bails — every askable question gets a value.
 */
export function planSkip(section: FlowSection, session: Session): PlannedDefault[] {
  const sim: Answers = { ...session.answers };
  const plan: PlannedDefault[] = [];
  for (const q of section.questions(sim)) {
    if (session.answered.includes(q.id)) continue;
    if (q.when && !q.when(sim)) continue;
    const value = skipValue(q);
    plan.push({ question: q, value });
    sim[q.id] = value;
  }
  return plan;
}

/** Ask the section's questions in order, evaluating `when` against live answers. */
async function askEach(section: FlowSection, session: Session): Promise<Session> {
  for (const q of section.questions(session.answers)) {
    if (session.answered.includes(q.id)) continue;
    if (q.when && !q.when(session.answers)) continue;
    const answer = await runQuestion(q, session.answers);
    session = recordAnswer(session, q.id, answer);
  }
  return session;
}

/** Map a stored gate decision (current string form or legacy boolean) to an action. */
function gateDecision(stored: unknown): 'recommended' | 'customize' | 'skip' | undefined {
  if (stored === 'recommended' || stored === 'customize' || stored === 'skip') return stored;
  if (stored === true) return 'recommended'; // legacy boolean sessions
  if (stored === false) return 'customize';
  return undefined;
}

/** True when a stored answer carries no real content (skipped / not-applicable). */
function isUnset(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === 'none') return true;
  return Array.isArray(value) && value.length === 0;
}

/** The active gate for a recommendable section under these answers, or null. */
function activeGate(section: FlowSection, answers: Answers): { id: string; title: string } | null {
  return section.recommendable ? (section.gate?.(answers) ?? null) : null;
}

/**
 * The `summary: label` review line for a content question, or null when it is a
 * gate decision or carries no content (unset / skipped). Shared by reviewLines and
 * editableItems so the two never drift on what counts as a reviewable answer.
 */
function contentLabel(q: Question, answers: Answers): string | null {
  if (q.id.endsWith('__recommended')) return null;
  const value = answers[q.id];
  if (isUnset(value)) return null;
  return `${questionSummary(q)}: ${answerLabel(q, value, answers)}`;
}

/**
 * One `summary: label` line per answered question, walking the flow in order so the
 * review reads like the questionnaire. Gate decisions and unset (skipped) answers are
 * omitted; booleans render as Yes/No so explicit confirms still show.
 */
export function reviewLines(flow: FlowSection[], answers: Answers): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const section of flow) {
    for (const q of section.questions(answers)) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      const label = contentLabel(q, answers);
      if (label) lines.push(label);
    }
  }
  return lines;
}

/**
 * One row the user can pick from the review's "Edit an answer" list. A `gate` item
 * re-opens a whole recommendable section (including skipped ones); a `question`
 * item re-asks a single answered question.
 */
export interface EditItem {
  id: string;
  label: string;
  kind: 'gate' | 'question';
}

/** Short state word for a section's gate decision, used in the edit list. */
function decisionLabel(stored: unknown): string {
  switch (gateDecision(stored)) {
    case 'recommended':
      return 'recommended';
    case 'skip':
      return 'skipped';
    default:
      return 'customized';
  }
}

/**
 * Items the user can edit from review, in flow order: each active recommendable
 * section as a gate row (so skipped sections can be re-opened) followed by its
 * answered, content-bearing questions. Skipped sections contribute only the gate
 * row, since their answers are unset sentinels.
 */
export function editableItems(flow: FlowSection[], session: Session): EditItem[] {
  const out: EditItem[] = [];
  const seen = new Set<string>();
  for (const section of flow) {
    const questions = section.questions(session.answers);
    const gate = activeGate(section, session.answers);
    if (gate && questions.length > 0) {
      out.push({
        id: gate.id,
        kind: 'gate',
        label: `${gate.title} settings: ${decisionLabel(session.answers[gate.id])}`,
      });
    }
    for (const q of questions) {
      if (seen.has(q.id)) continue;
      seen.add(q.id);
      const label = contentLabel(q, session.answers);
      if (label) out.push({ id: q.id, kind: 'question', label });
    }
  }
  return out;
}

/**
 * Re-open a recommendable section: forget its gate decision and every answer it
 * owns, so the next runFlow re-offers the gate and re-drives the group. Used to
 * un-skip (or otherwise re-decide) a section from the review screen.
 */
export function forgetSection(flow: FlowSection[], session: Session, gateId: string): Session {
  const section = flow.find((s) => activeGate(s, session.answers)?.id === gateId);
  if (!section) return session;
  const ids = section.questions(session.answers).map((q) => q.id);
  return forgetAnswers(session, [...ids, gateId]);
}

/** The live Question for an id, projected against current answers (questions are dynamic). */
export function findQuestion(
  flow: FlowSection[],
  answers: Answers,
  id: string,
): Question | undefined {
  for (const section of flow) {
    for (const q of section.questions(answers)) {
      if (q.id === id) return q;
    }
  }
  return undefined;
}

/** Ids reachable under the given answers: askable questions + active gate decisions. */
function reachableIds(flow: FlowSection[], answers: Answers): Set<string> {
  const ids = new Set<string>();
  for (const section of flow) {
    const gate = activeGate(section, answers);
    if (gate) ids.add(gate.id);
    for (const q of section.questions(answers)) {
      if (q.when && !q.when(answers)) continue;
      ids.add(q.id);
    }
  }
  return ids;
}

/**
 * Answered closed-set selects whose stored value fell out of the current option
 * set (e.g. `language: 'rust'` after editing projectType to `frontend`, which
 * narrows the language options). The question stays reachable, so reachability
 * alone keeps the invalid value and downstream options compute off it. Open
 * sets (Other allowed) are exempt — an off-list value there may be a legitimate
 * custom entry.
 */
function outOfRangeIds(flow: FlowSection[], s: Session): string[] {
  const out: string[] = [];
  for (const id of s.answered) {
    const q = findQuestion(flow, s.answers, id);
    if (!q || q.type !== 'select') continue;
    const options = resolveOptions(q, s.answers);
    if (options.length === 0 || offersOther(q, options)) continue;
    const v = s.answers[id];
    if (typeof v === 'string' && !options.some((o) => o.value === v)) out.push(id);
  }
  return out;
}

/**
 * After an edit, drop any stored answer no longer reachable in the flow (question
 * removed or its `when` now false), or whose value is no longer a valid option.
 * Loops to a fixpoint since clearing one answer can make a dependent one
 * unreachable. runFlow then re-asks any newly-unlocked question.
 */
export function reconcile(flow: FlowSection[], session: Session): Session {
  let s = session;
  for (;;) {
    const reachable = reachableIds(flow, s.answers);
    const stale = [...s.answered.filter((id) => !reachable.has(id)), ...outOfRangeIds(flow, s)];
    if (stale.length === 0) return s;
    s = forgetAnswers(s, stale);
  }
}

/**
 * Show the review screen and let the user edit prior answers in a loop until they
 * choose Generate. A gate item re-opens a whole section (incl. skipped ones); a
 * question item re-asks one answer. Either way we reconcile dependent answers
 * (dropping ones that became unreachable) then re-run the flow to ask anything
 * newly unlocked.
 */
export async function reviewAndEdit(
  flow: FlowSection[],
  session: Session,
  prompts: {
    review?: () => Promise<'generate' | 'edit'>;
    pickEdit?: (items: EditItem[]) => Promise<string | undefined>;
  } = {},
): Promise<Session> {
  const review = prompts.review ?? reviewAction;
  const pickEdit = prompts.pickEdit ?? selectAnswerToEdit;
  for (;;) {
    note(reviewLines(flow, session.answers).join('\n'), 'Review your stack');
    if ((await review()) === 'generate') return session;

    const items = editableItems(flow, session);
    const id = await pickEdit(items);
    if (!id) continue; // ← Back
    const item = items.find((i) => i.id === id);
    if (!item) continue;

    if (item.kind === 'gate') {
      session = forgetSection(flow, session, id);
    } else {
      const q = findQuestion(flow, session.answers, id);
      if (!q) continue;
      session = recordAnswer(session, id, await runQuestion(q, session.answers));
    }
    session = reconcile(flow, session);
    session = await runFlow(flow, session);
  }
}

/** Options controlling how runFlow resolves recommendable gates. */
export interface RunFlowOptions {
  /**
   * Resolve every recommendable gate to its recommended defaults WITHOUT prompting
   * — recommended value per question where one exists, else the skip sentinel.
   * Used by "detect everything", where the user confirms once at the review screen
   * instead of gate-by-gate. Already-answered ids (detected facts) are untouched,
   * so detection always wins over a recommended default.
   */
  autoRecommendGates?: boolean;
}

export async function runFlow(
  flow: FlowSection[],
  session: Session,
  opts: RunFlowOptions = {},
): Promise<Session> {
  for (const section of flow) {
    const gate = activeGate(section, session.answers);

    if (gate) {
      const skipPlan = planSkip(section, session);
      // Offer the gate only when the group still has questions to ask.
      if (skipPlan.length > 0) {
        const plan = planRecommended(section, session);
        const hasRecommended = !!plan && plan.length > 0;

        // Auto mode: settle the whole group to recommended-or-skip, no prompt.
        // Record the gate decision as 'recommended' so the review's edit list can
        // still re-open the section. planSkip already covers every askable
        // question; overlay recommended values where a default exists.
        if (opts.autoRecommendGates) {
          session = recordAnswer(session, gate.id, 'recommended');
          const recommended = new Map(plan?.map((p) => [p.question.id, p.value]));
          for (const { question, value } of skipPlan) {
            session = recordAnswer(session, question.id, recommended.get(question.id) ?? value);
          }
          continue;
        }

        let decision = gateDecision(session.answers[gate.id]);
        if (decision === undefined) {
          const options = [
            ...(hasRecommended
              ? [{ value: 'recommended', label: `Use recommended ${gate.title} settings` }]
              : []),
            { value: 'customize', label: 'Customize — answer each' },
            { value: 'skip', label: `Skip ${gate.title}` },
          ];
          if (hasRecommended) {
            const lines = plan.map(
              (p) =>
                `• ${questionSummary(p.question)} → ${recommendedLabel(p.question, session.answers)}`,
            );
            note(lines.join('\n'), `Recommended ${gate.title} settings`);
          }
          const chosen = await runQuestion(
            {
              id: gate.id,
              type: 'select',
              message: `${gate.title} — how to proceed?`,
              options,
              allowOther: false,
            },
            session.answers,
          );
          session = recordAnswer(session, gate.id, chosen);
          decision = gateDecision(chosen);
        }

        if (decision === 'recommended' && plan) {
          for (const { question, value } of plan) {
            session = recordAnswer(session, question.id, value);
          }
          continue;
        }
        if (decision === 'skip') {
          for (const { question, value } of skipPlan) {
            session = recordAnswer(session, question.id, value);
          }
          continue;
        }
        // 'customize' falls through to ask each question.
      }
    }

    session = await askEach(section, session);
  }
  return session;
}
