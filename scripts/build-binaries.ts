#!/usr/bin/env bun
/**
 * Cross-compiles the standalone payo binaries and packages them for release.
 *
 * Bun compiles every target from any host, so CI does this in a single Linux
 * job — no build matrix. Output lands in release/ as one archive per target
 * plus a SHA256SUMS the install scripts verify against.
 *
 *   bun run build:binaries              # all targets
 *   bun run build:binaries darwin-arm64 # one target, for local iteration
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

interface Target {
  /** Suffix in the asset name: payo-<name>.tar.gz */
  name: string;
  /** Value passed to `bun build --target`. */
  bunTarget: string;
  windows?: boolean;
}

/**
 * Each target has to earn its place — every one is ~40 MB on every release.
 * musl (Alpine) is deliberately absent: it is a rare host for an interactive
 * scaffolder, and install.sh detects it and points those users at npx.
 */
const TARGETS: Target[] = [
  { name: 'darwin-arm64', bunTarget: 'bun-darwin-arm64' },
  { name: 'darwin-x64', bunTarget: 'bun-darwin-x64' },
  { name: 'linux-x64', bunTarget: 'bun-linux-x64' },
  { name: 'linux-arm64', bunTarget: 'bun-linux-arm64' },
  { name: 'windows-x64', bunTarget: 'bun-windows-x64', windows: true },
];

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
const releaseDir = path.join(root, 'release');

function run(cmd: string, args: string[], cwd = root): void {
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited with ${String(res.status)}`);
  }
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function humanSize(file: string): string {
  const bytes = readFileSync(file).length;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Compile one target and archive it with the binary at the archive root. */
function buildTarget(target: Target): string {
  const outDir = path.join(buildDir, target.name);
  const binName = target.windows ? 'payo.exe' : 'payo';
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // eslint-disable-next-line no-console
  console.log(`\n▸ ${target.name} (${target.bunTarget})`);
  run('bun', [
    'build',
    'src/index.ts',
    '--compile',
    '--minify',
    '--sourcemap=none',
    '--target',
    target.bunTarget,
    '--outfile',
    path.join(outDir, binName),
  ]);

  const archive = target.windows
    ? path.join(releaseDir, `payo-${target.name}.zip`)
    : path.join(releaseDir, `payo-${target.name}.tar.gz`);
  rmSync(archive, { force: true });

  if (target.windows) {
    // -j so the archive holds payo.exe at the root, not build/<target>/payo.exe.
    run('zip', ['-qj', archive, path.join(outDir, binName)]);
  } else {
    run('tar', ['-czf', archive, '-C', outDir, binName]);
  }

  // eslint-disable-next-line no-console
  console.log(`  ${path.basename(archive)} — ${humanSize(archive)}`);
  return archive;
}

function main(): void {
  const requested = process.argv.slice(2);
  const targets = requested.length
    ? TARGETS.filter((t) => requested.includes(t.name))
    : TARGETS;

  if (!targets.length) {
    throw new Error(
      `no matching target. Known: ${TARGETS.map((t) => t.name).join(', ')}`
    );
  }
  if (!existsSync(path.join(root, 'src', 'cli', 'logo.data.ts'))) {
    throw new Error('src/cli/logo.data.ts missing — run `bun run embed:assets`');
  }

  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });

  const archives = targets.map(buildTarget);

  // One SHA256SUMS for the whole release, in the format sha256sum -c expects.
  const sums = archives
    .map((a) => `${sha256(a)}  ${path.basename(a)}`)
    .join('\n');
  writeFileSync(path.join(releaseDir, 'SHA256SUMS'), `${sums}\n`);

  // eslint-disable-next-line no-console
  console.log(`\n✓ ${archives.length} archive(s) + SHA256SUMS in release/`);
}

main();
