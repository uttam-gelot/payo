import type { Answers } from '../questions/types';

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
}

export interface DetectionResult {
  /** Detected core answer ids → values (a subset of the questionnaire's ids). */
  answers: Partial<Answers>;
  /** Per-answer provenance, for the summary screen. */
  sources: Record<string, DetectionSource>;
  /** Workspace members and their stacks — present only for a detected monorepo. */
  packages?: PackageSummary[];
}

export const EMPTY_DETECTION: DetectionResult = { answers: {}, sources: {} };
