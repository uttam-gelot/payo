/**
 * Generation contracts shared between the rule Builder, the AI providers,
 * and the generator entry point.
 */
import type { AiTool } from '../types/index';
import type { Answers } from '../questions/types';
import type { SkillSpec } from './skills';

/** A single provider-agnostic block of generated guidance. */
export interface RuleSection {
  title: string;
  body: string;
}

/** Everything a provider needs to render its artifact(s). */
export interface GenerationContext {
  answers: Answers;
  /** Provider-agnostic content assembled by the Builder (see rules.ts). */
  sections: RuleSection[];
}

/** A file the generator should write, with a path relative to cwd. */
export interface GeneratedArtifact {
  path: string;
  content: string;
}

/**
 * Describes how to drive a provider's installed CLI agent in headless mode.
 * Providers that omit this are static-only (template fallback). The agent
 * writes files itself; payo only orchestrates the subprocess.
 */
export interface AgentRunner {
  /** Executable on PATH, e.g. 'claude' | 'codex' | 'cursor-agent'. */
  binary: string;
  /** Headless + write-permission flags for one prompt. */
  buildArgs(prompt: string): string[];
  /** Pass the prompt on stdin instead of as an argv (default false). */
  promptViaStdin?: boolean;
  /** This tool consumes one master file; skills are staged per-skill then merged into it. */
  singleFile?: boolean;
  /**
   * The YAML frontmatter block this provider requires at the top of each
   * generated skill file (e.g. Claude needs `name`/`description` to discover the
   * skill; Cursor needs `globs`/`alwaysApply` to auto-attach). Returns the full
   * `---`-delimited block. Absent ⇒ the tool needs no frontmatter (plain markdown).
   */
  frontmatter?(skill: SkillSpec): string;
  /** Hard wall-clock cap; defaults to 120s. Guards CLI hang bugs. */
  timeoutMs?: number;
  /** Concrete project-relative path the skill is written to (prompt + verification). */
  outputPath(skillId: string): string;
}

/**
 * Strategy interface: each AI tool implements this once. The registry maps
 * an AiTool id to its implementation, so dispatch never uses a switch.
 */
export interface AiProvider {
  id: AiTool;
  displayName: string;
  /** Shown as the `hint` on the AI-tool select prompt. */
  hint?: string;
  /**
   * Files/dirs (project-relative) whose presence signals this tool already has
   * config in the repo. Used to detect the in-use tool and to widen the
   * overwrite guard beyond the selected tool's own targets. Paths shared by
   * more than one provider (e.g. AGENTS.md) can't identify a single tool.
   */
  knownArtifacts: readonly string[];
  /** Static template renderer — the fallback floor when no agent runs. */
  generate(ctx: GenerationContext): GeneratedArtifact[];
  /** Optional headless-CLI capability; absent ⇒ static-only. */
  agent?: AgentRunner;
}

/** Progress callbacks so the CLI can report long-running agent work. */
export interface GenerateHooks {
  /** Called once the generation mode is decided. */
  onStart?(mode: 'ai' | 'static', providerName: string, total: number): void;
  /** Called just before each skill's agent run (the blocking step). */
  onSkill?(title: string, index: number, total: number): void;
  /** Called when a skill was reused from a prior run instead of regenerated. */
  onSkillSkip?(title: string): void;
  /** Called when a skill's run failed and another attempt is about to start. */
  onSkillRetry?(title: string, attempt: number): void;
  /** Called after each skill's agent run completes. */
  onSkillResult?(title: string, ok: boolean): void;
}

/**
 * Injected resume port: lets the orchestrator skip skills finished in a prior,
 * interrupted run and record new completions. The generator stays decoupled from
 * the session schema — the CLI backs this with the persisted session.
 */
export interface ResumeStore {
  /** Skill ids confirmed done in a prior run. */
  done: ReadonlySet<string>;
  /** Persist one id as done; called after a confirmed success. */
  mark(skillId: string): void;
}

/** Outcome of a generate() run, reported to the CLI. */
export interface GenerationResult {
  mode: 'ai' | 'static';
  providerName: string;
  /** Static mode: artifact paths written by payo. */
  files: string[];
  /** AI mode: skill titles the agent generated successfully. */
  skills?: string[];
  /** AI mode: skill titles whose agent run failed. */
  failures?: string[];
}
