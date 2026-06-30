/** Detect a Node/TypeScript/JavaScript stack from package.json + sibling files. */
import type { DetectionResult, DetectionSource } from './types';
import { exists, readJson, readJsonc, packageJsonDeps, prismaProvider } from './manifest';
import {
  firstMatch,
  NODE_FRAMEWORK,
  NODE_UI_FRAMEWORKS,
  NODE_SERVER_FRAMEWORKS,
  NODE_FULLSTACK_FRAMEWORKS,
  NODE_CLI,
  NODE_DATABASE,
  NODE_ORM,
  NODE_STYLING,
  NODE_VALIDATION,
  NODE_STATE,
  NODE_LOGGER,
  NODE_FORMATTER,
  NODE_LINTER,
  NODE_TEST_RUNNER,
  NODE_E2E,
  NODE_API,
  NODE_AUTH,
  MONOREPO_MARKERS,
} from './signals';

const PRETTIER_CONFIGS = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  'prettier.config.js',
  'prettier.config.cjs',
];
const ESLINT_CONFIGS = [
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
];

/** Prisma datasource provider → DB answer value (only vocab-valid engines). */
const PRISMA_DB: Record<string, string> = {
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  sqlite: 'sqlite',
  cockroachdb: 'cockroachdb',
  mongodb: 'mongodb',
};

