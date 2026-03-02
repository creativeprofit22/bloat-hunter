import { readdir, stat } from 'fs/promises';
import { basename, join } from 'path';
import type { ScannerType, ScannerConfig, ScanResult, ScanProgress } from './types';

/** Entry returned by the walkFiles async generator. */
export interface FileEntry {
  /** Absolute path to the file or directory */
  path: string;
  /** Size in bytes (0 for directories) */
  size: number;
  /** Last modified timestamp (epoch ms) */
  modified: number;
  /** Whether this entry is a directory */
  isDirectory: boolean;
}

/**
 * Abstract base class for all scanners.
 * Each scanner type extends this and implements scan/cancel/getProgress.
 */
export abstract class BaseScanner {
  readonly type: ScannerType;
  protected config: ScannerConfig;
  protected cancelled = false;
  protected progress: ScanProgress;
  private onProgressCallback?: (progress: ScanProgress) => void;

  constructor(type: ScannerType, config: ScannerConfig) {
    this.type = type;
    this.config = config;
    this.progress = {
      scannerType: type,
      percent: 0,
      currentPath: '',
      itemsFound: 0,
      bytesFound: 0,
    };
  }

  /** Run the scan. Returns all found results. */
  abstract scan(): Promise<ScanResult[]>;

  /** Request cooperative cancellation. */
  cancel(): void {
    this.cancelled = true;
  }

  /** Whether the scan has been cancelled. */
  get isCancelled(): boolean {
    return this.cancelled;
  }

  /** Get the current scan progress snapshot. */
  getProgress(): ScanProgress {
    return { ...this.progress };
  }

  /** Set progress callback (used by worker thread to forward progress to main). */
  setProgressCallback(callback: (progress: ScanProgress) => void): void {
    this.onProgressCallback = callback;
  }

  /** Update progress and notify via callback. */
  protected updateProgress(update: Partial<ScanProgress>): void {
    Object.assign(this.progress, update);
    this.onProgressCallback?.(this.getProgress());
  }

  /**
   * Check whether a file or directory path matches any exclusion pattern
   * from this.config.exclusions. Supports simple glob patterns with `*`.
   */
  private isExcluded(filePath: string): boolean {
    if (!this.config.exclusions?.length) return false;
    const name = basename(filePath);
    return this.config.exclusions.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp(
          '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$',
          'i',
        );
        return regex.test(name);
      }
      return name.toLowerCase() === pattern.toLowerCase();
    });
  }

  /**
   * Async generator that recursively walks a directory tree.
   * Yields file/directory entries with metadata.
   * Respects maxDepth, exclusions, cancellation, and handles permission errors.
   */
  protected async *walkFiles(dir: string, maxDepth?: number, depth = 0): AsyncGenerator<FileEntry> {
    const effectiveMaxDepth = maxDepth ?? this.config.maxDepth;
    if (depth > effectiveMaxDepth) return;
    if (this.cancelled) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Permission denied or other access error — skip this directory
      return;
    }

    for (const entry of entries) {
      if (this.cancelled) return;

      const fullPath = join(dir, entry.name);

      // Skip files and directories matching exclusion patterns
      if (this.isExcluded(fullPath)) continue;

      try {
        if (entry.isFile()) {
          const s = await stat(fullPath);
          yield {
            path: fullPath,
            size: s.size,
            modified: s.mtimeMs,
            isDirectory: false,
          };
        } else if (entry.isDirectory()) {
          yield {
            path: fullPath,
            size: 0,
            modified: 0,
            isDirectory: true,
          };
          yield* this.walkFiles(fullPath, effectiveMaxDepth, depth + 1);
        }
      } catch {
        // Skip files that can't be stat'd (access denied, in-use, etc.)
        continue;
      }
    }
  }
}
