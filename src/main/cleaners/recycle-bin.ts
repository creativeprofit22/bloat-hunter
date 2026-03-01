import { shell } from 'electron';

/**
 * Move a file or directory to the system recycle bin using Electron's shell API.
 * Returns true if successful, throws on failure.
 */
export async function trashItem(filePath: string): Promise<void> {
  await shell.trashItem(filePath);
}
