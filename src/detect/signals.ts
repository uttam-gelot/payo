/**
 * Dependency-name → answer-value lookup tables, one set per ecosystem. The
 * values here are the literal option `value`s from src/questions/options.ts and
 * the framework/orm module ids — a unit test cross-checks that every value
 * below still exists in its question's option list, so the two never drift.
 *
 * Each table is an ordered `[dependency, value]` list checked first-match-wins,
 * so more specific signals (meta-frameworks, ODMs) must precede the generic
 * ones they build on (e.g. `next` before `react`, `mongoose` before `mongodb`).
 */

/** First value whose dependency name is present in `deps`, or undefined. */
export function firstMatch(
  deps: Set<string>,
  table: readonly (readonly [string, string])[],
): string | undefined {
  for (const [dep, value] of table) {
    if (deps.has(dep)) return value;
  }
  return undefined;
}

/**
 * First value whose key is a path-prefix of any entry in `mods`. Go module
 * paths carry a major-version suffix (`.../chi/v5`), so exact match misses;
 * prefix match catches them.
 */
export function firstPrefixMatch(
  mods: string[],
  table: readonly (readonly [string, string])[],
): string | undefined {
  for (const [prefix, value] of table) {
    if (mods.some((m) => m === prefix || m.startsWith(prefix + '/'))) return value;
  }
  return undefined;
}

// --- Node / TypeScript / JavaScript -----------------------------------------

export const NODE_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['@sveltejs/kit', 'sveltekit'],
  ['nuxt', 'nuxtjs'],
  ['next', 'nextjs'],
  ['@remix-run/react', 'remix'],
  ['@remix-run/node', 'remix'],
  ['astro', 'astro'],
  ['@nestjs/core', 'nestjs'],
  ['@angular/core', 'angular'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
  ['solid-js', 'solid'],
  ['react', 'react'],
  ['fastify', 'fastify'],
  ['express', 'express'],
  ['hono', 'hono'],
  ['koa', 'koa'],
];

/** UI-bearing frameworks → project has a frontend. */
export const NODE_UI_FRAMEWORKS = new Set([
  'sveltekit',
  'nuxtjs',
  'nextjs',
  'remix',
  'astro',
  'angular',
  'vue',
  'svelte',
  'solid',
  'react',
]);

/** Server-only frameworks → project has a backend (no UI). */
export const NODE_SERVER_FRAMEWORKS = new Set(['nestjs', 'fastify', 'express', 'hono', 'koa']);

/** Meta-frameworks that ship their own server → treat as full-stack. */
export const NODE_FULLSTACK_FRAMEWORKS = new Set(['nextjs', 'nuxtjs', 'sveltekit', 'remix']);

/** CLI arg-parsing libraries → project is a CLI tool. */
export const NODE_CLI = new Set(['commander', 'oclif', 'yargs', 'cac', '@oclif/core']);

/**
 * CLI arg-parser dep → framework answer value (the cliFrameworkOptions ids).
 * NODE_FRAMEWORK only covers web frameworks, so a CLI's framework is never set
 * from it; this fills the gap. oclif's scoped package is matched first.
 */
export const NODE_CLI_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['@oclif/core', 'oclif'],
  ['oclif', 'oclif'],
  ['commander', 'commander'],
  ['yargs', 'yargs'],
  ['cac', 'cac'],
];

export const NODE_DATABASE: readonly (readonly [string, string])[] = [
  ['pg', 'postgresql'],
  ['postgres', 'postgresql'],
  ['mysql2', 'mysql'],
  ['mysql', 'mysql'],
  ['better-sqlite3', 'sqlite'],
  ['sqlite3', 'sqlite'],
  ['@libsql/client', 'turso'],
  ['@supabase/supabase-js', 'supabase'],
  ['mongoose', 'mongodb'],
  ['mongodb', 'mongodb'],
  // `redis`/`ioredis` deliberately omitted: they are used far more often as a
  // cache than as the modeled data store, so presence alone is a weak signal
  // for the `database` answer. Left to the interview instead of a false positive.
  ['@aws-sdk/client-dynamodb', 'dynamodb'],
  ['firebase-admin', 'firebase'],
  ['firebase', 'firebase'],
  ['@clickhouse/client', 'clickhouse'],
  ['cassandra-driver', 'cassandra'],
  ['neo4j-driver', 'neo4j'],
  ['@elastic/elasticsearch', 'elasticsearch'],
];

