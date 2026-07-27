#!/usr/bin/env bun
/**
 * Generates src/cli/logo.data.ts from the logo assets.
 *
 * The banner used to read these files off disk relative to import.meta.url,
 * which works for `bun run src/` and for dist/index.js next to assets/, but
 * breaks under `bun build --compile` where import.meta.url points into the
 * embedded /$bunfs/ VFS. Baking the bytes into the source removes the only
 * filesystem dependency the CLI had, so one bundle works everywhere.
 *
 * The output is committed. Re-run this (`bun run embed:assets`) whenever the
 * assets change; CI fails if the committed file has drifted.
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'cli', 'logo.data.ts');

const ans = readFileSync(path.join(root, 'assets', 'logo.ans'), 'utf8');
const png = readFileSync(path.join(root, 'assets', 'logo.inline.png'));

/** Escape for a single-quoted TS string literal. */
function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\x1b/g, '\\x1b')}'`;
}

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Run \`bun run embed:assets\` to regenerate from assets/.
 *
 * Holds the startup logo inline so the CLI needs no files on disk at runtime,
 * which is what lets \`bun build --compile\` produce a standalone binary.
 */`;

const source = `${banner}

/** Pre-rendered terminal art of the logo (chafa truecolor block symbols). */
export const LOGO_ANS = ${quote(ans)};

/** The inline logo PNG, base64-encoded, for the iTerm2/kitty image protocols. */
export const LOGO_PNG_BASE64 =
  ${quote(png.toString('base64'))};

/** Byte length of the decoded PNG — iTerm2's OSC 1337 header requires it. */
export const LOGO_PNG_BYTES = ${png.length};
`;

writeFileSync(out, source);
// eslint-disable-next-line no-console
console.log(
  `wrote ${path.relative(root, out)} (ans ${ans.length} chars, png ${png.length} bytes)`
);
