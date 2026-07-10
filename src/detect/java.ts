/** Detect a Java / JVM stack from pom.xml or build.gradle(.kts). */
import type { DetectionResult, DetectionSource } from './types';
import { javaDeps } from './manifest';
import {
  firstMatch,
  JAVA_FRAMEWORK,
  JAVA_CLI,
  JAVA_CLI_FRAMEWORK,
  JAVA_DATABASE,
  JAVA_ORM,
  JAVA_VALIDATION,
  JAVA_LOGGER,
  JAVA_FORMATTER,
  JAVA_LINTER,
  JAVA_TEST_RUNNER,
  JAVA_AUTH,
} from './signals';

export function detectJava(cwd: string): DetectionResult | null {
  const manifest = javaDeps(cwd);
  if (manifest === undefined) return null;

  const { deps, tool } = manifest;
  const source: DetectionSource = tool === 'maven' ? 'pom.xml' : 'build.gradle';
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = source;
    }
  };

  set('language', 'java');
  set('packageManager', tool);

  const framework = firstMatch(deps, JAVA_FRAMEWORK);
  let projectType: string | undefined;
  if (framework) {
    // Spring Boot serves both APIs and server-rendered views — treat it as backend.
    set('framework', framework);
    projectType = 'backend';
  } else if ([...deps].some((d) => JAVA_CLI.has(d))) {
    projectType = 'cli';
    set('framework', firstMatch(deps, JAVA_CLI_FRAMEWORK));
  }
  set('projectType', projectType);

  set('database', firstMatch(deps, JAVA_DATABASE));
  set('orm', firstMatch(deps, JAVA_ORM));
  set('validation', firstMatch(deps, JAVA_VALIDATION));
  set('logger', firstMatch(deps, JAVA_LOGGER));
  set('formatter', firstMatch(deps, JAVA_FORMATTER));
  set('linter', firstMatch(deps, JAVA_LINTER));
  set('testRunner', firstMatch(deps, JAVA_TEST_RUNNER));
  set('authApproach', firstMatch(deps, JAVA_AUTH));

  return { answers, sources };
}
