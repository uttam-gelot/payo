/**
 * Shared filesystem helpers. The single atomic-write path used by every site
 * that persists a file (generated artifacts, the session, the bootstrap
 * prompt), so an OS-level failure surfaces as a readable message instead of a
 * raw stack trace and never leaves a half-written file behind.
 */
import fs from 'fs';
import path from 'path';

/** Map an OS error code to a human phrase; fall back to the raw message. */
function reason(err: unknown): string {
  const code = (err as NodeJS.ErrnoException).code;
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return 'permission denied';
    case 'ENOSPC':
      return 'no space left on device';
    case 'EROFS':
      return 'read-only file system';
    case 'ENOENT':
      return 'path does not exist';
    default:
      return (err as Error).message ?? String(err);
  }
}

/** Thrown for file-write failures; caught at the top level for a clean message. */
export class FileWriteError extends Error {}

/**
 * Atomic write-then-rename: mkdir the parent, write to a `.tmp` sibling, then
 * rename it into place so a reader never sees a partial file. On any failure
 * throw a {@link FileWriteError} naming the file and the OS reason.
 */
export function writeFileAtomic(dest: string, content: string): void {
  const label = path.relative(process.cwd(), dest) || path.basename(dest);
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const tmp = dest + '.tmp';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, dest);
  } catch (err) {
    throw new FileWriteError(`Could not write ${label}: ${reason(err)}`);
  }
}
