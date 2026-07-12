/**
 * Shared write helpers with the project-containment invariant. Kept in their own
 * module so both the generator entry point and the universal writer can use them
 * without an import cycle.
 */
import path from 'path';
import type { GeneratedArtifact } from './types';
import { writeFileAtomic } from '../fsutil';

/**
 * Resolve an artifact path against cwd, rejecting anything that escapes the
 * project directory. Every built-in provider uses fixed relative paths; this
 * enforces that invariant for contributed providers too.
 */
export function resolveContained(rel: string): string {
  const dest = path.resolve(process.cwd(), rel);
  const relative = path.relative(process.cwd(), dest);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside the project directory: ${rel}`);
  }
  return dest;
}

export function writeArtifact(artifact: GeneratedArtifact): void {
  writeFileAtomic(resolveContained(artifact.path), artifact.content);
}
