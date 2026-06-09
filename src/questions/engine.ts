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
import { runQuestion } from './runner';
import { answerLabel, questionSummary, recommendedAnswer, recommendedLabel } from './recommend';
import { recordAnswer, type Session } from '../state/index';

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
      if (seen.has(q.id) || q.id.endsWith('__recommended')) continue;
      seen.add(q.id);
      const value = answers[q.id];
      if (isUnset(value)) continue;
      lines.push(`${questionSummary(q)}: ${answerLabel(q, value, answers)}`);
    }
  }
  return lines;
}

export async function runFlow(flow: FlowSection[], session: Session): Promise<Session> {
  for (const section of flow) {
    const gate = section.recommendable ? (section.gate?.(session.answers) ?? null) : null;

    if (gate) {
      const skipPlan = planSkip(section, session);
      // Offer the gate only when the group still has questions to ask.
      if (skipPlan.length > 0) {
        const plan = planRecommended(section, session);
        const hasRecommended = !!plan && plan.length > 0;

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
