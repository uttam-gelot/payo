import type { Answers } from '../questions/types';

/** Where a detected answer came from — shown in the confirm summary. */
export type DetectionSource =
  | 'package.json'
  | 'pyproject.toml'
  | 'requirements.txt'
  | 'go.mod'
  | 'Cargo.toml'
  | 'lockfile'
  | 'config'
  | 'llm';

export interface DetectionResult {
  /** Detected core answer ids → values (a subset of the questionnaire's ids). */
  answers: Partial<Answers>;
  /** Per-answer provenance, for the summary screen. */
  sources: Record<string, DetectionSource>;
}

export const EMPTY_DETECTION: DetectionResult = { answers: {}, sources: {} };
