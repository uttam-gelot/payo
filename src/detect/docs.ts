/**
 * Project-documentation excerpts for the Stage-2 prompt. A README (or agent
 * instructions file) usually states outright what the manifests only imply —
 * "Rust-based AWS Lambda backend, React admin frontend" — so a capped excerpt
 * gives the LLM the architecture summary the dependency lists hide. Heads of
 * files only: intros carry the summary, appendices don't.
 *
 * The caller must fence the returned text as untrusted project data before
 * embedding it in a prompt (docs are user-authored content).
 */
import fs from 'fs';
import path from 'path';
import { readText } from './manifest';

/** Read these first, in this order — they describe the project as a whole. */
const DOC_FILES = ['README.md', 'CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md'];

const PER_FILE_CAP = 3000;
const TOTAL_CAP = 10000;
const MAX_DOCS_DIR_FILES = 3;

/** Top-level docs/*.md, smallest-path-first for deterministic output. */
function docsDirFiles(cwd: string): string[] {
  try {
    return fs
      .readdirSync(path.join(cwd, 'docs'))
      .filter((f) => f.endsWith('.md'))
      .sort()
      .slice(0, MAX_DOCS_DIR_FILES)
      .map((f) => `docs/${f}`);
  } catch {
    return [];
  }
}

/**
 * Labeled, size-capped excerpts of the repo's documentation, or undefined when
 * none exists. Each file renders as `### <path>` followed by its head.
 */
export function docsExcerpt(cwd: string): string | undefined {
  const sections: string[] = [];
  let budget = TOTAL_CAP;
  for (const rel of [...DOC_FILES, ...docsDirFiles(cwd)]) {
    if (budget <= 0) break;
    const body = readText(cwd, rel);
    if (body === undefined) continue;
    const trimmed = body.trim();
    if (trimmed === '') continue;
    const cap = Math.min(PER_FILE_CAP, budget);
    const excerpt = trimmed.length > cap ? `${trimmed.slice(0, cap)}\n…(truncated)` : trimmed;
    sections.push(`### ${rel}\n${excerpt}`);
    budget -= excerpt.length;
  }
  return sections.length > 0 ? sections.join('\n\n') : undefined;
}
