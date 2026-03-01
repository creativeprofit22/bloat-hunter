import { randomUUID } from 'crypto';
import { stat } from 'fs/promises';
import { basename, extname } from 'path';
import { BaseScanner } from '../base-scanner';
import type { ScannerConfig, ScanResult, RiskLevel } from '../types';

/** Age brackets for grouping stale files. */
type AgeBracket = '6-12 months' | '1-2 years' | '2+ years';

/** Extensions that should never be flagged as stale (system/config files). */
const EXCLUDED_EXTENSIONS = new Set([
  '.sys',
  '.dll',
  '.exe',
  '.drv',
  '.ini',
  '.inf',
  '.dat',
  '.reg',
  '.msi',
  '.cat',
  '.mum',
  '.manifest',
]);

/** Directory names to skip entirely (system-critical or version-controlled). */
const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'windows',
  'system32',
  'syswow64',
  'winsxs',
  'assembly',
  'program files',
  'program files (x86)',
  '$recycle.bin',
  'system volume information',
]);

/**
 * Stale Files Scanner — walks user directories and finds files not
 * accessed or modified in N months (configurable, default 6).
 *
 * Groups results by age bracket:
 * - 6-12 months: yellow risk (review first)
 * - 1-2 years: yellow risk
 * - 2+ years: green risk (very likely safe to remove)
 *
 * Excludes system files and known-important extensions.
 */
export class StaleFilesScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('stale-files', config);
  }

  async scan(): Promise<ScanResult[]> {
    const staleMonths = this.config.staleMonths ?? 6;
    const cutoffMs = Date.now() - staleMonths * 30 * 24 * 60 * 60 * 1000;
    const results: ScanResult[] = [];
    let totalBytes = 0;
    let filesScanned = 0;

    this.updateProgress({ phase: 'Scanning for stale files', percent: 0 });

    for (let dirIdx = 0; dirIdx < this.config.paths.length; dirIdx++) {
      if (this.cancelled) break;

      const dir = this.config.paths[dirIdx];

      this.updateProgress({
        percent: Math.round((dirIdx / this.config.paths.length) * 90),
        phase: `Scanning ${dir}`,
      });

      for await (const entry of this.walkFiles(dir)) {
        if (this.cancelled) break;
        if (entry.isDirectory) continue;

        filesScanned++;

        // Skip excluded extensions
        const ext = extname(entry.path).toLowerCase();
        if (EXCLUDED_EXTENSIONS.has(ext)) continue;

        // Skip system directories (check each path component)
        if (this.isExcludedPath(entry.path)) continue;

        // Check if file is stale (modified before cutoff)
        if (entry.modified >= cutoffMs) continue;

        // Also check atime if available
        let accessTime = entry.modified;
        try {
          const s = await stat(entry.path);
          accessTime = s.atimeMs;
        } catch {
          // Use modified time as fallback
        }

        // File must have both modified AND accessed before cutoff
        if (accessTime >= cutoffMs) continue;

        const bracket = this.getAgeBracket(entry.modified);
        totalBytes += entry.size;

        results.push({
          id: randomUUID(),
          scannerType: 'stale-files',
          path: entry.path,
          size: entry.size,
          modified: entry.modified,
          risk: this.bracketRisk(bracket),
          category: `Stale Files (${bracket})`,
          description: `${basename(entry.path)} — not modified or accessed in ${bracket}`,
        });

        // Progress update every 500 files
        if (filesScanned % 500 === 0) {
          this.updateProgress({
            currentPath: entry.path,
            itemsFound: results.length,
            bytesFound: totalBytes,
          });
        }
      }
    }

    this.updateProgress({
      percent: 100,
      phase: 'Complete',
      itemsFound: results.length,
      bytesFound: totalBytes,
    });

    return results;
  }

  /** Check if a file path contains an excluded directory. */
  private isExcludedPath(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    for (const excluded of EXCLUDED_DIR_NAMES) {
      if (lowerPath.includes(`\\${excluded}\\`) || lowerPath.includes(`/${excluded}/`)) {
        return true;
      }
    }
    return false;
  }

  /** Determine the age bracket based on modified time. */
  private getAgeBracket(modifiedMs: number): AgeBracket {
    const ageMs = Date.now() - modifiedMs;
    const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

    if (ageMs >= 2 * YEAR_MS) return '2+ years';
    if (ageMs >= YEAR_MS) return '1-2 years';
    return '6-12 months';
  }

  /** Map age bracket to risk level. Older files are safer to remove. */
  private bracketRisk(bracket: AgeBracket): RiskLevel {
    switch (bracket) {
      case '2+ years':
        return 'green';
      case '1-2 years':
        return 'yellow';
      case '6-12 months':
        return 'yellow';
    }
  }
}
