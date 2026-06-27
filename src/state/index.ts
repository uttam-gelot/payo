import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { config } from '../config';
import { writeFileAtomic } from '../fsutil';
import type { Answers } from '../questions/types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const SessionSchema = z.object({
  session_id: z.string().uuid(),
  version: z.literal('v2'),
  /** Dynamic answer map keyed by question id. */
  answers: z.record(z.string(), z.unknown()),
  /** Question ids already answered, in order — drives resume. */
  answered: z.array(z.string()),
  /** Skill ids whose agent run completed — lets generation resume mid-way. */
  generated: z.array(z.string()).default([]),
});

export type Session = z.infer<typeof SessionSchema>;

// ---------------------------------------------------------------------------
// File paths — resolved live (config.payo.dir() reads the current cwd, so
// these must not be frozen at import time).
// ---------------------------------------------------------------------------

const sessionDir = (): string => config.payo.dir();
const sessionFile = (): string => path.join(sessionDir(), 'session.json');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialise a brand-new session. */
export function createSession(): Session {
  return {
    session_id: randomUUID(),
    version: 'v2',
    answers: {},
    answered: [],
    generated: [],
  };
}

/** Load existing session from disk. Returns null if not found or corrupt. */
export function loadSession(): Session | null {
  const file = sessionFile();
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const result = SessionSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/** Save session to disk using an atomic write-then-rename pattern. */
export function saveSession(session: Session): void {
  writeFileAtomic(sessionFile(), JSON.stringify(session, null, 2));
}

/** Delete the session file (used on Restart or after successful completion). */
export function clearSession(): void {
  const file = sessionFile();
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

/** Check whether a session file already exists on disk. */
export function sessionExists(): boolean {
  return fs.existsSync(sessionFile());
}

/** Record a single answer, mark its question id answered, and persist. */
export function recordAnswer(session: Session, id: string, value: unknown): Session {
  const answers: Answers = { ...session.answers, [id]: value };
  const answered = session.answered.includes(id) ? session.answered : [...session.answered, id];
  const updated: Session = { ...session, answers, answered };
  saveSession(updated);
  return updated;
}

/**
 * Seed detected answer values WITHOUT marking them answered, so the flow still
 * re-asks each question — but pre-selected to the detected value (runner reads
 * the stored value as the prompt's initial highlight). Used by the "review &
 * edit" detection path; the "use these" path uses recordAnswer instead.
 */
export function seedDetected(session: Session, values: Record<string, unknown>): Session {
  const ids = Object.keys(values);
  if (ids.length === 0) return session;
  const answers: Answers = { ...session.answers, ...values };
  const updated: Session = { ...session, answers };
  saveSession(updated);
  return updated;
}

/**
 * Drop one or more answers (value + answered entry) in a single persisted update.
 * Returns the session unchanged (no write) when none of the ids were present.
 * Used by edit-from-review, where one user action can clear several answers.
 */
export function forgetAnswers(session: Session, ids: string[]): Session {
  const drop = new Set(ids);
  const answers: Answers = { ...session.answers };
  let changed = false;
  for (const id of drop) {
    if (id in answers) {
      delete answers[id];
      changed = true;
    }
  }
  const answered = session.answered.filter((x) => !drop.has(x));
  if (!changed && answered.length === session.answered.length) return session;
  const updated: Session = { ...session, answers, answered };
  saveSession(updated);
  return updated;
}

/** Drop a single answer (value + answered entry) and persist. */
export function forgetAnswer(session: Session, id: string): Session {
  return forgetAnswers(session, [id]);
}

/** Record one skill id as generated (idempotent) and persist. */
export function recordGenerated(session: Session, id: string): Session {
  if (session.generated.includes(id)) return session;
  const updated: Session = { ...session, generated: [...session.generated, id] };
  saveSession(updated);
  return updated;
}

/** Remove the whole working dir (.payo/) — run once a generation completes. */
export function cleanupWorkspace(): void {
  fs.rmSync(sessionDir(), { recursive: true, force: true });
}
