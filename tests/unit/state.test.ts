import { describe, it, expect } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { inTempProject } from '../helpers/tmpProject';
import {
  createSession,
  loadSession,
  recordGenerated,
  cleanupWorkspace,
} from '../../src/state/index';

describe('generation progress in the session', () => {
  it('recordGenerated appends ids and persists them', () =>
    inTempProject(() => {
      let s = recordGenerated(createSession(), 'project-overview');
      s = recordGenerated(s, 'testing');
      expect(s.generated).toEqual(['project-overview', 'testing']);
      expect(loadSession()?.generated).toEqual(['project-overview', 'testing']);
    }));

  it('recordGenerated is idempotent', () =>
    inTempProject(() => {
      let s = recordGenerated(createSession(), 'testing');
      s = recordGenerated(s, 'testing');
      expect(s.generated).toEqual(['testing']);
    }));

  it('cleanupWorkspace removes the .payo working dir', () =>
    inTempProject((dir) => {
      recordGenerated(createSession(), 'testing'); // persists .payo/session.json
      expect(existsSync(join(dir, '.payo'))).toBe(true);
      cleanupWorkspace();
      expect(existsSync(join(dir, '.payo'))).toBe(false);
      expect(loadSession()).toBeNull();
    }));

  it('an old session file without `generated` loads as []', () =>
    inTempProject((dir) => {
      const base = createSession();
      mkdirSync(join(dir, '.payo'), { recursive: true });
      // A v2 session predating the `generated` field.
      writeFileSync(
        join(dir, '.payo', 'session.json'),
        JSON.stringify({ session_id: base.session_id, version: 'v2', answers: {}, answered: [] }),
        'utf-8',
      );
      expect(loadSession()?.generated).toEqual([]);
    }));
});
