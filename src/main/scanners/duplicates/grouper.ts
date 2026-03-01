import { hashFile, hashFilePartial } from './hasher';

/** File metadata collected during the walk phase. */
export interface FileInfo {
  path: string;
  size: number;
  modified: number;
}

/** A group of confirmed duplicate files sharing the same content hash. */
export interface DuplicateGroup {
  hash: string;
  size: number;
  files: FileInfo[];
}

/** Progress callback for reporting pipeline status. */
export interface GrouperProgress {
  phase: 'prehash' | 'full-hash';
  current: number;
  total: number;
}

/**
 * Three-stage duplicate detection pipeline:
 *
 * 1. **Size grouping** — group files by size; unique sizes are immediately
 *    discarded since files of different sizes cannot be duplicates.
 *
 * 2. **Prehash** — for each size group with 2+ files, hash the first 4 KB.
 *    Unique prehashes are discarded. This avoids full-file hashing for files
 *    that happen to share a size but differ in content.
 *
 * 3. **Full hash** — hash the entire remaining candidates. Groups with 2+
 *    identical full hashes are confirmed duplicates.
 */
export async function findDuplicates(
  files: FileInfo[],
  onProgress?: (progress: GrouperProgress) => void,
  isCancelled?: () => boolean,
): Promise<DuplicateGroup[]> {
  // ── Stage 1: Group by size ──────────────────────────────────────────
  const bySize = new Map<number, FileInfo[]>();

  for (const file of files) {
    const group = bySize.get(file.size);
    if (group) {
      group.push(file);
    } else {
      bySize.set(file.size, [file]);
    }
  }

  // Collect only groups with 2+ files (potential duplicates)
  const sizeGroups: FileInfo[][] = [];
  for (const [, group] of bySize) {
    if (group.length >= 2) {
      sizeGroups.push(group);
    }
  }

  // ── Stage 2: Prehash (first 4 KB) ──────────────────────────────────
  const prehashCandidates: FileInfo[] = sizeGroups.flat();
  const prehashTotal = prehashCandidates.length;
  let prehashDone = 0;

  // Group by prehash within each size group
  const afterPrehash: FileInfo[][] = [];

  for (const group of sizeGroups) {
    if (isCancelled?.()) break;

    const byPrehash = new Map<string, FileInfo[]>();

    for (const file of group) {
      if (isCancelled?.()) break;

      try {
        const hash = await hashFilePartial(file.path);
        const bucket = byPrehash.get(hash);
        if (bucket) {
          bucket.push(file);
        } else {
          byPrehash.set(hash, [file]);
        }
      } catch {
        // File became inaccessible — skip it
      }

      prehashDone++;
      onProgress?.({
        phase: 'prehash',
        current: prehashDone,
        total: prehashTotal,
      });
    }

    // Keep only prehash groups with 2+ files
    for (const [, bucket] of byPrehash) {
      if (bucket.length >= 2) {
        afterPrehash.push(bucket);
      }
    }
  }

  // ── Stage 3: Full hash ──────────────────────────────────────────────
  const fullHashCandidates = afterPrehash.flat();
  const fullHashTotal = fullHashCandidates.length;
  let fullHashDone = 0;

  const duplicates: DuplicateGroup[] = [];

  for (const group of afterPrehash) {
    if (isCancelled?.()) break;

    const byFullHash = new Map<string, FileInfo[]>();

    for (const file of group) {
      if (isCancelled?.()) break;

      try {
        const hash = await hashFile(file.path);
        const bucket = byFullHash.get(hash);
        if (bucket) {
          bucket.push(file);
        } else {
          byFullHash.set(hash, [file]);
        }
      } catch {
        // File became inaccessible — skip it
      }

      fullHashDone++;
      onProgress?.({
        phase: 'full-hash',
        current: fullHashDone,
        total: fullHashTotal,
      });
    }

    // Confirmed duplicates: 2+ files with identical full hash
    for (const [hash, bucket] of byFullHash) {
      if (bucket.length >= 2) {
        duplicates.push({
          hash,
          size: bucket[0].size,
          files: bucket,
        });
      }
    }
  }

  return duplicates;
}
