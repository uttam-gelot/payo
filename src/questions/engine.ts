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
import { questionSummary, recommendedAnswer, recommendedLabel } from './recommend';
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

export async function runFlow(flow: FlowSection[], session: Session): Promise<Session> {
  for (const section of flow) {
    const gate = section.recommendable ? (section.gate?.(session.answers) ?? null) : null;

    if (gate) {
      const plan = planRecommended(section, session);
      // Offer the gate only when something remains and every question is defaultable.
      if (plan && plan.length > 0) {
        let decision = session.answers[gate.id];
        if (decision === undefined) {
          const lines = plan.map(
            (p) =>
              `• ${questionSummary(p.question)} → ${recommendedLabel(p.question, session.answers)}`,
          );
          note(lines.join('\n'), `Recommended ${gate.title} settings`);
          decision = await runQuestion(
            { id: gate.id, type: 'confirm', message: `Use recommended ${gate.title} settings?` },
            session.answers,
          );
          session = recordAnswer(session, gate.id, decision);
        }
        if (decision === true) {
          for (const { question, value } of plan) {
            session = recordAnswer(session, question.id, value);
          }
          continue;
        }
      }
    }

    session = await askEach(section, session);
  }
  return session;
}
