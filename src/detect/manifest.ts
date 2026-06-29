/**
 * Low-level manifest readers. Each returns the set of declared dependency
 * names (and a few structural flags) without interpreting them — the
 * per-ecosystem detectors map those names to answer values via signals.ts.
 *
 * Parsing is deliberately minimal (we only need dependency *names*, never
 * versions or nested tables), so we scan rather than pull in a TOML parser.
 */
import fs from 'fs';
import path from 'path';

export const exists = (dir: string, file: string): boolean => fs.existsSync(path.join(dir, file));

/** Read + JSON-parse a file, or undefined if missing / unparseable. */
export function readJson(dir: string, file: string): Record<string, unknown> | undefined {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8')) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read + parse a JSONC file (tsconfig.json routinely has `//` / block comments
 * and trailing commas, which JSON.parse rejects). Strips both before parsing;
 * returns undefined when missing or still unparseable.
 */
export function readJsonc(dir: string, file: string): Record<string, unknown> | undefined {
  const raw = readText(dir, file);
  if (raw === undefined) return undefined;
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1') // line comments (leave `://` in strings mostly intact)
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas
  try {
    const parsed = JSON.parse(stripped) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Read a UTF-8 file, or undefined if missing / unreadable. */
export function readText(dir: string, file: string): string | undefined {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) return undefined;
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return undefined;
  }
}

/** All dependency names declared across package.json's dep maps. */
export function packageJsonDeps(pkg: Record<string, unknown>): Set<string> {
  const deps = new Set<string>();
  for (const key of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const map = pkg[key];
    if (map && typeof map === 'object') {
      for (const name of Object.keys(map)) deps.add(name);
    }
  }
  return deps;
}

/**
 * Distribution names from a PEP 508 dependency line, lower-cased. Strips the
 * version/marker tail and any `[extras]`, so `Django>=5.0`, `fastapi[all]`, and
 * `psycopg2-binary==2.9 ; sys_platform=='linux'` yield `django`, `fastapi`,
 * `psycopg2-binary`.
 */
function pep508Name(line: string): string | undefined {
  const cleaned = line.trim().replace(/^["']|["'],?$/g, '');
  const m = cleaned.match(/^([A-Za-z0-9._-]+)/);
  return m ? m[1].toLowerCase() : undefined;
}

/** Dependency names from a requirements.txt body. */
export function requirementsDeps(body: string): Set<string> {
  const deps = new Set<string>();
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    const name = pep508Name(line);
    if (name) deps.add(name);
  }
  return deps;
}

/**
 * Dependency names from pyproject.toml — covers PEP 621 `[project] dependencies`
 * (array of PEP 508 strings) and Poetry's `[tool.poetry.dependencies]` table
 * (key = name). Section-scoped line scan; good enough for names only.
 */
export function pyprojectDeps(body: string): Set<string> {
  const deps = new Set<string>();
  const lines = body.split('\n');
  let mode: 'none' | 'pep621-array' | 'poetry-table' = 'none';

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      if (
        line === '[tool.poetry.dependencies]' ||
        line === '[tool.poetry.group.dev.dependencies]'
      ) {
        mode = 'poetry-table';
      } else {
        mode = 'none';
      }
      continue;
    }
    // PEP 621: dependencies = [ "a", "b" ] (may span lines)
    if (/^dependencies\s*=/.test(line) || /^optional-dependencies/.test(line)) {
      mode = 'pep621-array';
      // names on the same line, if any
      for (const m of line.matchAll(/["']([A-Za-z0-9._-]+[^"']*)["']/g)) {
        const name = pep508Name(m[1]);
        if (name) deps.add(name);
      }
      if (line.includes(']')) mode = 'none';
      continue;
    }

    if (mode === 'pep621-array') {
      if (line.includes(']')) {
        mode = 'none';
      }
      const m = line.match(/["']([^"']+)["']/);
      if (m) {
        const name = pep508Name(m[1]);
        if (name) deps.add(name);
      }
      continue;
    }

    if (mode === 'poetry-table') {
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Za-z0-9._-]+)\s*=/);
      if (m && m[1].toLowerCase() !== 'python') deps.add(m[1].toLowerCase());
    }
  }
  return deps;
}

/**
 * Module paths from a go.mod `require` block (single-line or grouped). Trims the
 * version, so `github.com/gin-gonic/gin v1.9.1` → `github.com/gin-gonic/gin`.
 * Returned as a prefix-matchable list (callers match by path prefix).
 */
export function goModRequires(body: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').trim();
    if (!line) continue;
    if (line.startsWith('require (')) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ')') {
      inBlock = false;
      continue;
    }
    let spec = line;
    if (line.startsWith('require ')) spec = line.slice('require '.length).trim();
    else if (!inBlock) continue;
    const mod = spec.split(/\s+/)[0];
    if (mod) out.push(mod);
  }
  return out;
}

/** Crate names from a Cargo.toml `[dependencies]` / `[dev-dependencies]` table. */
export function cargoDeps(body: string): Set<string> {
  const deps = new Set<string>();
  let inDeps = false;
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      inDeps =
        line === '[dependencies]' ||
        line === '[dev-dependencies]' ||
        line === '[build-dependencies]';
      continue;
    }
    if (!inDeps || !line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9._-]+)\s*=/);
    if (m) deps.add(m[1]);
  }
  return deps;
}
