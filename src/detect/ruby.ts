/** Detect a Ruby stack from a Gemfile. */
import type { DetectionResult, DetectionSource } from './types';
import { readText, gemfileDeps } from './manifest';
import {
  firstMatch,
  RUBY_FRAMEWORK,
  RUBY_CLI,
  RUBY_CLI_FRAMEWORK,
  RUBY_DATABASE,
  RUBY_ORM,
  RUBY_VALIDATION,
  RUBY_LOGGER,
  RUBY_FORMATTER,
  RUBY_LINTER,
  RUBY_TEST_RUNNER,
  RUBY_AUTH,
} from './signals';

export function detectRuby(cwd: string): DetectionResult | null {
  const body = readText(cwd, 'Gemfile');
  if (body === undefined) return null;

  const deps = gemfileDeps(body);
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = 'Gemfile';
    }
  };

  set('language', 'ruby');

  const framework = firstMatch(deps, RUBY_FRAMEWORK);
  set('framework', framework);

  let projectType: string | undefined;
  // Rails ships server-rendered views and a server — treat it as a backend.
  if (framework) projectType = 'backend';
  else if ([...deps].some((d) => RUBY_CLI.has(d))) {
    projectType = 'cli';
    set('framework', firstMatch(deps, RUBY_CLI_FRAMEWORK));
  }
  set('projectType', projectType);

  set('database', firstMatch(deps, RUBY_DATABASE));
  // Active Record is part of the rails gem, not a separate dependency.
  set('orm', framework === 'rails' ? 'active-record' : firstMatch(deps, RUBY_ORM));
  set('validation', firstMatch(deps, RUBY_VALIDATION));
  set('logger', firstMatch(deps, RUBY_LOGGER));
  set('formatter', firstMatch(deps, RUBY_FORMATTER));
  set('linter', firstMatch(deps, RUBY_LINTER));
  set('testRunner', firstMatch(deps, RUBY_TEST_RUNNER));
  set('authApproach', firstMatch(deps, RUBY_AUTH));

  return { answers, sources };
}
