import { rm, mkdir, rename, stat } from 'fs/promises';
import { dirname, join, basename } from 'path';
import { trashItem } from './recycle-bin';
import { withServicesStopped, isAdmin } from './service-manager';
import type {
  CleanableItem,
  CleanAction,
  CleanResult,
  CleanError,
  CleanProgressInfo,
} from '../scanners/types';

export interface CleanOptions {
  action: CleanAction;
  /** Required when action is 'move' — destination folder */
  moveTo?: string;
}

export type CleanProgressCallback = (progress: CleanProgressInfo) => void;

/**
 * Core cleaning engine. Processes a list of items using the specified action.
 * Reports progress for each item via callback.
 */
export async function cleanItems(
  items: CleanableItem[],
  options: CleanOptions,
  onProgress?: CleanProgressCallback,
): Promise<CleanResult> {
  const result: CleanResult = {
    totalItems: items.length,
    successCount: 0,
    failedCount: 0,
    bytesRecovered: 0,
    errors: [],
  };

  if (items.length === 0) return result;

  // If moving, ensure destination exists
  if (options.action === 'move' && options.moveTo) {
    await mkdir(options.moveTo, { recursive: true });
  }

  // Check if any items need service management
  const allPaths = items.map((item) => item.path);
  const needsAdmin = allPaths.some(
    (p) => p.toLowerCase().includes('softwaredistribution') && process.platform === 'win32',
  );

  if (needsAdmin && options.action === 'delete') {
    const hasAdmin = await isAdmin();
    if (hasAdmin) {
      await withServicesStopped(allPaths, async () => {
        await processItems(items, options, result, onProgress);
      });
      return result;
    }
    // Fall through to normal processing — individual items will fail with permission errors
  }

  await processItems(items, options, result, onProgress);
  return result;
}

async function processItems(
  items: CleanableItem[],
  options: CleanOptions,
  result: CleanResult,
  onProgress?: CleanProgressCallback,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    onProgress?.({
      current: i + 1,
      total: items.length,
      currentPath: item.path,
      bytesRecovered: result.bytesRecovered,
      successCount: result.successCount,
      failedCount: result.failedCount,
    });

    try {
      // Verify the item still exists before attempting to clean
      await stat(item.path);

      switch (options.action) {
        case 'recycle':
          await trashItem(item.path);
          break;

        case 'delete':
          await rm(item.path, {
            recursive: item.isDirectory,
            force: true,
          });
          break;

        case 'move': {
          if (!options.moveTo) {
            throw new Error('Move destination not specified');
          }
          const destPath = join(options.moveTo, basename(item.path));
          await mkdir(dirname(destPath), { recursive: true });
          await rename(item.path, destPath);
          break;
        }
      }

      result.successCount++;
      result.bytesRecovered += item.size;
    } catch (err) {
      result.failedCount++;
      const error: CleanError = {
        path: item.path,
        message: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException).code,
      };
      result.errors.push(error);
    }
  }

  // Final progress report
  onProgress?.({
    current: items.length,
    total: items.length,
    currentPath: '',
    bytesRecovered: result.bytesRecovered,
    successCount: result.successCount,
    failedCount: result.failedCount,
  });
}