export function detectNode(cwd: string): DetectionResult | null {
  const pkg = readJson(cwd, 'package.json');
  if (!pkg) return null;

  const deps = packageJsonDeps(pkg);
  const answers: Record<string, unknown> = {};
  const sources: Record<string, DetectionSource> = {};
  const set = (id: string, value: string | undefined, source: DetectionSource): void => {
    if (value !== undefined) {
      answers[id] = value;
      sources[id] = source;
    }
  };

  // Language: TS when a tsconfig or the typescript dep is present, else JS.
  const isTs = exists(cwd, 'tsconfig.json') || deps.has('typescript');
  set(
    'language',
    isTs ? 'typescript' : 'javascript',
    isTs && exists(cwd, 'tsconfig.json') ? 'config' : 'package.json',
  );

  // Framework + project shape.
  const framework = firstMatch(deps, NODE_FRAMEWORK);
  set('framework', framework, 'package.json');

  const isCli = typeof pkg.bin !== 'undefined' || [...deps].some((d) => NODE_CLI.has(d));
  let projectType: string | undefined;
  if (framework && NODE_FULLSTACK_FRAMEWORKS.has(framework)) projectType = 'full-stack';
  else if (framework && NODE_UI_FRAMEWORKS.has(framework)) projectType = 'frontend';
  else if (framework && NODE_SERVER_FRAMEWORKS.has(framework)) projectType = 'backend';
  else if (isCli) projectType = 'cli';
  set('projectType', projectType, 'package.json');

  // Package manager from lockfile, runtime from lockfile / engines / config.
  const pm = exists(cwd, 'pnpm-lock.yaml')
    ? 'pnpm'
    : exists(cwd, 'bun.lockb') || exists(cwd, 'bun.lock')
      ? 'bun'
      : exists(cwd, 'yarn.lock')
        ? 'yarn'
        : exists(cwd, 'package-lock.json')
          ? 'npm'
          : undefined;
  set('packageManager', pm, 'lockfile');

  const engines = pkg.engines as Record<string, unknown> | undefined;
  const runtime =
    exists(cwd, 'bun.lockb') || exists(cwd, 'bun.lock') || (engines && 'bun' in engines)
      ? 'bun'
      : exists(cwd, 'deno.json') || exists(cwd, 'deno.jsonc')
        ? 'deno'
        : 'node';
  set('runtime', runtime, 'config');

  const orm = firstMatch(deps, NODE_ORM);
  let database = firstMatch(deps, NODE_DATABASE);
  // Prisma ships no DB driver dep, so a Prisma project usually yields an ORM
  // with no database — which the coherence rule would then drop. Recover the
  // engine from `schema.prisma`'s datasource provider so the ORM survives.
  if (database === undefined && orm === 'prisma') {
    database = PRISMA_DB[prismaProvider(cwd) ?? ''];
  }
  set('database', database, 'package.json');
  set('orm', orm, 'package.json');
  set('stylingLibrary', firstMatch(deps, NODE_STYLING), 'package.json');
  set('validation', firstMatch(deps, NODE_VALIDATION), 'package.json');
  set('stateManagement', firstMatch(deps, NODE_STATE), 'package.json');
  set('logger', firstMatch(deps, NODE_LOGGER), 'package.json');

  // Formatter / linter: dep first, then config-file presence as a fallback.
  const formatter =
    firstMatch(deps, NODE_FORMATTER) ??
    (PRETTIER_CONFIGS.some((f) => exists(cwd, f))
      ? 'prettier'
      : exists(cwd, 'biome.json')
        ? 'biome'
        : undefined);
  set(
    'formatter',
    formatter,
    deps.has('prettier') || deps.has('@biomejs/biome') || deps.has('dprint')
      ? 'package.json'
      : 'config',
  );

  const linter =
    firstMatch(deps, NODE_LINTER) ??
    (ESLINT_CONFIGS.some((f) => exists(cwd, f))
      ? 'eslint'
      : exists(cwd, 'biome.json')
        ? 'biome'
        : undefined);
  set(
    'linter',
    linter,
    deps.has('eslint') || deps.has('@biomejs/biome') || deps.has('oxlint')
      ? 'package.json'
      : 'config',
  );

  set('testRunner', firstMatch(deps, NODE_TEST_RUNNER), 'package.json');

  const hasServer = projectType === 'backend' || projectType === 'full-stack';
  const isStandalone = projectType === 'cli' || projectType === 'script';

  // API architecture — only on server projects, and only when a non-REST stack
  // leaves a dependency trace (the question is gated on hasServer).
  if (hasServer) set('apiArchitecture', firstMatch(deps, NODE_API), 'package.json');

  // Auth approach — not for standalone projects; passport isn't a Next.js option.
  if (!isStandalone) {
    const auth = firstMatch(deps, NODE_AUTH);
    set(
      'authApproach',
      auth === 'passport' && framework === 'nextjs' ? undefined : auth,
      'package.json',
    );
  }

  // Monorepo structure — workspace marker files or a package.json `workspaces` field.
  const isMonorepo = MONOREPO_MARKERS.some((f) => exists(cwd, f)) || 'workspaces' in pkg;
  if (isMonorepo) set('structure', 'monorepo', 'config');

  // E2E tooling implies the 'e2e' test type — seed both together so the gated
  // e2eTool answer stays reachable. Skipped for standalone projects (no e2e option).
  const e2e = firstMatch(deps, NODE_E2E);
  if (e2e && projectType !== 'cli' && projectType !== 'script') {
    set('e2eTool', e2e, 'package.json');
    answers.testTypes = ['unit', 'integration', 'e2e'];
    sources.testTypes = 'package.json';
  }

  // TypeScript compiler knobs — read straight from tsconfig.json (tolerant parse).
  if (isTs) {
    const tsconfig = readJsonc(cwd, 'tsconfig.json');
    const co = (tsconfig?.compilerOptions ?? {}) as Record<string, unknown>;
    if (typeof co.strict === 'boolean') {
      answers['tsconfig.strict'] = co.strict;
      sources['tsconfig.strict'] = 'config';
    }

    const target = typeof co.target === 'string' ? co.target.toLowerCase() : undefined;
    const targetMap: Record<string, string> = {
      es2022: 'ES2022',
      esnext: 'ESNext',
      es2020: 'ES2020',
    };
    set('tsconfig.target', target ? targetMap[target] : undefined, 'config');

    const mr =
      typeof co.moduleResolution === 'string' ? co.moduleResolution.toLowerCase() : undefined;
    const mrMap: Record<string, string> = {
      bundler: 'bundler',
      nodenext: 'nodenext',
      node16: 'nodenext',
      node: 'node',
      node10: 'node',
      classic: 'node',
    };
    set('tsconfig.module-resolution', mr ? mrMap[mr] : undefined, 'config');

    const paths = co.paths;
    const hasAliases =
      (typeof paths === 'object' && paths !== null && Object.keys(paths).length > 0) ||
      typeof co.baseUrl === 'string';
    if (tsconfig) {
      answers['tsconfig.path-aliases'] = hasAliases;
      sources['tsconfig.path-aliases'] = 'config';
    }
  }

  return { answers, sources };
}
