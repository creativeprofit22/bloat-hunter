import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { ScanRule, RulePath } from './types';

/** A single match produced by the rule engine. */
interface RuleMatch {
  path: string;
  size: number;
  modified: number;
  isDirectory: boolean;
}

/**
 * Resolve Windows environment variables in a path string.
 * Converts `%TEMP%`, `%WINDIR%`, etc. to their actual values.
 * Returns null if any variable cannot be resolved.
 */
export function resolveEnvVars(pathStr: string): string | null {
  let hasUnresolved = false;

  const resolved = pathStr.replace(/%([^%]+)%/g, (match, varName: string) => {
    const value = process.env[varName];
    if (value === undefined) {
      hasUnresolved = true;
      return match;
    }
    return value;
  });

  return hasUnresolved ? null : resolved;
}

/**
 * Test whether a filename matches a simple glob pattern.
 * Supports `*` (any chars) and `?` (single char). Case-insensitive.
 */
export function matchesPattern(filename: string, pattern: string): boolean {
  if (pattern === '*') return true;

  // Escape regex special chars except * and ? (which are glob wildcards)
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`, 'i').test(filename);
}

/**
 * Calculate the total size of a directory by recursively summing file sizes.
 * Respects cancellation to avoid blocking during large directory walks.
 */
export async function calculateDirSize(
  dirPath: string,
  cancelled?: () => boolean,
  maxDepth = 20,
  depth = 0,
): Promise<number> {
  if (cancelled?.()) return 0;
  if (depth > maxDepth) return 0;

  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let total = 0;
  for (const entry of entries) {
    if (cancelled?.()) return total;

    const fullPath = join(dirPath, entry.name);
    try {
      if (entry.isFile()) {
        const s = await stat(fullPath);
        total += s.size;
      } else if (entry.isDirectory()) {
        total += await calculateDirSize(fullPath, cancelled, maxDepth, depth + 1);
      }
    } catch {
      continue;
    }
  }

  return total;
}

/**
 * Execute all paths in a rule and yield matching entries.
 */
export async function* executeRule(
  rule: ScanRule,
  cancelled: () => boolean,
): AsyncGenerator<RuleMatch> {
  for (const rulePath of rule.paths) {
    if (cancelled()) return;
    yield* executeRulePath(rulePath, cancelled);
  }
}

/**
 * Execute a single rule path: resolve env vars, walk the directory,
 * and yield matching files/dirs.
 */
async function* executeRulePath(
  rulePath: RulePath,
  cancelled: () => boolean,
): AsyncGenerator<RuleMatch> {
  const resolvedBase = resolveEnvVars(rulePath.path);
  if (!resolvedBase) return;

  // Verify base path exists
  try {
    await stat(resolvedBase);
  } catch {
    return;
  }

  yield* walkAndMatch(resolvedBase, rulePath, 0, cancelled);
}

/**
 * Recursively walk a directory and yield entries matching the rule path criteria.
 *
 * When a directory matches and search includes dirs, it is yielded as a single
 * item (with calculated total size) and NOT recursed into — this prevents
 * double-counting.
 */
async function* walkAndMatch(
  dir: string,
  rulePath: RulePath,
  depth: number,
  cancelled: () => boolean,
): AsyncGenerator<RuleMatch> {
  if (cancelled()) return;

  const maxDepth = rulePath.maxDepth ?? (rulePath.recursive ? 10 : 0);
  if (depth > maxDepth) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (cancelled()) return;

    const fullPath = join(dir, entry.name);
    const matches = matchesPattern(entry.name, rulePath.pattern);

    try {
      if (entry.isFile()) {
        if (matches && rulePath.search !== 'dirs') {
          const s = await stat(fullPath);
          yield { path: fullPath, size: s.size, modified: s.mtimeMs, isDirectory: false };
        }
      } else if (entry.isDirectory()) {
        const yieldDir = matches && rulePath.search !== 'files';

        if (yieldDir) {
          // Yield matched directory as a whole with its total size
          const dirSize = await calculateDirSize(fullPath, cancelled);
          yield { path: fullPath, size: dirSize, modified: 0, isDirectory: true };
          // Don't recurse into yielded directories to avoid double-counting
        } else if (rulePath.recursive && depth < maxDepth) {
          yield* walkAndMatch(fullPath, rulePath, depth + 1, cancelled);
        }
      }
    } catch {
      continue;
    }
  }
}