export const NODE_ORM: readonly (readonly [string, string])[] = [
  ['@prisma/client', 'prisma'],
  ['prisma', 'prisma'],
  ['drizzle-orm', 'drizzle'],
  ['typeorm', 'typeorm'],
  ['@mikro-orm/core', 'mikroorm'],
  ['kysely', 'kysely'],
  ['sequelize', 'sequelize'],
  ['mongoose', 'mongoose'],
];

export const NODE_STYLING: readonly (readonly [string, string])[] = [
  ['tailwindcss', 'tailwind'],
  ['@pandacss/dev', 'panda'],
  ['@mui/material', 'mui'],
  ['@mantine/core', 'mantine'],
  ['@chakra-ui/react', 'chakra'],
  ['@emotion/react', 'emotion'],
  ['@emotion/styled', 'emotion'],
  ['styled-components', 'styled-components'],
  ['antd', 'antd'],
  ['unocss', 'unocss'],
  ['daisyui', 'daisyui'],
  ['bootstrap', 'bootstrap'],
];

export const NODE_VALIDATION: readonly (readonly [string, string])[] = [
  ['zod', 'zod'],
  ['valibot', 'valibot'],
  ['arktype', 'arktype'],
  ['yup', 'yup'],
  ['class-validator', 'class-validator'],
];

export const NODE_STATE: readonly (readonly [string, string])[] = [
  ['zustand', 'zustand'],
  ['@tanstack/react-query', 'tanstack-query'],
  ['@reduxjs/toolkit', 'redux-toolkit'],
  ['jotai', 'jotai'],
  ['pinia', 'pinia'],
  ['@ngrx/store', 'ngrx'],
];

export const NODE_LOGGER: readonly (readonly [string, string])[] = [
  ['pino', 'pino'],
  ['winston', 'winston'],
];

export const NODE_FORMATTER: readonly (readonly [string, string])[] = [
  ['prettier', 'prettier'],
  ['@biomejs/biome', 'biome'],
  ['dprint', 'dprint'],
];

export const NODE_LINTER: readonly (readonly [string, string])[] = [
  ['eslint', 'eslint'],
  ['@biomejs/biome', 'biome'],
  ['oxlint', 'oxlint'],
];

export const NODE_TEST_RUNNER: readonly (readonly [string, string])[] = [
  ['vitest', 'vitest'],
  ['jest', 'jest'],
];

export const NODE_E2E: readonly (readonly [string, string])[] = [
  ['@playwright/test', 'playwright'],
  ['playwright', 'playwright'],
  ['cypress', 'cypress'],
  ['webdriverio', 'webdriverio'],
];

// Only server-side packages that pin the API style are listed. Bare `graphql`
// and `grpc` are omitted: they arrive as transitive/tooling deps in many stacks
// (codegen, client libs), so their presence does not establish the API design.
export const NODE_API: readonly (readonly [string, string])[] = [
  ['@trpc/server', 'trpc'],
  ['@trpc/client', 'trpc'],
  ['@apollo/server', 'graphql'],
  ['apollo-server', 'graphql'],
  ['@nestjs/graphql', 'graphql'],
  ['graphql-yoga', 'graphql'],
  ['mercurius', 'graphql'],
  ['@grpc/grpc-js', 'grpc'],
  ['nice-grpc', 'grpc'],
];

/**
 * Auth library → approach id. Only the values valid across the TS option lists
 * are listed; `passport` is filtered to non-Next.js by the detector since it is
 * not offered for Next.js.
 */
