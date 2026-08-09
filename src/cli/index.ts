import { outro, note, log, spinner } from '@clack/prompts';
import {
  loadSession,
  createSession,
  clearSession,
  recordAnswer,
  recordGenerated,
  seedDetected,
  forgetAnswer,
  cleanupWorkspace,
  type Session,
} from '../state/index';
import {
  confirmResume,
  confirmBootstrapPrompt,
  confirmContinueWithoutAgent,
  confirmOverwrite,
  confirmLegacyCleanup,
  confirmStartMode,
  confirmDetectionDepth,
  summarizeDetection,
  runQuestion,
} from '../questions/runner';
import { findLegacyArtifacts, removeLegacyArtifacts } from '../generator/legacy';
import { zedShadowWarnings } from '../generator/zed';
import { detectStack } from '../detect/index';
import { scanExistingAiConfigs, detectAiTool } from '../detect/aiconfig';
import { llmDetect, willLlmDetectRun, type LlmDetection } from '../detect/llm';
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
import { checkAgentReady } from '../generator/agent';
import { getProvider } from '../providers/index';
import { hookSetupHints } from '../generator/hooks';
import { planHooks } from '../generator/hookplan';
import type { ResumeStore } from '../generator/types';
import { printBanner } from './banner';

/**
 * Clack's spinner erases the previous frame by re-wrapping the bare message, but
 * renders it with a 3-column symbol prefix and up to 3 animated dots. When that
 * extra width pushes the frame past the terminal edge while the bare message
 * still fits, it moves the cursor up 0 rows, erases only the last physical row
 * and leaves the first one on screen — once per tick, so the line stacks up for
 * the whole run. Clamp the label so a frame is never wider than one row.
 */
