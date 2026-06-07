/**
 * The post-generation "bootstrap prompt": a static, paste-ready instruction the
 * user hands to any LLM to scaffold a working project that honors the just-
 * generated guidance files. Assembled deterministically from the answers and the
 * list of written files — no second LLM pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Answers } from '../questions/types';
import { buildBaseRules, renderMarkdown } from './rules';

/** Static, paste-ready prompt: project spec + generated-file references + task. */
export function buildBootstrapPrompt(
  answers: Answers,
  files: string[],
  providerName: string,
): string {
  const spec = renderMarkdown('Project Specification', buildBaseRules(answers));
  const fileList = files.map((f) => `- ${f}`).join('\n');
  return [
    '# Project bootstrap prompt',
    'You are a senior software engineer. Scaffold a new, working project from ' +
      'scratch that matches the specification below, then iterate with me until ' +
      'it runs cleanly.',
    spec,
    `## Guidance already in this repo\nThis repo contains assistant guidance ` +
      `generated for ${providerName}. Read and follow these files as the source ` +
      `of truth for conventions:\n${fileList}`,
    '## Your task\n' +
      "1. Scaffold the project with the stack's official tooling — the " +
      'framework’s official CLI / create command (e.g. `create-next-app`, ' +
      '`npm create vite`, `cargo new`, `django-admin startproject`) run through ' +
      'the package manager named in the specification. Do not hand-roll boilerplate ' +
      'that an official generator already produces.\n' +
      '2. Propose the folder structure and the initial set of files.\n' +
      '3. Generate a minimal but runnable skeleton (entrypoint, config, ' +
      'dependency setup, and a hello-world route/page that proves the stack works).\n' +
      '4. Use exactly the language, framework, package manager, runtime, and ' +
      'tooling named in the specification — do not substitute a different stack.\n' +
      '5. Give me the precise install and run commands.\n' +
      '6. Then wait for me to run it and report back; fix issues until it runs.\n\n' +
      'Keep the first iteration small and runnable; we expand from there.',
  ].join('\n\n');
}

/** Build + write to <cwd>/bootstrap-prompt.md; returns the project-relative path. */
export function writeBootstrapPrompt(
  answers: Answers,
  files: string[],
  providerName: string,
): string {
  const rel = 'bootstrap-prompt.md';
  fs.writeFileSync(
    path.join(process.cwd(), rel),
    buildBootstrapPrompt(answers, files, providerName),
  );
  return rel;
}
