/** Detect a Go stack from go.mod. */
import type { DetectionResult, DetectionSource } from './types';
import { exists, readText, goModRequires } from './manifest';
import {
  firstPrefixMatch,
  GO_FRAMEWORK,
  GO_CLI,
  GO_DATABASE,
  GO_ORM,
  GO_VALIDATION,
  GO_LOGGER,
} from './signals';

const GOLANGCI_CONFIGS = ['.golangci.yml', '.golangci.yaml', '.golangci.toml', '.golangci.json'];

export function detectGo(cwd: string): DetectionResult | null {
  const gomod = readText(cwd, 'go.mod');
  if (gomod === undefined) return null;

  const mods = goModRequires(gomod);
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'go.mod';
    }
  };

  set('language', 'go');

  const framework = firstPrefixMatch(mods, GO_FRAMEWORK);
  set('framework', framework);

  let projectType: string | undefined;
  if (framework) projectType = 'backend';
  else if (mods.some((m) => [...GO_CLI].some((c) => m === c || m.startsWith(c + '/'))))
    projectType = 'cli';
  set('projectType', projectType);

  set('database', firstPrefixMatch(mods, GO_DATABASE));
  set('orm', firstPrefixMatch(mods, GO_ORM));
  set('validation', firstPrefixMatch(mods, GO_VALIDATION));
  set('logger', firstPrefixMatch(mods, GO_LOGGER));
  // Go's toolchain is fixed: gofmt + go test are universal.
  set('formatter', 'gofmt');
  set('testRunner', 'go-test');
  // golangci-lint is the de-facto Go linter, driven by a .golangci.* config file.
  if (GOLANGCI_CONFIGS.some((f) => exists(cwd, f))) set('linter', 'golangci-lint');

  return { answers, sources };
}