export const NODE_AUTH: readonly (readonly [string, string])[] = [
  ['next-auth', 'authjs'],
  ['@auth/core', 'authjs'],
  ['@clerk/nextjs', 'clerk'],
  ['@clerk/backend', 'clerk'],
  ['@clerk/clerk-sdk-node', 'clerk'],
  ['better-auth', 'better-auth'],
  ['passport', 'passport'],
];

/** Files that mark a JS/TS monorepo workspace → structure = 'monorepo'. */
export const MONOREPO_MARKERS = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json'];

// --- Python ------------------------------------------------------------------

export const PY_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['django', 'django'],
  ['fastapi', 'fastapi'],
  ['litestar', 'litestar'],
  ['flask', 'flask'],
];

export const PY_CLI = new Set(['typer', 'click', 'fire']);

export const PY_DATABASE: readonly (readonly [string, string])[] = [
  ['psycopg', 'postgresql'],
  ['psycopg2', 'postgresql'],
  ['psycopg2-binary', 'postgresql'],
  ['asyncpg', 'postgresql'],
  ['pymysql', 'mysql'],
  ['mysqlclient', 'mysql'],
  ['aiomysql', 'mysql'],
  ['motor', 'mongodb'],
  ['pymongo', 'mongodb'],
  ['redis', 'redis'],
  ['supabase', 'supabase'],
];

export const PY_ORM: readonly (readonly [string, string])[] = [
  ['sqlmodel', 'sqlmodel'],
  ['sqlalchemy', 'sqlalchemy'],
  ['tortoise-orm', 'tortoise'],
  ['peewee', 'peewee'],
  ['beanie', 'beanie'],
  ['mongoengine', 'mongoengine'],
  ['motor', 'motor'],
];

export const PY_VALIDATION: readonly (readonly [string, string])[] = [
  ['pydantic', 'pydantic'],
  ['marshmallow', 'marshmallow'],
];

export const PY_LOGGER: readonly (readonly [string, string])[] = [
  ['structlog', 'structlog'],
  ['loguru', 'loguru'],
];

export const PY_FORMATTER: readonly (readonly [string, string])[] = [
  ['black', 'black'],
  ['ruff', 'ruff'],
];

export const PY_LINTER: readonly (readonly [string, string])[] = [
  ['ruff', 'ruff'],
  ['flake8', 'flake8'],
  ['pylint', 'pylint'],
];

export const PY_TEST_RUNNER: readonly (readonly [string, string])[] = [['pytest', 'pytest']];

// --- Go (module paths from go.mod require block) -----------------------------

export const GO_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['github.com/gin-gonic/gin', 'gin'],
  ['github.com/labstack/echo', 'echo'],
  ['github.com/go-chi/chi', 'chi'],
  ['github.com/gofiber/fiber', 'fiber'],
];

export const GO_CLI = new Set(['github.com/spf13/cobra', 'github.com/urfave/cli']);

export const GO_DATABASE: readonly (readonly [string, string])[] = [
  ['github.com/jackc/pgx', 'postgresql'],
  ['github.com/lib/pq', 'postgresql'],
  ['github.com/go-sql-driver/mysql', 'mysql'],
  ['github.com/mattn/go-sqlite3', 'sqlite'],
  ['modernc.org/sqlite', 'sqlite'],
  ['go.mongodb.org/mongo-driver', 'mongodb'],
];

export const GO_ORM: readonly (readonly [string, string])[] = [
  ['gorm.io/gorm', 'gorm'],
  ['entgo.io/ent', 'ent'],
  ['github.com/jmoiron/sqlx', 'sqlx-go'],
];

export const GO_VALIDATION: readonly (readonly [string, string])[] = [
  ['github.com/go-playground/validator', 'validator'],
  ['github.com/go-ozzo/ozzo-validation', 'ozzo'],
];

export const GO_LOGGER: readonly (readonly [string, string])[] = [
  ['go.uber.org/zap', 'zap'],
  ['github.com/rs/zerolog', 'zerolog'],
];

// --- Rust (crate names from Cargo.toml [dependencies]) -----------------------

