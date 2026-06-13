import { describe, it, expect } from 'bun:test';
import { chmodSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { writeFileAtomic, FileWriteError } from '../../src/fsutil';
import { inTempProject } from '../helpers/tmpProject';

describe('writeFileAtomic', () => {
  it('writes content and leaves no .tmp behind', async () => {
    await inTempProject((dir) => {
      const dest = join(dir, 'nested', 'out.txt');
      writeFileAtomic(dest, 'hello');
      expect(readFileSync(dest, 'utf-8')).toBe('hello');
      expect(readdirSync(join(dir, 'nested'))).toEqual(['out.txt']);
    });
  });

  it('throws FileWriteError naming the file and reason on an unwritable dir', async () => {
    await inTempProject((dir) => {
      const roDir = join(dir, 'ro');
      writeFileAtomic(join(roDir, 'seed.txt'), 'seed'); // creates ro/
      chmodSync(roDir, 0o500); // read + execute, no write
      try {
        expect(() => writeFileAtomic(join(roDir, 'CLAUDE.md'), 'x')).toThrow(FileWriteError);
        try {
          writeFileAtomic(join(roDir, 'CLAUDE.md'), 'x');
        } catch (err) {
          expect((err as Error).message).toContain('CLAUDE.md');
          expect((err as Error).message).toContain('permission denied');
        }
        expect(existsSync(join(roDir, 'CLAUDE.md'))).toBe(false);
      } finally {
        chmodSync(roDir, 0o700); // restore so the temp dir can be removed
      }
    });
  });
});
