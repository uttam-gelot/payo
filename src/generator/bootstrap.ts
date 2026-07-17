/**
 * The post-generation "bootstrap prompt": a paste-ready instruction the user
 * hands to an LLM to scaffold a working project that honors the just-generated
 * guidance files.
 *
 * Two builders live here, both pure:
 *  - `buildBootstrapPrompt` — the deterministic floor, assembled from the answers,
 *    the written files, and the stack's resolved commands.
 *  - `buildBootstrapMetaPrompt` — drives the user's installed CLI agent to WRITE a
 *    polished bootstrap-prompt.md itself, injecting the same resolved commands as
 *    fixed facts so the model never has to guess them.
 * Orchestration (which path runs) lives in src/generator/index.ts.
 */
import path from 'node:path';
import type { Answers } from '../questions/types';
import { writeFileAtomic } from '../fsutil';
import { buildBaseRules, fenceProjectData, renderMarkdown } from './rules';
import { resolveCommands, type StackCommands } from './commands';
import { hasTesting } from '../stack/predicates';

/** Read a string answer, treating empty / 'none' as unset (mirrors rules.ts). */
function str(a: Answers, key: string): string | undefined {
  const v = a[key];
  if (typeof v !== 'string' || !v || v === 'none') return undefined;
  return v;
}

/** A markdown bullet list of the resolved commands, or '' when none are known. */
function commandsBlock(cmds: StackCommands): string {
  const lines = [
    cmds.scaffold && `- Scaffold: \`${cmds.scaffold}\``,
    cmds.dev && `- Dev server: \`${cmds.dev}\``,
    cmds.build && `- Build: \`${cmds.build}\``,
    cmds.test && `- Test: \`${cmds.test}\``,
    cmds.migrate && `- Migrate: \`${cmds.migrate}\``,
  ].filter(Boolean);
  return lines.join('\n');
}

/** The numbered "Your task" steps, tailored to whatever the answers specify. */
function taskSteps(answers: Answers): string {
  const cmds = resolveCommands(answers);
  const pm = str(answers, 'packageManager');
  const fmt = str(answers, 'formatter');
  const lint = str(answers, 'linter');

  const steps: string[] = [];

  steps.push(
    cmds.scaffold
      ? `Scaffold the project by running \`${cmds.scaffold}\` — the official generator for ` +
          'this stack. Substitute a real project/module name and accept its defaults ' +
          'where they fit the specification. Do not hand-roll boilerplate the generator ' +
          'already produces.'
      : "Scaffold the project with the stack's official tooling (its CLI / init " +
          'command run through the package manager named in the specification). If the ' +
          'framework has no official generator, set up a minimal skeleton by hand and ' +
          'add the framework as a dependency. Do not hand-roll what a generator produces.',
  );
  steps.push('Propose the folder structure and the initial set of files.');
  steps.push(
    'Generate a minimal but runnable skeleton (entrypoint, config, dependency setup, ' +
      'and a hello-world route/page that proves the stack works).',
  );
  steps.push(
    'Use exactly the language, framework, package manager, runtime, and tooling named ' +
      'in the specification — do not substitute a different stack.',
  );
  if (pm) {
    steps.push(`Install dependencies with ${pm} and commit its lockfile.`);
  }
  if (fmt || lint) {
    const tools = [fmt && `the formatter (${fmt})`, lint && `the linter (${lint})`]
      .filter(Boolean)
      .join(' and ');
    steps.push(
      `Wire up ${tools} with config committed to the repo, and leave the skeleton ` +
        'passing them.',
    );
  }
  steps.push(
    'Create a `.env.example` documenting every required environment variable (never ' +
      'commit a real `.env`).',
  );
  const runParts = [
    cmds.dev && `run it with \`${cmds.dev}\``,
    cmds.build && `build it with \`${cmds.build}\``,
    cmds.test && `run tests with \`${cmds.test}\``,
    cmds.migrate && `run migrations with \`${cmds.migrate}\``,
  ].filter(Boolean);
  // Only promise verification commands the user actually selected — a project
  // whose testing was skipped must not be told to run tests.
  const verifyCmds = ['typecheck', lint && 'lint', hasTesting(answers) && 'test']
    .filter(Boolean)
    .join(' / ');
  steps.push(
    'Give me the precise install and run commands' +
      (runParts.length ? ` (${runParts.join(', ')})` : '') +
      `, plus the exact ${verifyCmds} commands so I can confirm the skeleton is green.`,
  );
  steps.push('Then wait for me to run it and report back; fix issues until it runs.');

  const numbered = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `## Your task\n${numbered}\n\nKeep the first iteration small and runnable; we expand from there.`;
}