export function spinnerLabel(text: string, columns = process.stdout.columns ?? 80): string {
  const max = columns - 8; // symbol prefix + "..." + slack
  if (max < 8 || text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Ask the aiTool question and confirm the chosen CLI actually works — not just
 * that its binary is on PATH, but that it runs headlessly and responds — before
 * any further question is asked. On a failed check the user can continue anyway
 * (generation falls back to static templates for anything that CLI would have
 * written) or re-pick, looping until one succeeds or the risk is accepted.
 * A no-op if aiTool is already answered (resumed session).
 */
async function selectAiTool(session: Session): Promise<Session> {
  if (session.answered.includes('aiTool')) return session;
  const aiToolQ = findQuestion(flow, session.answers, 'aiTool');
  if (!aiToolQ) return session;

  // Seed the detected tool so the prompt pre-selects it; the user's pick wins.
  const detectedAiTool = detectAiTool(process.cwd());
  if (detectedAiTool) session = seedDetected(session, { aiTool: detectedAiTool });

  for (;;) {
    const value = (await runQuestion(aiToolQ, session.answers)) as string;
    const provider = getProvider(value);
    const runner = provider?.agent;
    if (!provider || !runner) return recordAnswer(session, 'aiTool', value);

    const s = spinner();
    s.start(spinnerLabel(`Checking that ${provider.displayName} responds`));
    const check = await checkAgentReady(runner);
    s.stop(
      check.ok ? `${provider.displayName} is ready` : `${provider.displayName} did not respond`,
    );
    if (check.ok) return recordAnswer(session, 'aiTool', value);

    note(
      check.reason === 'not-found'
        ? `\`${runner.binary}\` was not found on your PATH. Install it and sign in, or pick a different tool.`
        : `\`${runner.binary}\` didn't respond${check.detail ? ` (${check.detail})` : ''}. Make sure it's installed and signed in.`,
      'Agent check failed',
    );

    if (await confirmContinueWithoutAgent(provider.displayName)) {
      return recordAnswer(session, 'aiTool', value);
    }
    // Re-ask with this attempted pick still highlighted, in case the user just
    // needs to install/sign in and retry rather than pick something else.
    session = seedDetected(session, { aiTool: value });
  }
}

/**
 * Ask aiTool (with its readiness check) and report whether the session was
 * fresh *before* that happened. `selectAiTool` answers aiTool via
 * `recordAnswer`, which returns a new session rather than mutating in place —
 * a caller that instead reads freshness off the *returned* session would see
 * 'aiTool' already in `answered` and wrongly conclude the session was never
 * fresh. That was the #60 regression: existing-project detection was gated on
 * exactly that reassigned value and so never ran again. Exported so the
 * ordering can be unit-tested directly, without driving the real prompts.
 */
export async function selectAiToolTracked(
  session: Session,
  deps: { selectAiTool?: (s: Session) => Promise<Session> } = {},
): Promise<{ session: Session; isFreshSession: boolean }> {
  const isFreshSession = session.answered.length === 0;
  const select = deps.selectAiTool ?? selectAiTool;
  return { session: await select(session), isFreshSession };
}

/** Injectable seams for {@link runExistingProjectGate} — everything impure the gate calls. */
export interface ExistingProjectGateDeps {
  detectStack?: typeof detectStack;
  scanExistingAiConfigs?: typeof scanExistingAiConfigs;
  confirmStartMode?: () => Promise<'fresh' | 'existing'>;
  confirmDetectionDepth?: () => Promise<'everything' | 'partial'>;
  willLlmDetectRun?: typeof willLlmDetectRun;
  llmDetect?: typeof llmDetect;
}

/**
 * The existing-project detection gate (Gate 1 + Gate 2): on a fresh session
 * whose cwd looks like an existing project, ask whether to detect it, and if
 * so run Stage-1/Stage-2 detection and fold the results into the session. A
 * no-op — returning `session` untouched — on a resumed session or a truly
 * empty directory, which is exactly the branch #60 broke (a stale freshness
 * read made this whole gate skip on every run). Extracted out of `run()` and
 * injectable so the "does the existing-project branch actually run" contract
 * can be unit-tested without mocking any module or driving real prompts.
 */
export async function runExistingProjectGate(
  session: Session,
  isFreshSession: boolean,
  cwd: string,
  deps: ExistingProjectGateDeps = {},
): Promise<{ session: Session; startedFromExisting: boolean; autoRecommendGates: boolean }> {
  let startedFromExisting = false;
  let autoRecommendGates = false;
  if (!isFreshSession) return { session, startedFromExisting, autoRecommendGates };

  const detectStackFn = deps.detectStack ?? detectStack;
  const scanExistingAiConfigsFn = deps.scanExistingAiConfigs ?? scanExistingAiConfigs;
  const confirmStartModeFn = deps.confirmStartMode ?? confirmStartMode;
  const confirmDetectionDepthFn = deps.confirmDetectionDepth ?? confirmDetectionDepth;
  const willLlmDetectRunFn = deps.willLlmDetectRun ?? willLlmDetectRun;
  const llmDetectFn = deps.llmDetect ?? llmDetect;

  const detected = detectStackFn(cwd);
  // The existing git-hook runner and what it already covers. Recorded before
  // the start-mode gate on purpose: a repo's hooks must be respected whether
  // the user is continuing the project or starting fresh inside it. Drives the
  // hookPolicy question and, through the hook plan, what the generated
  // guidance may claim is already automated.
  if (detected.hooks) session = recordAnswer(session, 'existingHooks', detected.hooks);
  if (Object.keys(detected.answers).length === 0) {
    return { session, startedFromExisting, autoRecommendGates };
  }

  // The repo may already hold AI config — possibly for a different tool than
  // the user is about to pick. Surface it, but generically: which tool it
  // looks like is an implementation detail the user does not need named here.
  const existingAiConfigs = scanExistingAiConfigsFn(cwd);
  if (existingAiConfigs.length > 0) {
    note(existingAiConfigs.map((f) => `• ${f}`).join('\n'), 'Existing AI config detected');
  }

  // aiTool is already answered by `selectAiTool` above; runFlow's per-question
  // skip (session.answered) means it won't be asked again here.

  // Gate 1 — work with the existing project, or start fresh?
  if ((await confirmStartModeFn()) !== 'existing') {
    // Gate 1 "fresh" → seed nothing; normal flow (aiTool already answered).
    return { session, startedFromExisting, autoRecommendGates };
  }
  startedFromExisting = true;
  session = recordAnswer(session, 'startedFromExisting', true);
  // Gate 2 — detect everything (auto-fill + review) or just the stack?
  const depth = await confirmDetectionDepthFn();
  autoRecommendGates = depth === 'everything';

  // Be explicit about what "detect everything" does, so the user knows what
  // to expect: code is the source of truth, undetected topics are skipped,
  // and a few safe assistant policies are applied (and editable at review).
  if (autoRecommendGates) {
    note(
      [
        'Payo will use your code, folder structure, and git history as the source of truth.',
        'Anything it cannot find is skipped — no skill is created for it and it is not mentioned.',
        '',
        'These safe assistant policies are applied (edit any at the review screen):',
        '• No AI attribution in commits/PRs',
        '• Task-scoped, small atomic commits',
        '• Ask before pushing to a remote',
        '• Run formatter/linter/tests before pushing',
        '• Work from .env.example (never read the real .env)',
        '• DRY, modular, separation-of-concerns coding standards',
      ].join('\n'),
      'Detect everything',
    );
  }

  // Stage 2 — LLM pass over the chosen agent (additive; static-only fallback).
  const aiTool = typeof session.answers.aiTool === 'string' ? session.answers.aiTool : undefined;
  let result: LlmDetection = detected;
  // Only spin when the pass will actually run — otherwise the spinner lies
  // ("Analysis complete") on the common no-agent / nothing-to-fill path.
  if (willLlmDetectRunFn(detected, aiTool, depth)) {
    const s = spinner();
    s.start(spinnerLabel(`Analyzing your project with ${aiTool}`));
    try {
      result = await llmDetectFn(detected, aiTool, depth, cwd);
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
    // Git conventions are inferred deterministically from local history; seed
    // them so the interview pre-selects the detected value (still asked in
    // partial mode, where the rest of Tier-2 is left entirely to the user).
    for (const [id, value] of Object.entries(tier2)) {
      if (result.sources[id] === 'git') session = seedDetected(session, { [id]: value });
    }
  }

  // Carry per-package stacks (monorepo) to the generator as derived data.
  // Not a Question, so it never surfaces as an editable review line.
  if (result.packages && result.packages.length > 0) {
    session = recordAnswer(session, 'monorepoPackages', result.packages);
  }
  // Same for the extra languages of a hybrid repo (React app + Rust
  // backend): the interview covers the primary stack only, but the
  // generated docs must not pretend the other stacks don't exist.
  if (result.secondary && result.secondary.length > 0) {
    session = recordAnswer(session, 'secondaryLanguages', result.secondary);
  }

  // Stage-2 conflicts: the agent found evidence contradicting a Stage-1
  // answer. Never silently overridden — in partial mode the answer is
  // demoted from recorded to seeded (the interview re-asks it with the
  // suggestion pre-selected); in "everything" mode the Stage-1 value
  // stays and the note points the user at the review screen.
  const conflicts = 'conflicts' in result ? (result.conflicts ?? []) : [];
  if (conflicts.length > 0) {
    note(
      conflicts
        .map(
          (c) =>
            `• ${c.id}: detected "${String(result.answers[c.id])}", project evidence suggests "${c.suggested}"${c.evidence ? ` — ${c.evidence}` : ''}`,
        )
        .join('\n'),
      'Detection conflicts — confirm at review',
    );
    if (depth !== 'everything') {
      for (const c of conflicts) {
        session = forgetAnswer(session, c.id);
        session = seedDetected(session, { [c.id]: c.suggested });
      }
    }
  }

  // Detectors seed facts independent of project shape (e.g. a styling lib
  // on a backend project). Drop any recorded answer whose question is
  // unreachable under the detected answers, so orphaned facts don't leak
  // into generation or show a phantom line in the review screen. Seeded
  // Tier-2 hints live in `answers` only (not `answered`) and are untouched.
  session = reconcile(flow, session);

  return { session, startedFromExisting, autoRecommendGates };
}

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

  // aiTool is always the first question, checked for real readiness (PATH +
  // a headless hello smoke test) before anything else is asked.
  const selected = await selectAiToolTracked(session);
  session = selected.session;
  const isFreshSession = selected.isFreshSession;

  // --- Auto-detect existing stack (fresh sessions only; resume keeps answers) ---
  const gate = await runExistingProjectGate(session, isFreshSession, process.cwd());
  session = gate.session;
  // Whether the user chose to work with an already-existing project (Gate 1).
  // Bootstrap-prompt generation only makes sense when scaffolding a new project,
  // so it is suppressed on this path.
  const startedFromExisting = gate.startedFromExisting;
  // Set when the user picks "detect everything": the questionnaire then auto-fills
  // every convention/preference gate with recommended defaults instead of asking,
  // deferring all confirmation to the review screen.
  const autoRecommendGates = gate.autoRecommendGates;

  // --- Dynamic questionnaire ---
  session = await runFlow(flow, session, { autoRecommendGates });

  // --- Review answers before generating (with inline edit) ---
  session = await reviewAndEdit(flow, session);

  // Mark the detect-everything path so the generator treats the existing code as
  // the source of truth — documenting the conventions actually present instead of
  // prescribing defaults. Recorded after the last reconcile (in reviewAndEdit) so
  // it survives to generation; not a Question, so it never showed in the review.
  if (autoRecommendGates) session = recordAnswer(session, 'detectEverything', true);

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
      onSkillRetry: (title, attempt, reason) =>
        log.warn(`${title} failed (attempt ${attempt})${reason ? `: ${reason}` : ''}; retrying…`),
      onSkillResult: (title, ok, reason) => {
        if (!ok)
          log.warn(
            `${title} failed${reason ? `: ${reason}` : ''} (will fall back to templates if all fail).`,
          );
      },
    },
    resume,
  );
  if (result.mode === 'ai') {
    const lines = result.files.map((f) => `• ${f}`);
    if (result.failureDetails?.length) {
      lines.push('Failed:');
      for (const f of result.failureDetails) {
        lines.push(`  ✗ ${f.title}${f.reason ? ` — ${f.reason}` : ''}`);
      }
    } else if (result.failures?.length) {
      lines.push(`(failed: ${result.failures.join(', ')})`);
    }
    note(lines.join('\n'), `Generated via ${result.providerName} (AI) in ${process.cwd()}`);
  } else {
    note(
      result.files.map((f) => `• ${f}`).join('\n'),
      `Generated via ${result.providerName} (static) in ${process.cwd()}`,
    );
  }

  // What the hook layer still needs from the user: the one-time commands to
  // activate anything written, and an honest note about any check the user's
  // "leave my hooks alone" choice means nothing will run.
  // The plan the run acted on, not a fresh one: a config Payo just wrote would
  // now be detected as a pre-existing runner, hiding the activation commands.
  const plan = result.hookPlan ?? planHooks(session.answers);
  const hookHints = hookSetupHints(result.files, session.answers, plan);
  if (hookHints.length > 0) {
    note(hookHints.map((h) => `• ${h}`).join('\n'), 'Git hooks');
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

  // Zed reads only the FIRST instruction file it finds, and AGENTS.md is 7th of
  // nine — so a higher-priority file shadows everything Payo just generated.
  // Deliberately after the cleanup above: three of the six shadowing files are
  // legacy artifacts, and warning about a file Payo has just deleted is noise.
  const supportTools = session.answers.supportTools;
  const zedWarnings = zedShadowWarnings(
    Array.isArray(supportTools)
      ? supportTools.filter((t): t is string => typeof t === 'string')
      : undefined,
  );
  if (zedWarnings.length > 0) {
    note(zedWarnings.map((w) => `• ${w}`).join('\n'), 'Zed');
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
      spin.start(spinnerLabel(`Generating bootstrap prompt with ${name}`));
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
