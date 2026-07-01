/** Detect a Python stack from pyproject.toml / requirements.txt. */
import type { DetectionResult, DetectionSource } from './types';
import { exists, readText, pyprojectDeps, requirementsDeps } from './manifest';
import {
  firstMatch,
  PY_FRAMEWORK,
  PY_CLI,
  PY_DATABASE,
  PY_ORM,
  PY_VALIDATION,
  PY_LOGGER,
  PY_FORMATTER,
  PY_LINTER,
  PY_TEST_RUNNER,
} from './signals';

export function detectPython(cwd: string): DetectionResult | null {
  const pyproject = readText(cwd, 'pyproject.toml');
  const requirements = readText(cwd, 'requirements.txt');
  if (pyproject === undefined && requirements === undefined) return null;

  const manifest: DetectionSource = pyproject !== undefined ? 'pyproject.toml' : 'requirements.txt';
  const deps = new Set<string>([
    ...(pyproject !== undefined ? pyprojectDeps(pyproject) : []),
    ...(requirements !== undefined ? requirementsDeps(requirements) : []),
  ]);

  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined, source: DetectionSource = manifest): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = source;
    }
  };

  set('language', 'python');

  const framework = firstMatch(deps, PY_FRAMEWORK);
  set('framework', framework);

  let projectType: string | undefined;
  if (framework) projectType = 'backend';
  else if ([...deps].some((d) => PY_CLI.has(d))) projectType = 'cli';
  set('projectType', projectType);

  // Package manager from lockfile / manifest markers. A pyproject declaring
  // Poetry implies poetry even without a committed lockfile; any other pyproject
  // (or a bare requirements.txt) falls back to pip + venv rather than nothing.
  const usesPoetry = pyproject !== undefined && /^\s*\[tool\.poetry\]/m.test(pyproject);
  const pm = exists(cwd, 'uv.lock')
    ? 'uv'
    : exists(cwd, 'poetry.lock')
      ? 'poetry'
      : exists(cwd, 'Pipfile') || exists(cwd, 'Pipfile.lock')
        ? 'pipenv'
        : usesPoetry
          ? 'poetry'
          : requirements !== undefined || pyproject !== undefined
            ? 'pip-venv'
            : undefined;
  set(
    'packageManager',
    pm,
    pm === 'pip-venv' && requirements === undefined ? 'pyproject.toml' : 'lockfile',
  );

  set('database', firstMatch(deps, PY_DATABASE));
  // Django's ORM is part of the framework, not a separate dependency.
  set('orm', framework === 'django' ? 'django-orm' : firstMatch(deps, PY_ORM));
  set('validation', firstMatch(deps, PY_VALIDATION));
  set('logger', firstMatch(deps, PY_LOGGER));
  set('formatter', firstMatch(deps, PY_FORMATTER));
  set('linter', firstMatch(deps, PY_LINTER));
  set('testRunner', firstMatch(deps, PY_TEST_RUNNER));

  return { answers, sources };
}