/** The "## Source of truth" block naming the generated guidance files. */
function sourceOfTruth(files: string[], providerName: string): string {
  const fileList = files.map((f) => `- ${f}`).join('\n');
  return (
    `## Source of truth\nThis repo already contains assistant guidance generated for ` +
    `${providerName}. The files below are the canonical conventions — read and follow ` +
    `them; the specification above is a quick-reference summary:\n${fileList}`
  );
}

/** Static, paste-ready prompt: project spec + generated-file references + task. */
export function buildBootstrapPrompt(
  answers: Answers,
  files: string[],
  providerName: string,
): string {
  const spec = renderMarkdown('Project Specification (summary)', buildBaseRules(answers));
  return [
    '# Project bootstrap prompt',
    'You are a senior software engineer. Scaffold a new, working project from ' +
      'scratch that matches the specification below, then iterate with me until ' +
      'it runs cleanly.',
    spec,
    sourceOfTruth(files, providerName),
    taskSteps(answers),
  ].join('\n\n');
}

/**
 * Meta-prompt that drives the user's installed CLI agent to WRITE a polished
 * `bootstrap-prompt.md` itself. We hand the agent the spec, the generated files,
 * and the resolved commands as fixed facts (so it never invents scaffold flags),
 * then let it write the project-specific prose and step ordering a static
 * template cannot. The agent must write the file; it does not scaffold anything.
 */
export function buildBootstrapMetaPrompt(
  answers: Answers,
  files: string[],
  providerName: string,
  commands: StackCommands,
): string {
  const spec = renderMarkdown('Project Specification (summary)', buildBaseRules(answers));
  const cmds = commandsBlock(commands);
  return [
    'You are a senior software engineer writing a *bootstrap prompt* — a single ' +
      'markdown document the user will later paste into an LLM to scaffold this project ' +
      'from scratch. Write the best possible such prompt for the project below.',
    fenceProjectData(spec),
    sourceOfTruth(files, providerName),
    cmds
      ? 'Use these exact, authoritative commands for this stack — do not invent or alter ' +
        `flags, and prefer them over anything you might recall:\n${cmds}`
      : 'This stack has no curated scaffold command; instruct the reader to use the ' +
        "framework's official tooling, or a minimal hand-rolled skeleton if none exists.",
    'Compose a focused, paste-ready prompt that: opens with the engineer role and goal; ' +
      'restates the spec concisely; points at the source-of-truth files as canonical; and ' +
      'gives a short numbered task list (scaffold → structure → runnable skeleton → install ' +
      `→ wire formatter/linter → \`.env.example\` → exact run/build${hasTesting(answers) ? '/test' : ''} commands → iterate). ` +
      'Keep it tight and runnable; no filler. Mention ONLY what the specification names — ' +
      'if it lists no testing setup, the prompt must not tell the reader to add or run tests.',
    'Requirements:',
    [
      '- Write the result to the project-local file ./bootstrap-prompt.md (relative to the ' +
        'current working directory — this project). Do NOT write to any global, ' +
        'home-directory, or user-level location.',
      '- Output ONLY that file. Do not scaffold the project, run commands, or ask questions.',
    ].join('\n'),
  ].join('\n\n');
}

/** Build + write to <cwd>/bootstrap-prompt.md; returns the project-relative path. */
export function writeBootstrapPrompt(
  answers: Answers,
  files: string[],
  providerName: string,
): string {
  const rel = 'bootstrap-prompt.md';
  writeFileAtomic(
    path.join(process.cwd(), rel),
    buildBootstrapPrompt(answers, files, providerName),
  );
  return rel;
}