export const RUST_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['axum', 'axum'],
  ['actix-web', 'actix'],
  ['rocket', 'rocket'],
];

export const RUST_CLI = new Set(['clap', 'argh']);

// Plain driver crates that name the engine directly. SQL ORMs (sqlx/diesel/
// sea-orm) instead carry the engine as a Cargo feature — handled in rust.ts.
export const RUST_DATABASE: readonly (readonly [string, string])[] = [
  ['tokio-postgres', 'postgresql'],
  ['postgres', 'postgresql'],
  ['mysql_async', 'mysql'],
  ['mysql', 'mysql'],
  ['rusqlite', 'sqlite'],
  ['mongodb', 'mongodb'],
];

export const RUST_ORM: readonly (readonly [string, string])[] = [
  ['diesel', 'diesel'],
  ['sea-orm', 'seaorm'],
  ['sqlx', 'sqlx-rust'],
];

export const RUST_VALIDATION: readonly (readonly [string, string])[] = [
  ['validator', 'validator'],
  ['garde', 'garde'],
];

export const RUST_LOGGER: readonly (readonly [string, string])[] = [
  ['tracing', 'tracing'],
  ['log', 'log'],
];

// --- PHP (Composer package names from composer.json require/require-dev) ------

export const PHP_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['laravel/framework', 'laravel'],
];

/** CLI-oriented PHP packages → project is a CLI tool (when no web framework). */
export const PHP_CLI = new Set(['symfony/console', 'laravel-zero/framework']);

/**
 * CLI package → framework answer value (the cliFrameworkOptions ids). Laravel Zero
 * is built on symfony/console, so match it first.
 */
export const PHP_CLI_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['laravel-zero/framework', 'laravel-zero'],
  ['symfony/console', 'symfony-console'],
];

// PHP talks to databases through PDO/mysqli — the engine shows up as a platform
// `ext-*` requirement (or a driver package) rather than a userland library.
export const PHP_DATABASE: readonly (readonly [string, string])[] = [
  ['ext-pgsql', 'postgresql'],
  ['ext-pdo_pgsql', 'postgresql'],
  ['ext-mysqli', 'mysql'],
  ['ext-pdo_mysql', 'mysql'],
  ['ext-pdo_sqlite', 'sqlite'],
  ['ext-sqlite3', 'sqlite'],
  ['mongodb/laravel-mongodb', 'mongodb'],
  ['ext-mongodb', 'mongodb'],
];

// Eloquent ships inside laravel/framework (illuminate/database), so a Laravel
// app is handled in the detector; this catches a standalone Eloquent install.
export const PHP_ORM: readonly (readonly [string, string])[] = [
  ['illuminate/database', 'eloquent'],
];

export const PHP_VALIDATION: readonly (readonly [string, string])[] = [
  ['respect/validation', 'respect'],
];

export const PHP_LOGGER: readonly (readonly [string, string])[] = [['monolog/monolog', 'monolog']];

export const PHP_FORMATTER: readonly (readonly [string, string])[] = [
  ['laravel/pint', 'pint'],
  ['friendsofphp/php-cs-fixer', 'php-cs-fixer'],
];

// larastan/larastan is PHPStan packaged for Laravel — both map to phpstan.
export const PHP_LINTER: readonly (readonly [string, string])[] = [
  ['phpstan/phpstan', 'phpstan'],
  ['larastan/larastan', 'phpstan'],
  ['vimeo/psalm', 'psalm'],
];

// Pest is built on PHPUnit, so match the more specific signal first.
export const PHP_TEST_RUNNER: readonly (readonly [string, string])[] = [
  ['pestphp/pest', 'pest'],
  ['phpunit/phpunit', 'phpunit'],
];

export const PHP_AUTH: readonly (readonly [string, string])[] = [
  ['laravel/sanctum', 'laravel-sanctum'],
  ['laravel/passport', 'laravel-passport'],
  ['laravel/breeze', 'laravel-breeze'],
];

