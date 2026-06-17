/**
 * Shared TypeScript types for Payo.
 */

export type AiTool =
  | 'cursor'
  | 'windsurf'
  | 'copilot'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'other'
  | (string & {});

export type ProjectType = 'full-stack' | 'frontend' | 'backend' | 'cli' | 'script' | (string & {});

export type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'rust' | (string & {});

export type Framework =
  | 'nextjs'
  | 'remix'
  | 'nuxtjs'
  | 'sveltekit'
  | 'astro'
  | 'react'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'vanilla'
  | 'express'
  | 'nestjs'
  | 'fastify'
  | 'hono'
  | 'fastapi'
  | 'django'
  | 'flask'
  | 'gin'
  | 'echo'
  | 'fiber'
  | 'axum'
  | 'actix'
  // CLI argument-parsing frameworks (no deep TechModules; option-only).
  | 'commander'
  | 'oclif'
  | 'yargs'
  | 'cac'
  | 'typer'
  | 'click'
  | 'argparse'
  | 'fire'
  | 'cobra'
  | 'urfave-cli'
  | 'flag'
  | 'clap'
  | 'argh'
  | 'none'
  | (string & {});

export type ApiArchitecture = 'rest' | 'graphql' | 'grpc' | 'trpc' | 'none' | (string & {});

export type StylingLibrary =
  | 'tailwind'
  | 'css-modules'
  | 'styled-components'
  | 'shadcn'
  | 'mui'
  | 'vanilla-css'
  | 'none'
  | (string & {});

export type Database =
  | 'postgresql'
  | 'mysql'
  | 'sqlite'
  | 'mongodb'
  | 'redis'
  | 'dynamodb'
  | 'supabase'
  | 'firebase'
  | 'none'
  | (string & {});

export type OrmChoice =
  | 'prisma'
  | 'drizzle'
  | 'typeorm'
  | 'sequelize'
  | 'kysely'
  | 'mongoose'
  | 'sqlalchemy'
  | 'django-orm'
  | 'sqlmodel'
  | 'motor'
  | 'mongoengine'
  | 'gorm'
  | 'ent'
  | 'sqlc'
  | 'diesel'
  | 'seaorm'
  | 'sqlx'
  | 'native-driver'
  | 'raw-sql'
  | 'none'
  | (string & {});

export type StructureChoice =
  | 'standard'
  | 'feature-based'
  | 'ddd'
  | 'monorepo'
  | 'custom'
  | (string & {});

export type GitWorkflow = 'standard' | 'minimal' | (string & {});

export type Formatter =
  | 'prettier'
  | 'biome'
  | 'black'
  | 'ruff'
  | 'gofmt'
  | 'rustfmt'
  | 'none'
  | (string & {});

export type Linter =
  | 'eslint'
  | 'biome'
  | 'standardjs'
  | 'ruff'
  | 'flake8'
  | 'pylint'
  | 'golangci-lint'
  | 'clippy'
  | 'none'
  | (string & {});

export interface ProjectAnswers {
  aiTool?: AiTool;
  projectType?: ProjectType;
  projectDefinition?: string;
  language?: Language;
  framework?: Framework;
  apiArchitecture?: ApiArchitecture;
  stylingLibrary?: StylingLibrary;
  database?: Database;
  orm?: OrmChoice;
  structure?: StructureChoice;
  codingStandards?: string[];
  documentation?: string[];
  formatter?: Formatter;
  linter?: Linter;
  gitWorkflow?: GitWorkflow;
  aiAttribution?: boolean;
}
