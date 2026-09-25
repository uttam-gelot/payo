import { describe, it, expect } from 'bun:test';
import {
  NATIVE_KEY,
  detectNative,
  readsNatively,
  versionAtLeast,
  type NativeDeps,
} from '../../src/generator/native';
import type { AiProvider } from '../../src/generator/types';

const runner = { binary: 'tool-cli', buildArgs: () => [] };

/** Deps over a fixed provider table, with every CLI installed at `version`. */
const depsFor = (
  providers: Record<string, AiProvider>,
  version: string | undefined,
  installed = true,
): NativeDeps => ({
  resolveProvider: (id) => providers[id],
  isAvailable: () => installed,
  installedVersion: () => version,
});

const provider = (id: string, nativeSince?: AiProvider['nativeSince']): AiProvider => ({
  id,
  displayName: id,
  knownArtifacts: [],
  agent: runner,
  ...(nativeSince ? { nativeSince } : {}),
});

describe('versionAtLeast', () => {
  it('compares segment by segment, numerically', () => {
    expect(versionAtLeast('2.1.281', '2.1.281')).toBe(true);
    expect(versionAtLeast('2.1.282', '2.1.281')).toBe(true);
    expect(versionAtLeast('2.1.280', '2.1.281')).toBe(false);
    expect(versionAtLeast('2.10.0', '2.9.9')).toBe(true);
    expect(versionAtLeast('3.0.0', '2.99.99')).toBe(true);
  });

  it('treats a missing segment as 0', () => {
    expect(versionAtLeast('2.1', '2.1.0')).toBe(true);
    expect(versionAtLeast('2.1', '2.1.1')).toBe(false);
  });
});

describe('detectNative', () => {
  const tools = {
    alpha: provider('alpha', { agentsMd: '2.0.0', skills: '3.0.0' }),
    beta: provider('beta'),
  };

  it('reports only the features the installed version reaches', () => {
    expect(detectNative(['alpha'], depsFor(tools, '2.5.0'))).toEqual({ alpha: ['agentsMd'] });
    expect(detectNative(['alpha'], depsFor(tools, '3.0.0'))).toEqual({
      alpha: ['agentsMd', 'skills'],
    });
  });

  it('omits a tool below every threshold', () => {
    expect(detectNative(['alpha'], depsFor(tools, '1.9.9'))).toEqual({});
  });

  it('omits a tool that declares no thresholds', () => {
    expect(detectNative(['beta'], depsFor(tools, '99.0.0'))).toEqual({});
  });

  it('keeps the shim when the CLI is missing or its version unreadable', () => {
    expect(detectNative(['alpha'], depsFor(tools, '3.0.0', false))).toEqual({});
    expect(detectNative(['alpha'], depsFor(tools, undefined))).toEqual({});
  });

  it('omits a tool without a CLI to probe', () => {
    const noCli = { gamma: { ...provider('gamma', { agentsMd: '1.0.0' }), agent: undefined } };
    expect(detectNative(['gamma'], depsFor(noCli, '9.0.0'))).toEqual({});
  });

  it('ignores unknown tool ids', () => {
    expect(detectNative(['nope'], depsFor(tools, '9.0.0'))).toEqual({});
  });
});

describe('readsNatively', () => {
  it('reads the stashed detection', () => {
    const answers = { [NATIVE_KEY]: { claude: ['agentsMd'] } };
    expect(readsNatively(answers, 'claude', 'agentsMd')).toBe(true);
    expect(readsNatively(answers, 'claude', 'skills')).toBe(false);
    expect(readsNatively(answers, 'windsurf', 'agentsMd')).toBe(false);
  });

  it('is false with no stash or a malformed one', () => {
    expect(readsNatively({}, 'claude', 'agentsMd')).toBe(false);
    expect(readsNatively({ [NATIVE_KEY]: 'yes' }, 'claude', 'agentsMd')).toBe(false);
    expect(readsNatively({ [NATIVE_KEY]: { claude: 'agentsMd' } }, 'claude', 'agentsMd')).toBe(
      false,
    );
  });
});