// --- C# / .NET (NuGet PackageReference ids from *.csproj, lower-cased) --------
// The framework (ASP.NET Core) is inferred from the project SDK attribute in the
// detector; these tables cover the dependency-driven answers.

/** CLI-oriented .NET packages → project is a CLI tool (when no web SDK). */
export const DOTNET_CLI = new Set(['system.commandline', 'spectre.console.cli', 'spectre.console']);

/** CLI package → framework answer value (cliFrameworkOptions ids). */
export const DOTNET_CLI_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['system.commandline', 'system-commandline'],
  ['spectre.console.cli', 'spectre-console'],
  ['spectre.console', 'spectre-console'],
];

// EF Core provider packages name the engine; raw ADO.NET drivers do too.
export const DOTNET_DATABASE: readonly (readonly [string, string])[] = [
  ['npgsql.entityframeworkcore.postgresql', 'postgresql'],
  ['npgsql', 'postgresql'],
  ['pomelo.entityframeworkcore.mysql', 'mysql'],
  ['mysqlconnector', 'mysql'],
  ['mysql.data', 'mysql'],
  ['microsoft.entityframeworkcore.sqlserver', 'sqlserver'],
  ['microsoft.data.sqlclient', 'sqlserver'],
  ['system.data.sqlclient', 'sqlserver'],
  ['microsoft.entityframeworkcore.sqlite', 'sqlite'],
  ['microsoft.data.sqlite', 'sqlite'],
  ['mongodb.entityframeworkcore', 'mongodb'],
  ['mongodb.driver', 'mongodb'],
];

// EF Core is detected via a prefix scan in the detector (many provider packages
// share the microsoft.entityframeworkcore.* prefix); this catches Dapper.
export const DOTNET_ORM: readonly (readonly [string, string])[] = [['dapper', 'dapper']];

export const DOTNET_VALIDATION: readonly (readonly [string, string])[] = [
  ['fluentvalidation', 'fluentvalidation'],
];

// microsoft.extensions.logging is the built-in facade; only counted when directly
// referenced (Serilog/NLog take precedence and are matched first).
export const DOTNET_LOGGER: readonly (readonly [string, string])[] = [
  ['serilog.aspnetcore', 'serilog'],
  ['serilog', 'serilog'],
  ['nlog.web.aspnetcore', 'nlog'],
  ['nlog', 'nlog'],
  ['microsoft.extensions.logging', 'ms-logging'],
];

// dotnet format is the built-in default (set unconditionally in the detector);
// CSharpier is the only opt-in formatter that ships as a package.
export const DOTNET_FORMATTER: readonly (readonly [string, string])[] = [
  ['csharpier', 'csharpier'],
];

// Built-in Roslyn analyzers are always on and undetectable; only the opt-in
// analyzer packages leave a signal.
export const DOTNET_LINTER: readonly (readonly [string, string])[] = [
  ['roslynator.analyzers', 'roslynator'],
  ['stylecop.analyzers', 'stylecop'],
];

export const DOTNET_TEST_RUNNER: readonly (readonly [string, string])[] = [
  ['xunit', 'xunit'],
  ['nunit', 'nunit'],
  ['mstest.testframework', 'mstest'],
];

export const DOTNET_AUTH: readonly (readonly [string, string])[] = [
  ['microsoft.aspnetcore.identity.entityframeworkcore', 'aspnet-identity'],
  ['microsoft.aspnetcore.identity', 'aspnet-identity'],
  ['microsoft.aspnetcore.authentication.jwtbearer', 'jwt-bearer'],
];

// --- Java / JVM (artifact ids + plugin-id segments from pom.xml / build.gradle) ---
// The manifest reader lower-cases every token and adds both a plugin's full id
// and its last dotted segment, so these tables key on artifact ids (`postgresql`,
// `spring-boot-starter-web`) and plugin segments (`spotless`, `checkstyle`).

export const JAVA_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['spring-boot-starter-webflux', 'spring-boot'],
  ['spring-boot-starter-web', 'spring-boot'],
  ['spring-boot-starter', 'spring-boot'],
  ['spring-boot-starter-parent', 'spring-boot'],
  ['spring-boot-maven-plugin', 'spring-boot'],
  ['org.springframework.boot', 'spring-boot'],
];

