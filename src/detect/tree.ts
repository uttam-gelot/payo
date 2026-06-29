/**
 * A depth- and count-bounded directory snapshot for the Stage-2 LLM prompt.
 * Paths only — **no file contents are ever read** — so the privacy cost is
 * capped at "what a directory listing reveals" (see STACK_DETECTION_RND.md §5).
 */
import fs from 'fs';
import path from 'path';

/** Directories never worth sending — noise, vendored, or generated. */
const IGNORE = new Set([
  'node_modules',
  '.git',
  '.payo',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'out',
  'coverage',
  'target',
  '__pycache__',
  '.venv',
  'venv',
  '.turbo',
  '.cache',
]);

export interface DirTreeOptions {
  maxDepth?: number;
  maxEntries?: number;
}

/**
 * Walk `cwd` breadth-first, returning project-relative paths (directories
 * suffixed with `/`). Stops at `maxDepth` levels and `maxEntries` total paths so
 * the prompt stays small on large repos. Unreadable directories are skipped.
 */
export function dirTree(cwd: string, opts: DirTreeOptions = {}): string[] {
  const maxDepth = opts.maxDepth ?? 4;
  const maxEntries = opts.maxEntries ?? 400;
  const out: string[] = [];
  const queue: { abs: string; rel: string; depth: number }[] = [{ abs: cwd, rel: '', depth: 0 }];

  while (queue.length > 0 && out.length < maxEntries) {
    const { abs, rel, depth } = queue.shift()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue;
    }
    // Stable order so the snapshot is deterministic.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (out.length >= maxEntries) break;
      if (entry.name.startsWith('.git')) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (IGNORE.has(entry.name)) continue;
        out.push(`${childRel}/`);
        if (depth + 1 < maxDepth) {
          queue.push({ abs: path.join(abs, entry.name), rel: childRel, depth: depth + 1 });
        }
      } else {
        out.push(childRel);
      }
    }
  }
  return out;
}
