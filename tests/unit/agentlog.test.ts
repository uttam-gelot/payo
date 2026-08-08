import { describe, it, expect } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { writeAgentLog } from '../../src/generator/agentlog';
import type { AgentTranscript } from '../../src/generator/agent';
import { inTempProject } from '../helpers/tmpProject';

const transcript: AgentTranscript = {
  argv: ['codex', 'exec'],
  stdout: 'banner\nsandbox denied the write',
  stderr: 'error: read-only workspace',
};

describe('writeAgentLog', () => {
  it('returns {} when there is no transcript to record', () => {
    expect(writeAgentLog('project-overview', 1, 'no transcript', 'prompt')).toEqual({});
  });

  it('writes the transcript and returns its project-relative path', async () => {
    await inTempProject(async (dir) => {
      const res = writeAgentLog('project-overview', 1, 'exited with code 1', 'prompt', transcript);
      expect(res.error).toBeUndefined();
      expect(res.path).toBeDefined();
      expect(res.path?.startsWith('.payo/logs/')).toBe(true);
      const log = readFileSync(join(dir, res.path as string), 'utf-8');
      expect(log).toContain('error: read-only workspace');
      expect(log).toContain('argv: codex exec');
    });
  });

  it('returns an error instead of throwing or vanishing when the write itself fails', async () => {
    await inTempProject(async (dir) => {
      const payoDir = join(dir, '.payo');
      mkdirSync(payoDir);
      chmodSync(payoDir, 0o500); // read + execute, no write — blocks creating logs/
      try {
        const res = writeAgentLog('project-overview', 1, 'exited with code 1', 'prompt', transcript);
        expect(res.path).toBeUndefined();
        expect(res.error).toBeDefined();
        expect(res.error).toContain('permission denied');
      } finally {
        chmodSync(payoDir, 0o700); // restore so the temp dir can be removed
      }
    });
  });
});
