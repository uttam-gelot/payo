/**
 * Option data and dynamic option builders for the core questions.
 * Extracted from the former imperative prompts so the flow stays declarative.
 */
import type { Answers, Option } from './types';
import { listProviders } from '../providers/index';
import { modulesFor } from '../stack/registry';
import { isMongo } from '../stack/predicates';

// Q1 picks which agent CLI authors the content — the output layout is universal
// and works with every skills-compatible tool. Offer only providers that expose
// a CLI runner (static-only tools like Windsurf and the generic fallback are not
// generators). No recommended tag — the first option is the plain default.
export const aiToolOptions = (): Option<string>[] =>
  listProviders()
    .filter((p) => p.agent)
    .map((p) => ({
      value: p.id,
      label: p.displayName,
      ...(p.hint ? { hint: p.hint } : {}),
    }));

// Q2 picks which tools the generated skills should support (drives which
// discovery shims are written). Every Payo-supported tool is offered; the
// generic fallback is internal-only, so it is excluded.
export const supportToolOptions = (): Option<string>[] =>
  listProviders()
    .filter((p) => p.id !== 'other')
    .map((p) => ({ value: p.id, label: p.displayName }));

/** Default support selection: the generator CLI's own tool (from Q1), if valid. */
export const defaultSupportTools = (a: Answers): string[] => {
  const valid = new Set(supportToolOptions().map((o) => o.value));
  return typeof a.aiTool === 'string' && valid.has(a.aiTool) ? [a.aiTool] : [];
};

export const projectTypeOptions: Option<string>[] = [
  { value: 'full-stack', label: 'Full-stack' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'cli', label: 'CLI tool' },
  { value: 'script', label: 'Standalone script' },
];

// --- Project-type shape predicates ------------------------------------------
// Used to gate questions by what a project actually has, rather than brittle
// `!==` checks that silently include every newly added project type.

/** Has a user interface (styling, state management apply). */
export const hasUI = (a: Answers): boolean =>
  a.projectType === 'frontend' || a.projectType === 'full-stack';

/** Has a server / HTTP API surface (API architecture, sessions apply). */
export const hasServer = (a: Answers): boolean =>
  a.projectType === 'backend' || a.projectType === 'full-stack';

/** A standalone executable — a CLI tool or script (no UI, no server). */
export const isStandalone = (a: Answers): boolean =>
  a.projectType === 'cli' || a.projectType === 'script';

export const languageOptions = (a: Answers): Option<string>[] =>
  a.projectType === 'frontend'
    ? [
        { value: 'typescript', label: 'TypeScript' },
        { value: 'javascript', label: 'JavaScript' },
      ]
    : [
        { value: 'typescript', label: 'TypeScript' },
        { value: 'python', label: 'Python' },
        { value: 'go', label: 'Go' },
        { value: 'rust', label: 'Rust' },
        { value: 'php', label: 'PHP' },
        { value: 'csharp', label: 'C#' },
        { value: 'java', label: 'Java' },
        { value: 'ruby', label: 'Ruby' },
        { value: 'javascript', label: 'JavaScript' },
      ];

/**
 * CLI argument-parsing frameworks, keyed by language. These have no deep
 * TechModules (no scaffold / follow-up questions) — they're a plain select,
 * like loggerOptions, so the generated rules can name the chosen library.
 */
export const cliFrameworkOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'commander', label: 'Commander.js', hint: 'recommended' },
        { value: 'oclif', label: 'oclif' },
        { value: 'yargs', label: 'Yargs' },
        { value: 'cac', label: 'CAC' },
      ];
    case 'python':
      return [
        { value: 'typer', label: 'Typer', hint: 'recommended' },
        { value: 'click', label: 'Click' },
        { value: 'argparse', label: 'argparse (stdlib)' },
        { value: 'fire', label: 'Python Fire' },
      ];
    case 'go':
      return [
        { value: 'cobra', label: 'Cobra', hint: 'recommended' },
        { value: 'urfave-cli', label: 'urfave/cli' },
        { value: 'flag', label: 'flag (stdlib)' },
      ];
    case 'rust':
      return [
        { value: 'clap', label: 'clap', hint: 'recommended' },
        { value: 'argh', label: 'argh' },
      ];
    case 'php':
      return [
        { value: 'symfony-console', label: 'Symfony Console', hint: 'recommended' },
        { value: 'laravel-zero', label: 'Laravel Zero' },
      ];
    case 'csharp':
      return [
        { value: 'system-commandline', label: 'System.CommandLine', hint: 'recommended' },
        { value: 'spectre-console', label: 'Spectre.Console.Cli' },
      ];
    case 'java':
      return [
        { value: 'picocli', label: 'Picocli', hint: 'recommended' },
        { value: 'spring-shell', label: 'Spring Shell' },
      ];
    case 'ruby':
      return [
        { value: 'thor', label: 'Thor', hint: 'recommended' },
        { value: 'gli', label: 'GLI' },
      ];
    default:
      return [{ value: 'commander', label: 'Commander.js', hint: 'recommended' }];
  }
};

