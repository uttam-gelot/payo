/**
 * Startup banner: shows the payo logo plus a short orientation note, once when
 * the CLI launches before the questionnaire begins.
 *
 * The logo is rendered as a real inline image when the terminal supports a
 * graphics protocol (iTerm2 / WezTerm / VS Code / Kitty / Ghostty), and falls
 * back to pre-rendered terminal art (chafa block symbols) everywhere else.
 * Dependency-free.
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { note } from '@clack/prompts';

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;

/** Width the inline logo occupies, in terminal cells. */
const LOGO_COLS = 16;

/**
 * Resolve an asset file. Built (dist/index.js) and dev (src/cli/banner.ts) sit
 * at different depths, so try the candidates and return the first that exists,
 * falling back to the built layout.
 */
function assetPath(file: string): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, '..', 'assets', file), // dist/index.js
    path.join(here, '..', '..', 'assets', file), // src/cli/banner.ts
  ];
  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

/** Which inline-image protocol the current terminal speaks, if any. */
type ImageProtocol = 'iterm' | 'kitty' | null;

function detectImageProtocol(): ImageProtocol {
  const term = process.env.TERM ?? '';
  const prog = process.env.TERM_PROGRAM ?? '';

  // Kitty graphics protocol: kitty itself and Ghostty.
  if (term === 'xterm-kitty' || process.env.KITTY_WINDOW_ID || prog === 'ghostty') {
    return 'kitty';
  }
  // iTerm2 inline-image protocol: iTerm2, WezTerm, VS Code, Konsole, Tabby.
  if (
    prog === 'iTerm.app' ||
    prog === 'WezTerm' ||
    prog === 'vscode' ||
    prog === 'Tabby' ||
    process.env.LC_TERMINAL === 'iTerm2' ||
    process.env.KONSOLE_VERSION
  ) {
    return 'iterm';
  }
  return null;
}

/** Encode the logo for iTerm2's OSC 1337 inline-image protocol. */
function itermImage(png: Buffer): string {
  const b64 = png.toString('base64');
  const args = `inline=1;width=${LOGO_COLS};preserveAspectRatio=1;size=${png.length}`;
  return `\x1b]1337;File=${args}:${b64}\x07`;
}

/**
 * Encode the logo for the Kitty graphics protocol. The payload is transmitted
 * and displayed (a=T) as a PNG (f=100), scaled to LOGO_COLS columns, in 4096-byte
 * base64 chunks. Trailing newlines move the cursor below the image.
 */
function kittyImage(png: Buffer): string {
  const b64 = png.toString('base64');
  const chunkSize = 4096;
  const chunks: string[] = [];
  for (let i = 0; i < b64.length; i += chunkSize) {
    chunks.push(b64.slice(i, i + chunkSize));
  }
  // Rows to reserve below: cols * aspect / cell-aspect(~2). Conservative guess.
  const rows = Math.max(1, Math.round(LOGO_COLS * 1.4 * 0.5));
  let out = '';
  chunks.forEach((chunk, i) => {
    const more = i < chunks.length - 1 ? 1 : 0;
    const control = i === 0 ? `a=T,f=100,c=${LOGO_COLS},r=${rows},m=${more}` : `m=${more}`;
    out += `\x1b_G${control};${chunk}\x1b\\`;
  });
  return out + '\n'.repeat(rows);
}

/** Render the logo as a real inline image, or null if unsupported / missing. */
function imageLogo(): string | null {
  const proto = detectImageProtocol();
  if (!proto) return null;
  try {
    const png = readFileSync(assetPath('logo.inline.png'));
    return proto === 'kitty' ? kittyImage(png) : itermImage(png);
  } catch {
    return null;
  }
}

/**
 * Pre-rendered terminal art of the logo (truecolor block symbols, generated
 * from logo.png via chafa). Returns null if the asset is missing.
 */
function asciiLogo(): string | null {
  try {
    return readFileSync(assetPath('logo.ans'), 'utf8');
  } catch {
    return null;
  }
}

/** One-line summary plus the controls the user can rely on during a run. */
const DESCRIPTION = [
  'payo generates AI coding rules & skills tailored to your stack.',
  '',
  'Answer a few questions and payo writes the config for your AI tool.',
  '',
  'Controls:',
  '  • Press Ctrl+C any time to stop — your answers are saved.',
  '  • Re-run payo to resume exactly where you left off.',
].join('\n');

/** Print the logo and orientation note. Call once at CLI startup. */
export function printBanner(): void {
  if (useColor) {
    const art = imageLogo() ?? asciiLogo();
    // eslint-disable-next-line no-console
    if (art) console.log(`\n${art}`);
  }
  note(DESCRIPTION, 'Welcome to payo');
}
