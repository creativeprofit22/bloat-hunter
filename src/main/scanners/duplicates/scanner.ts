import { randomUUID } from 'crypto';
import { basename, extname } from 'path';
import { BaseScanner } from '../base-scanner';
import type { ScannerConfig, ScanResult } from '../types';
import { findDuplicates } from './grouper';
import type { FileInfo } from './grouper';

/**
 * Duplicate Files Scanner — finds files with identical content across
 * the specified directories using a three-stage pipeline:
 *
 * 1. Walk & collect: gather all files with metadata
 * 2. Size grouping → prehash (first 4 KB) → full hash
 * 3. Groups with 2+ identical full hashes = confirmed duplicates
 *
 * Configurable via ScannerConfig:
 * - paths: directories to scan
 * - minSize: minimum file size to consider (default 1 byte — skip zero-byte)
 * - maxDepth: maximum directory recursion depth
 * - includeExtensions / excludeExtensions: filter by extension
 */
export class DuplicatesScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('duplicates', config);
  }

  async scan(): Promise<ScanResult[]> {
    const minSize = this.config.minSize ?? 0;
    const includeExts = this.config.includeExtensions?.map((e) => e.toLowerCase());
    const excludeExts = this.config.excludeExtensions?.map((e) => e.toLowerCase());

    // ── Phase 1: Walk and collect files ────────────────────────────────
    this.updateProgress({ phase: 'Scanning files', percent: 0 });

    const files: FileInfo[] = [];
    let walked = 0;

    for (const dir of this.config.paths) {
      if (this.cancelled) break;

      for await (const entry of this.walkFiles(dir)) {
        if (this.cancelled) break;
        if (entry.isDirectory) continue;

        walked++;

        // Size filter — skip files below threshold
        if (entry.size < minSize) continue;

        // Extension filtering
        if (includeExts || excludeExts) {
          const ext = extname(entry.path).toLowerCase();
          if (includeExts && !includeExts.includes(ext)) continue;
          if (excludeExts && excludeExts.includes(ext)) continue;
        }

        files.push({
          path: entry.path,
          size: entry.size,
          modified: entry.modified,
        });

        // Progress updates every 500 files
        if (walked % 500 === 0) {
          this.updateProgress({
            currentPath: entry.path,
            itemsFound: files.length,
            bytesFound: 0,
          });
        }
      }
    }

    if (this.cancelled) return [];

    this.updateProgress({
      phase: `Collected ${files.length} files, grouping by size`,
      percent: 20,
      itemsFound: files.length,
    });

    // ── Phase 2–3: Size grouping → prehash → full hash ────────────────
    const duplicateGroups = await findDuplicates(
      files,
      (progress) => {
        if (progress.phase === 'prehash') {
          const pct = 20 + Math.round((progress.current / progress.total) * 40);
          this.updateProgress({
            phase: `Prehashing ${progress.current}/${progress.total}`,
            percent: Math.min(pct, 60),
          });
        } else {
          const pct = 60 + Math.round((progress.current / progress.total) * 35);
          this.updateProgress({
            phase: `Full hashing ${progress.current}/${progress.total}`,
            percent: Math.min(pct, 95),
          });
        }
      },
      () => this.cancelled,
    );

    if (this.cancelled) return [];

    // ── Convert groups to ScanResults ──────────────────────────────────
    const results: ScanResult[] = [];
    let totalWasted = 0;

    for (const group of duplicateGroups) {
      const groupId = randomUUID();
      // Wasted space = (copies - 1) * file size
      const wastedBytes = (group.files.length - 1) * group.size;
      totalWasted += wastedBytes;

      // Sort files: newest first (recommend keeping the newest)
      const sorted = [...group.files].sort((a, b) => b.modified - a.modified);

      for (const file of sorted) {
        results.push({
          id: randomUUID(),
          scannerType: 'duplicates',
          path: file.path,
          size: file.size,
          modified: file.modified,
          risk: 'yellow',
          category: 'Duplicate Files',
          description: `${basename(file.path)} — ${group.files.length} copies found`,
          hash: group.hash,
          groupId,
        });
      }
    }

    this.updateProgress({
      percent: 100,
      phase: 'Complete',
      itemsFound: results.length,
      bytesFound: totalWasted,
    });

    return results;
  }
}