/** Framework options come from tech modules whose appliesTo() passes, plus None. */
export const frameworkOptions = (a: Answers): Option<string>[] => {
  // CLI tools use arg-parsing libraries rather than the web framework registry.
  if (a.projectType === 'cli') {
    return [...cliFrameworkOptions(a), { value: 'none', label: 'None' }];
  }
  const fromModules = modulesFor('framework', a).flatMap((m) => m.options?.(a) ?? []);
  return [...fromModules, { value: 'none', label: 'None' }];
};

export const apiArchitectureOptions: Option<string>[] = [
  { value: 'rest', label: 'REST', hint: 'recommended' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'trpc', label: 'tRPC' },
  { value: 'none', label: 'None / Not Applicable' },
];

export const stylingOptions: Option<string>[] = [
  { value: 'tailwind', label: 'Tailwind CSS', hint: 'recommended' },
  { value: 'shadcn', label: 'shadcn/ui' },
  { value: 'css-modules', label: 'CSS Modules' },
  { value: 'styled-components', label: 'Styled Components' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'mui', label: 'Material UI (MUI)' },
  { value: 'mantine', label: 'Mantine' },
  { value: 'chakra', label: 'Chakra UI' },
  { value: 'antd', label: 'Ant Design' },
  { value: 'unocss', label: 'UnoCSS' },
  { value: 'panda', label: 'Panda CSS' },
  { value: 'bootstrap', label: 'Bootstrap' },
  { value: 'daisyui', label: 'daisyUI' },
  { value: 'vanilla-css', label: 'Vanilla CSS' },
  { value: 'none', label: 'None' },
];

export const databaseOptions: Option<string>[] = [
  { value: 'postgresql', label: 'PostgreSQL', hint: 'recommended' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'turso', label: 'Turso / libSQL' },
  { value: 'cockroachdb', label: 'CockroachDB' },
  { value: 'neon', label: 'Neon (serverless Postgres)' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'redis', label: 'Redis' },
  { value: 'dynamodb', label: 'DynamoDB' },
  { value: 'supabase', label: 'Supabase' },
  { value: 'firebase', label: 'Firebase' },
  { value: 'clickhouse', label: 'ClickHouse' },
  { value: 'cassandra', label: 'Cassandra / ScyllaDB' },
  { value: 'neo4j', label: 'Neo4j' },
  { value: 'elasticsearch', label: 'Elasticsearch / OpenSearch' },
  { value: 'none', label: 'None' },
];

/** ORM options come from tech modules whose appliesTo() passes, plus raw/native and None. */
export const ormOptions = (a: Answers): Option<string>[] => {
  const fromModules = modulesFor('orm', a).flatMap((m) => m.options?.(a) ?? []);
  const native: Option<string> = isMongo(a)
    ? { value: 'native-driver', label: 'Native driver (no ODM)' }
    : { value: 'raw-sql', label: 'Raw SQL / query builder' };
  return [...fromModules, native, { value: 'none', label: 'None' }];
};

export const structureOptions: Option<string>[] = [
  { value: 'standard', label: 'Standard (Framework default)', hint: 'recommended' },
  { value: 'feature-based', label: 'Feature-based (Vertical slices)' },
  { value: 'ddd', label: 'Domain-Driven Design (DDD)' },
  { value: 'monorepo', label: 'Monorepo (Turborepo/Nx)' },
  { value: 'custom', label: 'Custom' },
  { value: 'none', label: 'None' },
];

