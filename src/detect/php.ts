/** Detect a PHP stack from composer.json. */
import type { DetectionResult, DetectionSource } from './types';
import { readJson, composerDeps } from './manifest';
import {
  firstMatch,
  PHP_FRAMEWORK,
  PHP_CLI,
  PHP_CLI_FRAMEWORK,
  PHP_DATABASE,
  PHP_ORM,
  PHP_VALIDATION,
  PHP_LOGGER,
  PHP_FORMATTER,
  PHP_LINTER,
  PHP_TEST_RUNNER,
  PHP_AUTH,
} from './signals';

export function detectPhp(cwd: string): DetectionResult | null {
  const composer = readJson(cwd, 'composer.json');
  if (composer === undefined) return null;

  const deps = composerDeps(composer);
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'composer.json';
    }
  };

  set('language', 'php');

  const framework = firstMatch(deps, PHP_FRAMEWORK);
  set('framework', framework);

  let projectType: string | undefined;
  // Laravel ships views (Blade) and a server — treat it as a full-stack backend.
  if (framework) projectType = 'backend';
  else if ([...deps].some((d) => PHP_CLI.has(d))) {
    projectType = 'cli';
    set('framework', firstMatch(deps, PHP_CLI_FRAMEWORK));
  }
  set('projectType', projectType);

  set('database', firstMatch(deps, PHP_DATABASE));
  // Eloquent is part of laravel/framework, not a separate dependency.
  set('orm', framework === 'laravel' ? 'eloquent' : firstMatch(deps, PHP_ORM));
  set('validation', firstMatch(deps, PHP_VALIDATION));
  set('logger', firstMatch(deps, PHP_LOGGER));
  set('formatter', firstMatch(deps, PHP_FORMATTER));
  set('linter', firstMatch(deps, PHP_LINTER));
  set('testRunner', firstMatch(deps, PHP_TEST_RUNNER));
  set('authApproach', firstMatch(deps, PHP_AUTH));

  return { answers, sources };
}