/** CLI-oriented Java libraries → project is a CLI tool (when no web framework). */
export const JAVA_CLI = new Set(['picocli', 'spring-shell-starter', 'spring-shell']);

/** CLI dependency → framework answer value (cliFrameworkOptions ids). */
export const JAVA_CLI_FRAMEWORK: readonly (readonly [string, string])[] = [
  ['picocli', 'picocli'],
  ['spring-shell-starter', 'spring-shell'],
  ['spring-shell', 'spring-shell'],
];

// JDBC driver / Spring Data starter artifact ids name the engine directly.
export const JAVA_DATABASE: readonly (readonly [string, string])[] = [
  ['postgresql', 'postgresql'],
  ['mysql-connector-j', 'mysql'],
  ['mysql-connector-java', 'mysql'],
  ['mariadb-java-client', 'mariadb'],
  ['sqlite-jdbc', 'sqlite'],
  ['mssql-jdbc', 'sqlserver'],
  ['spring-boot-starter-data-mongodb', 'mongodb'],
  ['mongodb-driver-sync', 'mongodb'],
  ['mongodb-driver-reactivestreams', 'mongodb'],
];

// Spring Data JPA and Hibernate both resolve to the JPA/Hibernate data layer.
export const JAVA_ORM: readonly (readonly [string, string])[] = [
  ['spring-boot-starter-data-jpa', 'spring-data-jpa'],
  ['spring-data-jpa', 'spring-data-jpa'],
  ['hibernate-core', 'spring-data-jpa'],
];

export const JAVA_VALIDATION: readonly (readonly [string, string])[] = [
  ['hibernate-validator', 'hibernate-validator'],
  ['spring-boot-starter-validation', 'hibernate-validator'],
];

// Logback ships transitively with Spring Boot, so it only appears here when
// declared explicitly; Log4j2 (the opt-in swap) is the stronger signal, matched first.
export const JAVA_LOGGER: readonly (readonly [string, string])[] = [
  ['spring-boot-starter-log4j2', 'log4j2'],
  ['log4j-core', 'log4j2'],
  ['logback-classic', 'logback'],
];

// Formatters run as build plugins; both the Maven plugin artifact id and the
// Gradle plugin-id segment (`spotless`) are collected by the reader.
export const JAVA_FORMATTER: readonly (readonly [string, string])[] = [
  ['spotless-maven-plugin', 'spotless'],
  ['com.diffplug.spotless', 'spotless'],
  ['spotless', 'spotless'],
  ['google-java-format', 'google-java-format'],
];

export const JAVA_LINTER: readonly (readonly [string, string])[] = [
  ['maven-checkstyle-plugin', 'checkstyle'],
  ['checkstyle', 'checkstyle'],
  ['maven-pmd-plugin', 'pmd'],
  ['pmd', 'pmd'],
  ['spotbugs-maven-plugin', 'spotbugs'],
  ['com.github.spotbugs', 'spotbugs'],
  ['spotbugs', 'spotbugs'],
];

// TestNG is the opt-in swap; JUnit 5 (junit-jupiter / the Spring Boot test
// starter) is the default, so match the more specific TestNG signal first.
export const JAVA_TEST_RUNNER: readonly (readonly [string, string])[] = [
  ['testng', 'testng'],
  ['junit-jupiter', 'junit5'],
  ['spring-boot-starter-test', 'junit5'],
];

// OAuth2/OIDC starters are the more specific signal → matched before plain security.
export const JAVA_AUTH: readonly (readonly [string, string])[] = [
  ['spring-boot-starter-oauth2-resource-server', 'spring-security-oauth2'],
  ['spring-boot-starter-oauth2-client', 'spring-security-oauth2'],
  ['spring-security-oauth2-client', 'spring-security-oauth2'],
  ['spring-boot-starter-security', 'spring-security'],
  ['spring-security-core', 'spring-security'],
];
