import { randomUUID } from 'crypto';
import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import { BaseScanner } from '../base-scanner';
import type { ScannerConfig, ScanResult } from '../types';

/**
 * Empty Items Scanner — finds zero-byte files and empty directories.
 *
 * Two-pass approach:
 * 1. Walk all directories, collecting zero-byte files along the way
 * 2. Identify empty directories (leaf-first: a directory is empty if it
 *    contains no files and all subdirectories are also empty)
 *
 * Both results are combined into a single output.
 */
export class EmptyItemsScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('empty-items', config);
  }

  async scan(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    // Phase 1: Find zero-byte files
    this.updateProgress({ phase: 'Finding zero-byte files', percent: 0 });

    let filesScanned = 0;

    for (const dir of this.config.paths) {
      if (this.cancelled) break;

      for await (const entry of this.walkFiles(dir)) {
        if (this.cancelled) break;

        filesScanned++;

        if (!entry.isDirectory && entry.size === 0) {
          results.push({
            id: randomUUID(),
            scannerType: 'empty-items',
            path: entry.path,
            size: 0,
            modified: entry.modified,
            risk: 'green',
            category: 'Zero-byte Files',
            description: `${basename(entry.path)} — empty file (0 bytes)`,
          });

          this.updateProgress({
            currentPath: entry.path,
            itemsFound: results.length,
            bytesFound: 0,
          });
        }

        if (filesScanned % 500 === 0) {
          this.updateProgress({ currentPath: entry.path });
        }
      }
    }

    // Phase 2: Find empty directories (leaf-first)
    this.updateProgress({
      phase: 'Finding empty directories',
      percent: 50,
    });

    for (const dir of this.config.paths) {
      if (this.cancelled) break;

      const emptyDirs = await this.findEmptyDirs(dir, this.config.maxDepth);

      for (const emptyDir of emptyDirs) {
        if (this.cancelled) break;

        results.push({
          id: randomUUID(),
          scannerType: 'empty-items',
          path: emptyDir.path,
          size: 0,
          modified: emptyDir.modified,
          risk: 'green',
          category: 'Empty Directories',
          description: `${basename(emptyDir.path)} — empty directory`,
          isDirectory: true,
        });

        this.updateProgress({
          currentPath: emptyDir.path,
          itemsFound: results.length,
          bytesFound: 0,
        });
      }
    }

    this.updateProgress({ percent: 100, phase: 'Complete' });
    return results;
  }

  /**
   * Recursively find empty directories — only reports leaf-level empty dirs
   * (directories with zero entries). Parent directories that contain only
   * empty subdirs are NOT reported; they will surface on the next scan
   * after their children are deleted. This prevents rm({ recursive: true })
   * from silently destroying files written between scan and clean.
   */
  private async findEmptyDirs(
    dir: string,
    maxDepth: number,
    depth = 0,
  ): Promise<{ path: string; modified: number }[]> {
    if (depth > maxDepth) return [];
    if (this.cancelled) return [];

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Permission denied or other access error — skip
      return [];
    }

    // A truly empty directory has no entries at all
    if (entries.length === 0) {
      let modified = 0;
      try {
        const s = await stat(dir);
        modified = s.mtimeMs;
      } catch {
        // Can't stat — use 0
      }
      return [{ path: dir, modified }];
    }

    // Recurse into all subdirectories to find empty leaves
    const emptyDirs: { path: string; modified: number }[] = [];

    for (const entry of entries) {
      if (this.cancelled) return emptyDirs;

      if (entry.isDirectory()) {
        const subEmpty = await this.findEmptyDirs(join(dir, entry.name), maxDepth, depth + 1);
        emptyDirs.push(...subEmpty);
      }
    }

    return emptyDirs;
  }
}
