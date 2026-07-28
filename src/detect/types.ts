import type { Answers } from '../questions/types';
import type { DetectedHooks } from './hooks';

/** Where a detected answer came from — shown in the confirm summary. */
export type DetectionSource =
  | 'package.json'
  | 'pyproject.toml'
  | 'requirements.txt'
  | 'go.mod'
  | 'Cargo.toml'
  | 'composer.json'
  | 'csproj'
  | 'pom.xml'
  | 'build.gradle'
  | 'Gemfile'
  | 'lockfile'
  | 'config'
  | 'git'
  | 'llm';

/** One workspace member's detected stack, for the monorepo generator notes. */
export interface PackageSummary {
  /** Project-relative directory, e.g. 'apps/web'. */
  path: string;
  language?: string;
  framework?: string;
  projectType?: string;
  database?: string;
  /**
   * Present when this entry stands in for a nested workspace root whose
   * same-language members were collapsed into it (e.g. a Cargo workspace with
   * 8 crates renders as one line instead of nine).
   */
  memberCount?: number;
}

export interface DetectionResult {
  /** Detected core answer ids → values (a subset of the questionnaire's ids). */
  answers: Partial<Answers>;
  /** Per-answer provenance, for the summary screen. */
  sources: Record<string, DetectionSource>;
  /** Workspace members and their stacks — present only for a detected monorepo. */
  packages?: PackageSummary[];
  /**
   * Languages present in the repo beyond the primary stack's — a hybrid repo
   * (React frontend + Rust backend) surfaces the rest of its stacks here
   * instead of collapsing to one. Not answer ids: the questionnaire still
   * interviews for a single primary stack.
   */
  secondary?: string[];
  /**
   * The git-hook runner the repo already uses and what it covers, when one is
   * present. Not an answer id — it decides whether Payo may touch the repo's
   * hooks at all, and what the generated guidance may claim is already automated.
   */
  hooks?: DetectedHooks;
}

export const EMPTY_DETECTION: DetectionResult = { answers: {}, sources: {} };
