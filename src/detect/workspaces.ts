/**
 * Workspace-member enumeration for monorepos. Returns the project-relative
 * directories that hold their own manifest, so `detectStack` can detect each
 * package's stack instead of collapsing the whole repo to one root ecosystem.
 *
 * Deliberately minimal parsing (line/regex scans, no YAML/TOML/XML parser),
 * matching manifest.ts — we only need member *paths*. Coverage is Node, Rust,
 * Go, and JVM (Maven/Gradle); Python/PHP/.NET/Ruby workspaces are a future
 * extension (see EXTRA_MEMBER_SOURCES note below).
 */
import fs from 'fs';
import path from 'path';
import { exists, readJson, readText } from './manifest';

/** Cap the member count so a pathological repo can't blow up detection. */
const MAX_MEMBERS = 50;

/** Directories never worth descending into when resolving a `dir/*` glob. */
const IGNORE = new Set([
  'node_modules',
  '.git',
  '.payo',
  'dist',
  'build',
  'target',
  'out',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
]);

/** A directory is a workspace member when it declares one of these manifests. */
const MEMBER_MANIFESTS = [
  'package.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
];

/** True when `dir` (absolute) holds any manifest — i.e. is a real package root. */
function hasManifest(dir: string): boolean {
  return MEMBER_MANIFESTS.some((f) => exists(dir, f)) || hasCsproj(dir);
}

/** A .NET project has no fixed-name manifest — any *.csproj marks the package. */
function hasCsproj(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some((f) => f.endsWith('.csproj'));
  } catch {
    return false;
  }
}

/**
 * Resolve one workspace glob to project-relative member dirs. Supports the two
 * shapes real manifests use: a literal path (`packages/core`) and a single
 * trailing wildcard (`packages/*`). Deeper globs (`packages/**`) are treated as
 * their `packages/*` prefix — good enough to find the immediate package roots.
 */
function resolveGlob(cwd: string, raw: string): string[] {
  const glob = raw.replace(/\/+$/, '');
  const star = glob.indexOf('*');
  if (star === -1) {
    const abs = path.join(cwd, glob);
    return hasManifest(abs) ? [glob] : [];
  }
  // Everything before the wildcard segment is a concrete parent directory.
  const parent = glob.slice(0, star).replace(/\/+$/, '');
  const parentAbs = path.join(cwd, parent);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(parentAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || IGNORE.has(e.name)) continue;
    const rel = parent ? `${parent}/${e.name}` : e.name;
    if (hasManifest(path.join(cwd, rel))) out.push(rel);
  }
  return out;
}

// --- Per-ecosystem member-glob extractors ----------------------------------

/** pnpm-workspace.yaml `packages:` list — a simple block scan (no YAML parser). */
function pnpmGlobs(cwd: string): string[] {
  const body = readText(cwd, 'pnpm-workspace.yaml') ?? readText(cwd, 'pnpm-workspace.yml');
  if (body === undefined) return [];
  const globs: string[] = [];
  let inPackages = false;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (/^packages\s*:/.test(line)) {
      inPackages = true;
      continue;
    }
    // A new top-level key ends the packages block.
    if (inPackages && /^\S/.test(line) && !line.trimStart().startsWith('-')) break;
    const m = inPackages ? line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*$/) : null;
    if (m) globs.push(m[1].trim());
  }
  return globs;
}

/** package.json `workspaces` — array form or `{ packages: [...] }` object form. */
function pkgJsonGlobs(cwd: string): string[] {
  const pkg = readJson(cwd, 'package.json');
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) return ws.filter((g): g is string => typeof g === 'string');
  if (ws && typeof ws === 'object') {
    const pkgs = (ws as Record<string, unknown>).packages;
    if (Array.isArray(pkgs)) return pkgs.filter((g): g is string => typeof g === 'string');
  }
  return [];
}

/** lerna.json `packages` field (defaults to `packages/*` when a lerna.json exists). */
function lernaGlobs(cwd: string): string[] {
  if (!exists(cwd, 'lerna.json')) return [];
  const cfg = readJson(cwd, 'lerna.json');
  const pkgs = cfg?.packages;
  if (Array.isArray(pkgs)) return pkgs.filter((g): g is string => typeof g === 'string');
  return ['packages/*'];
}

/** Cargo.toml `[workspace] members = [...]` (inline or multi-line array). */
function cargoMembers(cwd: string): string[] {
  const body = readText(cwd, 'Cargo.toml');
  if (body === undefined || !/\[workspace\]/.test(body)) return [];
  const m = body.match(/members\s*=\s*\[([^\]]*)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

/** go.work `use` directives — single `use ./x` lines and grouped `use ( ... )`. */
function goWorkMembers(cwd: string): string[] {
  const body = readText(cwd, 'go.work');
  if (body === undefined) return [];
  const out: string[] = [];
  let inBlock = false;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('use (')) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ')') {
      inBlock = false;
      continue;
    }
    const spec = inBlock ? line : line.startsWith('use ') ? line.slice(4).trim() : undefined;
    if (spec) out.push(spec.replace(/^\.\//, ''));
  }
  return out;
}

/** Maven root `pom.xml` `<modules><module>x</module></modules>`. */
function mavenModules(cwd: string): string[] {
  const body = readText(cwd, 'pom.xml');
  if (body === undefined) return [];
  return [...body.matchAll(/<module>\s*([^<\s]+)\s*<\/module>/gi)].map((m) => m[1]);
}

/** Gradle `settings.gradle(.kts)` `include ':a', ':b:c'` → dir paths. */
function gradleModules(cwd: string): string[] {
  const body = readText(cwd, 'settings.gradle') ?? readText(cwd, 'settings.gradle.kts');
  if (body === undefined) return [];
  const out: string[] = [];
  for (const m of body.matchAll(/include\s*[(]?\s*([^)\n]+)/g)) {
    for (const q of m[1].matchAll(/["']:?([^"']+)["']/g)) {
      // Gradle uses ':' as a path separator (':app:api' → 'app/api').
      out.push(q[1].replace(/:/g, '/'));
    }
  }
  return out;
}

/**
 * All workspace-member directories declared at `cwd`, project-relative and
 * de-duplicated, or `[]` when the repo is not a monorepo. Members are only
 * included when they actually hold a manifest, so stray glob matches are dropped.
 */
export function enumerateWorkspaces(cwd: string): string[] {
  const globs = [
    ...pnpmGlobs(cwd),
    ...pkgJsonGlobs(cwd),
    ...lernaGlobs(cwd),
    ...cargoMembers(cwd),
    ...goWorkMembers(cwd),
    ...mavenModules(cwd),
    ...gradleModules(cwd),
  ];

  const seen = new Set<string>();
  const members: string[] = [];
  for (const glob of globs) {
    for (const rel of resolveGlob(cwd, glob)) {
      const norm = rel.replace(/^\.\//, '');
      if (norm === '' || norm === '.' || seen.has(norm)) continue;
      seen.add(norm);
      members.push(norm);
      if (members.length >= MAX_MEMBERS) return members;
    }
  }
  return members;
}
