import { randomUUID } from 'crypto';
import { basename, extname } from 'path';
import { BaseScanner } from '../base-scanner';
import type { ScannerConfig, ScanResult } from '../types';

/**
 * Min-heap entry: tracks top N largest files.
 * The root is always the smallest in the heap, so we can efficiently
 * evict it when a larger file is found.
 */
interface HeapEntry {
  path: string;
  size: number;
  modified: number;
}

/**
 * Simple min-heap (by size) to maintain the top N largest files
 * without sorting the entire file list.
 */
class MinHeap {
  private data: HeapEntry[] = [];
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get length(): number {
    return this.data.length;
  }

  /** Smallest entry in the heap (root). */
  peekMin(): HeapEntry | undefined {
    return this.data[0];
  }

  /** Push an entry, evicting the smallest if over capacity. */
  push(entry: HeapEntry): void {
    if (this.data.length < this.capacity) {
      this.data.push(entry);
      this.bubbleUp(this.data.length - 1);
    } else if (this.data.length > 0 && entry.size > this.data[0].size) {
      // Replace root (smallest) with the new larger entry
      this.data[0] = entry;
      this.sinkDown(0);
    }
  }

  /** Return all entries sorted largest-first. */
  toSortedArray(): HeapEntry[] {
    return [...this.data].sort((a, b) => b.size - a.size);
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[i].size < this.data[parent].size) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      if (left < n && this.data[left].size < this.data[smallest].size) {
        smallest = left;
      }
      if (right < n && this.data[right].size < this.data[smallest].size) {
        smallest = right;
      }
      if (smallest !== i) {
        this.swap(i, smallest);
        i = smallest;
      } else {
        break;
      }
    }
  }

  private swap(a: number, b: number): void {
    const tmp = this.data[a];
    this.data[a] = this.data[b];
    this.data[b] = tmp;
  }
}

/**
 * Big Files Scanner — walks specified directories and finds the top N
 * largest files using a min-heap for efficient tracking.
 *
 * Configurable via ScannerConfig:
 * - topN: number of largest files to return (default 100)
 * - minSize: minimum file size in bytes to consider
 * - includeExtensions / excludeExtensions: filter by extension
 * - paths: directories to scan
 * - maxDepth: maximum recursion depth
 */
export class BigFilesScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('big-files', config);
  }

  async scan(): Promise<ScanResult[]> {
    const topN = this.config.topN ?? 100;
    const minSize = this.config.minSize ?? 0;
    const includeExts = this.config.includeExtensions?.map((e) => e.toLowerCase());
    const excludeExts = this.config.excludeExtensions?.map((e) => e.toLowerCase());

    const heap = new MinHeap(topN);
    let filesScanned = 0;

    this.updateProgress({ phase: 'Scanning for large files', percent: 0 });

    for (const dir of this.config.paths) {
      if (this.cancelled) break;

      for await (const entry of this.walkFiles(dir)) {
        if (this.cancelled) break;
        if (entry.isDirectory) continue;

        filesScanned++;

        // Extension filtering
        if (includeExts || excludeExts) {
          const ext = extname(entry.path).toLowerCase();
          if (includeExts && !includeExts.includes(ext)) continue;
          if (excludeExts && excludeExts.includes(ext)) continue;
        }

        // Size threshold
        if (entry.size < minSize) continue;

        heap.push({
          path: entry.path,
          size: entry.size,
          modified: entry.modified,
        });

        // Update progress periodically (every 500 files)
        if (filesScanned % 500 === 0) {
          this.updateProgress({
            currentPath: entry.path,
            itemsFound: heap.length,
            bytesFound: this.heapTotalBytes(heap),
          });
        }
      }
    }

    // Convert heap to sorted results
    const sorted = heap.toSortedArray();
    const results: ScanResult[] = sorted.map((entry) => ({
      id: randomUUID(),
      scannerType: 'big-files' as const,
      path: entry.path,
      size: entry.size,
      modified: entry.modified,
      risk: this.assessRisk(entry.size),
      category: 'Large Files',
      description: `${basename(entry.path)} — large file consuming disk space`,
    }));

    this.updateProgress({
      percent: 100,
      phase: 'Complete',
      itemsFound: results.length,
      bytesFound: results.reduce((sum, r) => sum + r.size, 0),
    });

    return results;
  }

  /** Sum all sizes in the heap. */
  private heapTotalBytes(heap: MinHeap): number {
    return heap.toSortedArray().reduce((sum, e) => sum + e.size, 0);
  }

  /** Assign risk based on file size — larger files are more impactful to clean. */
  private assessRisk(size: number): 'green' | 'yellow' | 'red' {
    const GB = 1024 * 1024 * 1024;
    const MB = 1024 * 1024;

    // Files over 1 GB — high impact, user should review
    if (size >= GB) return 'yellow';
    // Files over 100 MB — moderate
    if (size >= 100 * MB) return 'green';
    // Smaller large files — safe to review
    return 'green';
  }
}
