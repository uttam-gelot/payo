/**
 * Black-box test helper: run code with cwd set to a throwaway project dir,
 * always restoring afterwards. `generate()` writes to `process.cwd()`, so this
 * isolates output artifacts per test. Awaits `fn` so async callers (the now
 * Promise-returning `generate`) finish before cwd is restored and the dir removed.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/** Run `fn` with cwd set to a fresh temp dir; restore cwd and remove it after. */
export async function inTempProject<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const prev = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), 'payo-proj-'));
  try {
    process.chdir(dir);
    return await fn(dir);
  } finally {
    process.chdir(prev);
    rmSync(dir, { recursive: true, force: true });
  }
}