export const codingStandardOptions: Option<string>[] = [
  { value: 'DRY', label: "DRY — Don't Repeat Yourself", hint: 'recommended' },
  { value: 'modular', label: 'Modular architecture', hint: 'recommended' },
  { value: 'soc', label: 'Separation of concerns', hint: 'recommended' },
  { value: 'solid', label: 'SOLID principles' },
  { value: 'functional', label: 'Functional / Pure functions' },
  { value: 'strict-types', label: 'Strict type safety' },
];

export const documentationOptions: Option<string>[] = [
  { value: 'readme', label: 'README — overview, setup, common commands', hint: 'recommended' },
  {
    value: 'comments',
    label: 'Code comments / doc-comments (JSDoc, docstrings)',
    hint: 'recommended',
  },
  { value: 'api-docs', label: 'API reference docs' },
  { value: 'adr', label: 'Architecture Decision Records (ADRs)' },
  { value: 'changelog', label: 'CHANGELOG (Keep a Changelog)' },
];

export const formatterOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'prettier', label: 'Prettier', hint: 'recommended' },
        { value: 'biome', label: 'Biome' },
        { value: 'dprint', label: 'dprint' },
        { value: 'none', label: 'None' },
      ];
    case 'python':
      return [
        { value: 'black', label: 'Black', hint: 'recommended' },
        { value: 'ruff', label: 'Ruff (Formatter)' },
        { value: 'none', label: 'None' },
      ];
    case 'go':
      return [
        { value: 'gofmt', label: 'gofmt / goimports', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'rust':
      return [
        { value: 'rustfmt', label: 'rustfmt', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'php':
      return [
        { value: 'pint', label: 'Laravel Pint', hint: 'recommended' },
        { value: 'php-cs-fixer', label: 'PHP-CS-Fixer' },
        { value: 'none', label: 'None' },
      ];
    case 'csharp':
      return [
        { value: 'dotnet-format', label: 'dotnet format (built-in)', hint: 'recommended' },
        { value: 'csharpier', label: 'CSharpier' },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        { value: 'spotless', label: 'Spotless', hint: 'recommended' },
        { value: 'google-java-format', label: 'google-java-format' },
        { value: 'none', label: 'None' },
      ];
    case 'ruby':
      return [
        { value: 'rubocop', label: 'RuboCop (autocorrect)', hint: 'recommended' },
        { value: 'standard', label: 'StandardRB' },
        { value: 'none', label: 'None' },
      ];
    default:
      return [
        { value: 'prettier', label: 'Prettier' },
        { value: 'none', label: 'None' },
      ];
  }
};

export const linterOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'eslint', label: 'ESLint', hint: 'recommended' },
        { value: 'biome', label: 'Biome (Linter)' },
        { value: 'oxlint', label: 'oxlint' },
        { value: 'standardjs', label: 'StandardJS' },
        { value: 'none', label: 'None' },
      ];
    case 'python':
      return [
        { value: 'ruff', label: 'Ruff (Linter)', hint: 'recommended' },
        { value: 'flake8', label: 'Flake8' },
        { value: 'pylint', label: 'PyLint' },
        { value: 'none', label: 'None' },
      ];
    case 'go':
      return [
        { value: 'golangci-lint', label: 'golangci-lint', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'rust':
      return [
        { value: 'clippy', label: 'Clippy', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'php':
      return [
        { value: 'phpstan', label: 'PHPStan / Larastan', hint: 'recommended' },
        { value: 'psalm', label: 'Psalm' },
        { value: 'none', label: 'None' },
      ];
    case 'csharp':
      return [
        { value: 'roslyn-analyzers', label: '.NET analyzers (built-in)', hint: 'recommended' },
        { value: 'roslynator', label: 'Roslynator' },
        { value: 'stylecop', label: 'StyleCop Analyzers' },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        { value: 'checkstyle', label: 'Checkstyle', hint: 'recommended' },
        { value: 'pmd', label: 'PMD' },
        { value: 'spotbugs', label: 'SpotBugs' },
        { value: 'none', label: 'None' },
      ];
    case 'ruby':
      return [
        { value: 'rubocop', label: 'RuboCop', hint: 'recommended' },
        { value: 'standard', label: 'StandardRB' },
        { value: 'none', label: 'None' },
      ];
    default:
      return [
        { value: 'eslint', label: 'ESLint' },
        { value: 'none', label: 'None' },
      ];
  }
};

/** Example project description tailored to the selected project type. */
export const projectDefinitionPlaceholder = (a: Answers): string => {
  switch (a.projectType) {
    case 'frontend':
      return 'e.g. a React dashboard for an analytics product with charts, filters, and CSV export';
    case 'backend':
      return 'e.g. a REST API for an e-commerce platform with auth, payments, and admin endpoints';
    case 'cli':
      return 'e.g. a CLI that scaffolds project configs from an interactive questionnaire';
    case 'script':
      return 'e.g. a script that batch-resizes images in a folder and uploads them to S3';
    case 'full-stack':
    default:
      return 'e.g. a full-stack e-commerce app: React storefront + REST API with auth, payments, and an admin dashboard';
  }
};

export const loggerOptions = (a: Answers): Option<string>[] => {
  // Browser apps have no real logging library — a thin centralized wrapper over
  // console is the sensible default; third-party browser loggers are niche.
  if (a.projectType === 'frontend') {
    return [
      {
        value: 'centralized',
        label:
          'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        hint: 'recommended',
      },
      { value: 'none', label: 'None' },
    ];
  }
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'pino', label: 'Pino', hint: 'recommended' },
        { value: 'winston', label: 'Winston' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'python':
      return [
        { value: 'structlog', label: 'structlog', hint: 'recommended' },
        { value: 'loguru', label: 'Loguru' },
        { value: 'logging', label: 'logging (stdlib)' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'go':
      return [
        { value: 'slog', label: 'slog (stdlib)', hint: 'recommended' },
        { value: 'zap', label: 'Zap' },
        { value: 'zerolog', label: 'Zerolog' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'rust':
      return [
        { value: 'tracing', label: 'tracing', hint: 'recommended' },
        { value: 'log', label: 'log' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'php':
      return [
        { value: 'monolog', label: 'Monolog', hint: 'recommended' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'csharp':
      return [
        { value: 'serilog', label: 'Serilog', hint: 'recommended' },
        { value: 'nlog', label: 'NLog' },
        { value: 'ms-logging', label: 'Microsoft.Extensions.Logging (built-in)' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        { value: 'logback', label: 'SLF4J + Logback', hint: 'recommended' },
        { value: 'log4j2', label: 'Log4j 2' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    case 'ruby':
      return [
        { value: 'lograge', label: 'Lograge (structured Rails logs)', hint: 'recommended' },
        { value: 'semantic-logger', label: 'Semantic Logger' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
    default:
      return [
        { value: 'pino', label: 'Pino', hint: 'recommended' },
        {
          value: 'centralized',
          label:
            'Custom centralized logger — one in-house module wrapping stdlib/console, reused everywhere (no third-party)',
        },
        { value: 'none', label: 'None' },
      ];
  }
};

export const testTypeOptions = (a: Answers): Option<string>[] => {
  const opts: Option<string>[] = [
    { value: 'unit', label: 'Unit', hint: 'recommended' },
    { value: 'integration', label: 'Integration', hint: 'recommended' },
  ];
  // Component tests only apply to UI projects.
  if (hasUI(a)) opts.push({ value: 'component', label: 'Component' });
  // E2E tooling is browser-oriented; skip it for standalone CLIs / scripts.
  if (!isStandalone(a)) opts.push({ value: 'e2e', label: 'End-to-end (E2E)' });
  return opts;
};

export const testRunnerOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'vitest', label: 'Vitest', hint: 'recommended' },
        { value: 'jest', label: 'Jest' },
        { value: 'node-test', label: 'node:test' },
        { value: 'bun-test', label: 'bun test' },
        { value: 'none', label: 'None' },
      ];
    case 'python':
      return [
        { value: 'pytest', label: 'pytest', hint: 'recommended' },
        { value: 'unittest', label: 'unittest (stdlib)' },
        { value: 'none', label: 'None' },
      ];
    case 'go':
      return [
        { value: 'go-test', label: 'go test', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'rust':
      return [
        { value: 'cargo-test', label: 'cargo test', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
    case 'php':
      return [
        { value: 'pest', label: 'Pest', hint: 'recommended' },
        { value: 'phpunit', label: 'PHPUnit' },
        { value: 'none', label: 'None' },
      ];
    case 'csharp':
      return [
        { value: 'xunit', label: 'xUnit', hint: 'recommended' },
        { value: 'nunit', label: 'NUnit' },
        { value: 'mstest', label: 'MSTest' },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        { value: 'junit5', label: 'JUnit 5', hint: 'recommended' },
        { value: 'testng', label: 'TestNG' },
        { value: 'none', label: 'None' },
      ];
    case 'ruby':
      return [
        { value: 'rspec', label: 'RSpec', hint: 'recommended' },
        { value: 'minitest', label: 'Minitest' },
        { value: 'none', label: 'None' },
      ];
    default:
      return [
        { value: 'jest', label: 'Jest', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
  }
};

// No 'None' option: e2eTool only surfaces once the user has already picked the
// 'e2e' test type, so offering None would contradict that choice.
export const e2eToolOptions: Option<string>[] = [
  { value: 'playwright', label: 'Playwright', hint: 'recommended' },
  { value: 'cypress', label: 'Cypress' },
  { value: 'webdriverio', label: 'WebdriverIO' },
];

export const gitWorkflowOptions: Option<string>[] = [
  {
    value: 'standard',
    label: 'Standard — conventional commits, feature branches, PR required',
    hint: 'recommended',
  },
  { value: 'minimal', label: 'Minimal — free-form commits, direct commits allowed' },
  { value: 'none', label: 'None' },
];

/** Branch-naming convention. Inferred from local branch names; "Other" allows a custom rule. */
export const branchNamingOptions: Option<string>[] = [
  { value: 'type-slash', label: 'Type prefix — feature/…, fix/…, chore/…', hint: 'recommended' },
  { value: 'ticket', label: 'Ticket key — ABC-123-short-description' },
  { value: 'kebab', label: 'Plain kebab-case — short-description' },
  { value: 'none', label: 'None' },
];

/** Commit-message convention. Inferred from recent commits; "Other" allows a custom format. */
export const commitConventionOptions: Option<string>[] = [
  {
    value: 'conventional',
    label: 'Conventional Commits — type(scope): description',
    hint: 'recommended',
  },
  { value: 'ticket', label: 'Ticket-prefixed — ABC-123: description' },
  { value: 'freeform', label: 'Free-form — no enforced structure' },
  { value: 'none', label: 'None' },
];

/** When to run the formatter, linter, and tests in the git workflow. */
export const verifyTimingOptions: Option<string>[] = [
  { value: 'push', label: 'Before pushing to a remote', hint: 'recommended' },
  { value: 'commit', label: 'Before every commit' },
  { value: 'none', label: 'Never automatically' },
];

/**
 * What to do with a git-hook runner the repo already has. Leaving it alone is
 * the recommendation: the developer's hook setup is a deliberate choice, and the
 * generated guidance can reference whatever it does instead of duplicating it.
 */
export const hookPolicyOptions: Option<string>[] = [
  { value: 'leave', label: 'Leave my hooks exactly as they are', hint: 'recommended' },
  { value: 'merge', label: 'Add only the checks they are missing' },
];

/** When the change-audit skill should run in the workflow. */
export const auditTimingOptions: Option<string>[] = [
  { value: 'push', label: 'Before pushing to a remote', hint: 'recommended' },
  { value: 'commit', label: 'Before every commit' },
];

// --- Authentication ---------------------------------------------------------

/** Hosted identity providers offered regardless of language. */
const HOSTED_AUTH: Option<string>[] = [
  { value: 'auth0', label: 'Auth0' },
  { value: 'cognito', label: 'AWS Cognito' },
];

export const authApproachOptions = (a: Answers): Option<string>[] => {
  const none: Option<string> = { value: 'none', label: 'None' };
  switch (a.language) {
    case 'python':
      return a.framework === 'django'
        ? [
            { value: 'django-allauth', label: 'django-allauth', hint: 'recommended' },
            { value: 'django-auth', label: 'Built-in Django auth' },
            { value: 'authlib', label: 'Authlib (OAuth/OIDC)' },
            { value: 'custom-jwt', label: 'Custom JWT' },
            ...HOSTED_AUTH,
            none,
          ]
        : [
            { value: 'fastapi-users', label: 'fastapi-users', hint: 'recommended' },
            { value: 'authlib', label: 'Authlib (OAuth/OIDC)' },
            { value: 'custom-jwt', label: 'Custom JWT' },
            ...HOSTED_AUTH,
            none,
          ];
    case 'go':
      return [
        { value: 'golang-jwt', label: 'golang-jwt', hint: 'recommended' },
        { value: 'goth', label: 'Goth (OAuth)' },
        { value: 'sessions', label: 'Custom sessions' },
        ...HOSTED_AUTH,
        none,
      ];
    case 'rust':
      return [
        { value: 'jsonwebtoken', label: 'jsonwebtoken (JWT)', hint: 'recommended' },
        { value: 'tower-sessions', label: 'tower-sessions' },
        { value: 'oauth2', label: 'oauth2 crate' },
        ...HOSTED_AUTH,
        none,
      ];
    case 'php':
      return [
        { value: 'laravel-sanctum', label: 'Laravel Sanctum', hint: 'recommended' },
        { value: 'laravel-breeze', label: 'Laravel Breeze' },
        { value: 'laravel-passport', label: 'Laravel Passport (OAuth2)' },
        { value: 'custom-jwt', label: 'Custom JWT' },
        ...HOSTED_AUTH,
        none,
      ];
    case 'csharp':
      return [
        { value: 'aspnet-identity', label: 'ASP.NET Core Identity', hint: 'recommended' },
        { value: 'jwt-bearer', label: 'JWT Bearer' },
        { value: 'custom-jwt', label: 'Custom JWT' },
        ...HOSTED_AUTH,
        none,
      ];
    case 'java':
      return [
        { value: 'spring-security', label: 'Spring Security', hint: 'recommended' },
        { value: 'spring-security-oauth2', label: 'Spring Security OAuth2 / OIDC' },
        { value: 'custom-jwt', label: 'Custom JWT' },
        ...HOSTED_AUTH,
        none,
      ];
    case 'ruby':
      return [
        { value: 'devise', label: 'Devise', hint: 'recommended' },
        { value: 'omniauth', label: 'OmniAuth (OAuth)' },
        { value: 'custom-jwt', label: 'Custom JWT' },
        ...HOSTED_AUTH,
        none,
      ];
    default:
      // TS / JS
      return a.framework === 'nextjs'
        ? [
            { value: 'authjs', label: 'Auth.js / NextAuth', hint: 'recommended' },
            { value: 'better-auth', label: 'Better Auth' },
            { value: 'clerk', label: 'Clerk' },
            { value: 'supabase-auth', label: 'Supabase Auth' },
            { value: 'custom', label: 'Custom' },
            ...HOSTED_AUTH,
            none,
          ]
        : [
            { value: 'better-auth', label: 'Better Auth', hint: 'recommended' },
            { value: 'authjs', label: 'Auth.js' },
            { value: 'passport', label: 'Passport' },
            { value: 'clerk', label: 'Clerk' },
            { value: 'custom-jwt', label: 'Custom JWT / sessions' },
            ...HOSTED_AUTH,
            none,
          ];
  }
};

export const authStrategyOptions: Option<string>[] = [
  { value: 'session', label: 'Server-side session cookies', hint: 'recommended' },
  { value: 'jwt', label: 'Stateless JWT (access + refresh)' },
  { value: 'provider', label: 'Provider-managed (hosted)' },
  { value: 'none', label: 'None' },
];

// --- Runtime & package manager ----------------------------------------------

export const packageManagerOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript':
      return [
        { value: 'pnpm', label: 'pnpm', hint: 'recommended' },
        { value: 'npm', label: 'npm' },
        { value: 'yarn', label: 'Yarn' },
        { value: 'bun', label: 'Bun' },
        { value: 'none', label: 'None' },
      ];
    case 'python':
      return [
        { value: 'uv', label: 'uv', hint: 'recommended' },
        { value: 'poetry', label: 'Poetry' },
        { value: 'pip-venv', label: 'pip + venv' },
        { value: 'pipenv', label: 'Pipenv' },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        { value: 'maven', label: 'Maven', hint: 'recommended' },
        { value: 'gradle', label: 'Gradle' },
        { value: 'none', label: 'None' },
      ];
    default:
      return [];
  }
};

export const runtimeOptions: Option<string>[] = [
  { value: 'node', label: 'Node.js', hint: 'recommended' },
  { value: 'bun', label: 'Bun' },
  { value: 'deno', label: 'Deno' },
  { value: 'none', label: 'None' },
];

// --- Validation -------------------------------------------------------------

export const validationOptions = (a: Answers): Option<string>[] => {
  switch (a.language) {
    case 'typescript':
    case 'javascript': {
      const nest = a.framework === 'nestjs';
      return [
        { value: 'zod', label: 'Zod', ...(nest ? {} : { hint: 'recommended' }) },
        { value: 'valibot', label: 'Valibot' },
        { value: 'arktype', label: 'ArkType' },
        { value: 'yup', label: 'Yup' },
        {
          value: 'class-validator',
          label: 'class-validator',
          ...(nest ? { hint: 'recommended' } : {}),
        },
        { value: 'none', label: 'None' },
      ];
    }
    case 'python':
      return [
        { value: 'pydantic', label: 'Pydantic v2', hint: 'recommended' },
        { value: 'marshmallow', label: 'marshmallow' },
        { value: 'none', label: 'None' },
      ];
    case 'go':
      return [
        { value: 'validator', label: 'go-playground/validator', hint: 'recommended' },
        { value: 'ozzo', label: 'ozzo-validation' },
        { value: 'none', label: 'None' },
      ];
    case 'rust':
      return [
        { value: 'validator', label: 'validator', hint: 'recommended' },
        { value: 'garde', label: 'garde' },
        { value: 'none', label: 'None' },
      ];
    case 'php':
      return [
        {
          value: 'laravel-validation',
          label: 'Laravel Validation (built-in)',
          hint: 'recommended',
        },
        { value: 'respect', label: 'Respect\\Validation' },
        { value: 'none', label: 'None' },
      ];
    case 'csharp':
      return [
        { value: 'fluentvalidation', label: 'FluentValidation', hint: 'recommended' },
        { value: 'data-annotations', label: 'DataAnnotations (built-in)' },
        { value: 'none', label: 'None' },
      ];
    case 'java':
      return [
        {
          value: 'hibernate-validator',
          label: 'Bean Validation (Hibernate Validator)',
          hint: 'recommended',
        },
        { value: 'none', label: 'None' },
      ];
    case 'ruby':
      return [
        {
          value: 'active-record-validations',
          label: 'Active Record validations (built-in)',
          hint: 'recommended',
        },
        { value: 'dry-validation', label: 'dry-validation' },
        { value: 'none', label: 'None' },
      ];
    default:
      return [
        { value: 'zod', label: 'Zod', hint: 'recommended' },
        { value: 'none', label: 'None' },
      ];
  }
};

// --- State management (frontend / full-stack) -------------------------------

export const stateManagementOptions = (a: Answers): Option<string>[] => {
  switch (a.framework) {
    case 'vue':
    case 'nuxtjs':
      return [
        { value: 'pinia', label: 'Pinia', hint: 'recommended' },
        { value: 'none', label: 'None / local state' },
      ];
    case 'svelte':
    case 'sveltekit':
      return [
        { value: 'svelte-stores', label: 'Svelte stores / runes', hint: 'recommended' },
        { value: 'none', label: 'None / local state' },
      ];
    case 'angular':
      return [
        { value: 'signals', label: 'Signals', hint: 'recommended' },
        { value: 'ngrx', label: 'NgRx' },
        { value: 'none', label: 'None / services' },
      ];
    default:
      // React / Next / Remix / Solid / generic frontend
      return [
        { value: 'zustand', label: 'Zustand (client state)', hint: 'recommended' },
        { value: 'tanstack-query', label: 'TanStack Query (server state)' },
        { value: 'redux-toolkit', label: 'Redux Toolkit' },
        { value: 'jotai', label: 'Jotai' },
        { value: 'context', label: 'React Context' },
        { value: 'none', label: 'None / local state' },
      ];
  }
};
