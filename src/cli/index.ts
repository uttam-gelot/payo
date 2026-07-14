import { outro, note, log, spinner } from '@clack/prompts';
import {
  loadSession,
  createSession,
  clearSession,
  recordAnswer,
  recordGenerated,
  seedDetected,
  cleanupWorkspace,
  type Session,
} from '../state/index';
import {
  confirmResume,
  confirmBootstrapPrompt,
  confirmOverwrite,
  confirmLegacyCleanup,
  confirmStartMode,
  confirmDetectionDepth,
  summarizeDetection,
  runQuestion,
} from '../questions/runner';
import { findLegacyArtifacts, removeLegacyArtifacts } from '../generator/legacy';
import { detectStack } from '../detect/index';
import { scanExistingAiConfigs, detectAiTool } from '../detect/aiconfig';
import { llmDetect, willLlmDetectRun } from '../detect/llm';
import { splitByTier } from '../detect/tiers';
import { runFlow, reviewAndEdit, findQuestion, reconcile } from '../questions/engine';
import { flow } from '../questions/flow';
import {
  generate,
  generateBootstrap,
  existingTargets,
  predictedExisting,
  backupFiles,
} from '../generator/index';
import type { ResumeStore } from '../generator/types';
import { printBanner } from './banner';

export async function run(): Promise<void> {
  printBanner();

  // --- Resume / Restart ---
  let session: Session;
  const existing = loadSession();
  if (existing && existing.answered.length > 0) {
    const resume = await confirmResume(existing.answered.length);
    if (resume) {
      session = existing;
      note(`Resuming — ${session.answered.length} question(s) already answered.`, 'Resuming');
    } else {
      clearSession();
      session = createSession();
    }
  } else {
    session = existing ?? createSession();
  }

  // Whether the user chose to work with an already-existing project (Gate 1).
  // Bootstrap-prompt generation only makes sense when scaffolding a new project,
  // so it is suppressed on this path.
  let startedFromExisting = false;

  // Set when the user picks "detect everything": the questionnaire then auto-fills
  // every convention/preference gate with recommended defaults instead of asking,
  // deferring all confirmation to the review screen.
  let autoRecommendGates = false;

  // --- Auto-detect existing stack (fresh sessions only; resume keeps answers) ---
  if (session.answered.length === 0) {
    const detected = detectStack(process.cwd());
    if (Object.keys(detected.answers).length > 0) {
      // The repo may already hold AI config — possibly for a different tool than
      // the user is about to pick. Surface it and pre-select the tool in use.
      const existingAiConfigs = scanExistingAiConfigs(process.cwd());
      const detectedAiTool = detectAiTool(process.cwd());
      if (existingAiConfigs.length > 0) {
        note(
          existingAiConfigs.map((f) => `• ${f}`).join('\n'),
          detectedAiTool
            ? `Existing AI config detected (looks like ${detectedAiTool})`
            : 'Existing AI config detected',
        );
      }

      // Existing project. aiTool is always the first question — ask it now so the
      // Stage-2 LLM pass can use the chosen agent; recordAnswer ⇒ runFlow skips it.
      const aiToolQ = findQuestion(flow, session.answers, 'aiTool');
      if (aiToolQ) {
        // Seed the detected tool so the prompt pre-selects it; the user's pick wins.
        const seeded = detectedAiTool ? seedDetected(session, { aiTool: detectedAiTool }) : session;
        session = recordAnswer(session, 'aiTool', await runQuestion(aiToolQ, seeded.answers));
      }

      // Gate 1 — work with the existing project, or start fresh?
      if ((await confirmStartMode()) === 'existing') {
        startedFromExisting = true;
        // Gate 2 — detect everything (auto-fill + review) or just the stack?
        const depth = await confirmDetectionDepth();
        autoRecommendGates = depth === 'everything';

        // Stage 2 — LLM pass over the chosen agent (additive; static-only fallback).
        const aiTool =
          typeof session.answers.aiTool === 'string' ? session.answers.aiTool : undefined;
        let result = detected;
        // Only spin when the pass will actually run — otherwise the spinner lies
        // ("Analysis complete") on the common no-agent / nothing-to-fill path.
        if (willLlmDetectRun(detected, aiTool, depth)) {
          const s = spinner();
          s.start(`Analyzing your project with ${aiTool}`);
          try {
            result = await llmDetect(detected, aiTool, depth, process.cwd());
          } finally {
            // Report what the pass actually produced, not a blanket "complete".
            // Stage 2 tags each id it fills with source 'llm'; on any silent
            // fallback (no result file, timeout, all off-vocab) that count is 0,
            // so the message never claims a detection that did not happen.
            const added = Object.values(result.sources).filter((src) => src === 'llm').length;
            s.stop(
              added > 0
                ? `Analysis complete — ${added} more detail${added === 1 ? '' : 's'} detected`
                : 'Analysis complete — no extra details found',
            );
          }
        }

        summarizeDetection(result);

        // Apply by tier and depth.
        // - "everything": the user confirms once at the review screen, so every
        //   detected fact (both tiers, LLM guesses included) is recordAnswer'd —
        //   skipped inline, pre-filled and editable at review. runFlow then
        //   auto-fills the remaining convention/preference gates (see below).
        // - "partial": deterministic Tier-1 facts are recorded (skipped); Stage-2
        //   LLM fills are seeded instead (pre-selected but still asked, giving the
        //   least-trustworthy source an explicit confirmation); Tier-2 conventions
        //   are left entirely to the interview.
        const { tier1, tier2 } = splitByTier(result.answers as Record<string, unknown>);
        const applyRecorded = (entries: Record<string, unknown>): void => {
          for (const [id, value] of Object.entries(entries)) {
            session = recordAnswer(session, id, value);
          }
        };
        const applySeeded = (entries: Record<string, unknown>): void => {
          for (const [id, value] of Object.entries(entries)) {
            session =
              result.sources[id] === 'llm'
                ? seedDetected(session, { [id]: value })
                : recordAnswer(session, id, value);
          }
        };
        if (depth === 'everything') {
          applyRecorded(tier1);
          applyRecorded(tier2);
        } else {
          applySeeded(tier1);
        }

        // Carry per-package stacks (monorepo) to the generator as derived data.
        // Not a Question, so it never surfaces as an editable review line.
        if (result.packages && result.packages.length > 0) {
          session = recordAnswer(session, 'monorepoPackages', result.packages);
        }

        // Detectors seed facts independent of project shape (e.g. a styling lib
        // on a backend project). Drop any recorded answer whose question is
        // unreachable under the detected answers, so orphaned facts don't leak
        // into generation or show a phantom line in the review screen. Seeded
        // Tier-2 hints live in `answers` only (not `answered`) and are untouched.
        session = reconcile(flow, session);
      }
      // Gate 1 "fresh" → seed nothing; normal flow (aiTool already answered).
    }
  }

  // --- Dynamic questionnaire ---
  session = await runFlow(flow, session, { autoRecommendGates });

  // --- Review answers before generating (with inline edit) ---
  session = await reviewAndEdit(flow, session);

  // --- Generate provider artifact(s) ---
  // Resume: skip skills a prior interrupted run already finished. The working
  // dir is removed once we reach the end of run(), so only a killed run (which
  // exits before cleanup) carries progress over.
  const resumeCount = session.generated.length;

  // --- Overwrite guard ---
  // Checked before any generation work starts, so no agent call is wasted on a
  // run the user then abandons. Skipped on resume: those files exist because
  // payo's own interrupted run wrote them.
  if (resumeCount === 0) {
    const existing = existingTargets(session.answers);
    if (existing.length > 0) {
      const choice = await confirmOverwrite(existing);
      if (choice === 'skip') {
        // Keep the .payo/ session so a re-run resumes with these answers.
        outro('Skipped — existing files left untouched. Run again to revisit.');
        return;
      }
      if (choice === 'backup') {
        // Back up only the files THIS run will overwrite. Other tools' configs
        // (in `existing` but not our own targets) are left in place — moving them
        // would silently disable a tool this run does not replace.
        const own = predictedExisting(session.answers);
        const others = existing.filter((f) => !own.includes(f));
        const backups = backupFiles(own);
        if (backups.length > 0) {
          note(backups.map((b) => `• ${b}`).join('\n'), 'Existing files renamed');
        }
        if (others.length > 0) {
          note(others.map((f) => `• ${f}`).join('\n'), "Left untouched (other tools' configs)");
        }
      }
    }
  }

  const resume: ResumeStore = {
    done: new Set(session.generated),
    mark: (id) => {
      session = recordGenerated(session, id);
    },
  };
  const result = await generate(
    session.answers,
    {
      onStart: (mode, providerName, total) => {
        if (mode !== 'ai') {
          log.info(`Writing ${total} file(s) from templates via ${providerName}…`);
        } else if (resumeCount > 0) {
          log.info(
            `Resuming with ${providerName} — ${resumeCount} skill(s) already done; generating the rest in parallel…`,
          );
        } else {
          log.info(
            `Using ${providerName} to generate ${total} doc(s) in parallel. Each runs the AI tool and may take a minute…`,
          );
        }
      },
      onSkill: (title, index, total) => log.step(`(${index}/${total}) Generating ${title}…`),
      onSkillSkip: (title) => log.info(`${title} already generated — skipping.`),
      onSkillRetry: (title, attempt) => log.warn(`${title} failed (attempt ${attempt}); retrying…`),
      onSkillResult: (title, ok) => {
        if (!ok) log.warn(`${title} failed (will fall back to templates if all fail).`);
      },
    },
    resume,
  );
  if (result.mode === 'ai') {
    const lines = result.files.map((f) => `• ${f}`);
    if (result.failures?.length) lines.push(`(failed: ${result.failures.join(', ')})`);
    note(lines.join('\n'), `Generated via ${result.providerName} (AI) in ${process.cwd()}`);
  } else {
    note(
      result.files.map((f) => `• ${f}`).join('\n'),
      `Generated via ${result.providerName} (static) in ${process.cwd()}`,
    );
  }
  // Offer to remove retired per-tool config the universal layout supersedes.
  // Only after a successful write, so we never delete the old files before the
  // replacement exists. Default off — the user opts into deletion.
  const legacy = findLegacyArtifacts();
  if (legacy.length > 0 && (await confirmLegacyCleanup(legacy))) {
    const removed = removeLegacyArtifacts(legacy);
    if (removed.length > 0) {
      note(removed.map((f) => `• ${f}`).join('\n'), 'Removed legacy config');
    }
  }

  // Generation finished — remove the working dir (.payo/) and its session.
  cleanupWorkspace();

  // Offer a paste-ready prompt to scaffold a working project from the new skills.
  // The provider's CLI agent writes it when installed; otherwise a deterministic
  // template is used as the floor.
  if (!startedFromExisting && (await confirmBootstrapPrompt())) {
    // The agent run blocks; show a spinner while it generates (AI path only).
    let spin: ReturnType<typeof spinner> | undefined;
    const bootstrap = await generateBootstrap(session.answers, result.files, (name) => {
      spin = spinner();
      spin.start(`Generating bootstrap prompt with ${name}… this may take a minute.`);
    });
    spin?.stop(
      bootstrap.mode === 'ai'
        ? `Generated bootstrap prompt with ${result.providerName}.`
        : 'AI generation unavailable — wrote a deterministic prompt instead.',
    );
    note(
      `Saved to ${bootstrap.path}\nPaste its contents into any LLM to scaffold the project.`,
      'Bootstrap prompt',
    );
  }

  outro('✅ Config generated!');
}
