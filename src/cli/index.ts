import { outro, note, log } from '@clack/prompts';
import {
  loadSession,
  createSession,
  clearSession,
  recordGenerated,
  cleanupWorkspace,
  type Session,
} from '../state/index';
import { confirmResume, confirmBootstrapPrompt } from '../questions/runner';
import { runFlow } from '../questions/engine';
import { flow } from '../questions/flow';
import { generate } from '../generator/index';
import { writeBootstrapPrompt } from '../generator/bootstrap';
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

  // --- Dynamic questionnaire ---
  session = await runFlow(flow, session);

  // --- Generate provider artifact(s) ---
  // Resume: skip skills a prior interrupted run already finished. The working
  // dir is removed once we reach the end of run(), so only a killed run (which
  // exits before cleanup) carries progress over.
  const resumeCount = session.generated.length;
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
  // Generation finished — remove the working dir (.payo/) and its session.
  cleanupWorkspace();

  // Offer a paste-ready prompt to scaffold a working project from the new skills.
  if (await confirmBootstrapPrompt()) {
    const rel = writeBootstrapPrompt(session.answers, result.files, result.providerName);
    note(
      `Saved to ${rel}\nPaste its contents into any LLM to scaffold the project.`,
      'Bootstrap prompt',
    );
  }

  outro('✅ Config generated!');
}
