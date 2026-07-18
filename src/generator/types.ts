/**
 * Generation contracts shared between the rule Builder, the AI providers,
 * and the generator entry point.
 */
import type { AiTool } from '../types/index';

/** A single provider-agnostic block of generated guidance. */
export interface RuleSection {
  title: string;
  body: string;
}

/** A file the generator should write, with a path relative to cwd. */
export interface GeneratedArtifact {
  path: string;
  content: string;
}

/**
 * Describes how to drive a provider's installed CLI agent in headless mode.
 * Providers that omit this are static-only. The agent writes files itself;
 * payo only orchestrates the subprocess. The output layout and per-skill
 * frontmatter are universal constants (see generator/universal.ts), so a runner
 * only declares how to invoke its CLI — not where files land.
 */
export interface AgentRunner {
  /** Executable on PATH, e.g. 'claude' | 'codex' | 'cursor-agent'. */
  binary: string;
  /** Headless + write-permission flags for one prompt. */
  buildArgs(prompt: string): string[];
  /** Pass the prompt on stdin instead of as an argv (default false). */
  promptViaStdin?: boolean;
  /** Hard wall-clock cap; defaults to 120s. Guards CLI hang bugs. */
  timeoutMs?: number;
}

/**
 * Strategy interface: each AI tool implements this once. The registry maps
 * an AiTool id to its implementation, so dispatch never uses a switch. Output is
 * universal (generator/universal.ts); a provider only declares its identity, the
 * artifacts that detect it in a repo, and how to drive its CLI (if any).
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
  /** Called when a skill's run failed and another attempt is about to start. `reason` is the agent's stderr/diagnostic. */
  onSkillRetry?(title: string, attempt: number, reason?: string): void;
  /** Called after each skill's agent run completes. On failure, `reason` is the agent's stderr/diagnostic. */
  onSkillResult?(title: string, ok: boolean, reason?: string): void;
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
  /** AI mode: per-failure diagnostic (agent stderr / exit reason) for surfacing to the user. */
  failureDetails?: { title: string; reason?: string }[];
}
