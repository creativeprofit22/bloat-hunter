import { normalize } from 'path';

/**
 * Tracks paths returned by scanners so IPC handlers can validate
 * that clean/preview requests only target known scan results —
 * not arbitrary paths injected by a compromised renderer.
 */
const knownPaths = new Set<string>();

function normalizeKey(filePath: string): string {
  return normalize(filePath).toLowerCase();
}

/** Register paths from scan results so they can be validated later. */
export function registerScanResults(results: { path: string }[]): void {
  for (const r of results) {
    knownPaths.add(normalizeKey(r.path));
  }
}

/** Check whether a path was returned by a prior scan. */
export function isKnownScanResult(filePath: string): boolean {
  return knownPaths.has(normalizeKey(filePath));
}

/** Clear all registered paths. Called on app restart (naturally) or if needed. */
export function clearScanResults(): void {
  knownPaths.clear();
}
