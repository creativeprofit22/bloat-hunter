import { ipcMain, app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import sharp from 'sharp';
import { WorkerManager } from './scanners/worker-manager';
import { registerScanResults, isKnownScanResult } from './scanners/result-registry';
import type {
  ScannerType,
  ScannerConfig,
  CleanableItem,
  CleanAction,
  AIProviderConfig,
  ScanResult,
} from './scanners/types';
import path from 'path';
import { cleanItems } from './cleaners/cleaner';
import { isAdmin } from './cleaners/service-manager';
import { advisor } from './ai/advisor';
import { loadSettings, updateSettings, type AppSettings } from './settings/store';
import { setApiKey, getApiKey, hasApiKey } from './settings/secure-store';

const MAX_THUMBNAIL_SIZE = 1024;

/** Only these providers may store API keys. Blocks prototype pollution via arbitrary keys. */
const VALID_API_KEY_PROVIDERS = new Set(['claude', 'openai', 'ollama']);

/** Blocked prefixes for the moveTo destination — prevents moving files into system directories. */
const BLOCKED_MOVE_PREFIXES = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\ProgramData',
].map((p) => p.toLowerCase());

/** Validate the moveTo destination path. Must be absolute, no traversal, outside system dirs. */
function validateMoveTo(moveTo: string): string {
  const resolved = path.resolve(moveTo);
  if (resolved !== path.normalize(moveTo)) {
    throw new Error('moveTo path contains traversal sequences');
  }
  if (!path.isAbsolute(resolved)) {
    throw new Error('moveTo must be an absolute path');
  }
  const lower = resolved.toLowerCase();
  for (const prefix of BLOCKED_MOVE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      throw new Error(`moveTo cannot target system directory: ${resolved}`);
    }
  }
  if (resolved.startsWith('\\\\')) {
    throw new Error('moveTo cannot target UNC/network paths');
  }
  return resolved;
}

/** Only allow localhost URLs for Ollama baseUrl — block exfiltration via arbitrary endpoints. */
function validateLocalUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return url;
    }
    throw new Error(
      `Only localhost URLs are allowed for Ollama (got ${host}). Use localhost, 127.0.0.1, or ::1.`,
    );
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Only localhost')) throw e;
    return undefined;
  }
}

const workerManager = new WorkerManager();

export function registerIpcHandlers(): void {
  // ── App Info ────────────────────────────────────────────────────────

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // ── Scanner Control ─────────────────────────────────────────────────

  ipcMain.handle(
    'scanner:start',
    (event: IpcMainInvokeEvent, scannerType: ScannerType, config: ScannerConfig) => {
      const sender = event.sender;

      workerManager.startScan(scannerType, config, {
        onProgress: (progress) => {
          if (!sender.isDestroyed()) {
            sender.send('scanner:progress', progress);
          }
        },
        onResult: (type, results) => {
          registerScanResults(results);
          if (!sender.isDestroyed()) {
            sender.send('scanner:result', { scannerType: type, results });
          }
        },
        onError: (type, error) => {
          if (!sender.isDestroyed()) {
            sender.send('scanner:error', { scannerType: type, error });
          }
        },
        onCancelled: (type) => {
          if (!sender.isDestroyed()) {
            sender.send('scanner:cancelled', { scannerType: type });
          }
        },
      });
    },
  );

  ipcMain.handle('scanner:cancel', (_event: IpcMainInvokeEvent, scannerType: ScannerType) => {
    return workerManager.cancelScan(scannerType);
  });

  // ── Preview / Thumbnails ───────────────────────────────────────────

  ipcMain.handle(
    'preview:thumbnail',
    async (_event: IpcMainInvokeEvent, filePath: string, maxSize: number) => {
      if (!isKnownScanResult(filePath)) return null;

      const clampedSize = Math.min(Math.max(1, maxSize), MAX_THUMBNAIL_SIZE);
      try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const buf = await image
          .resize({
            width: clampedSize,
            height: clampedSize,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();

        return {
          data: buf.toString('base64'),
          width: metadata.width ?? 0,
          height: metadata.height ?? 0,
          mime: 'image/jpeg',
        };
      } catch {
        return null;
      }
    },
  );

  // ── Cleaning Actions ──────────────────────────────────────────────────

  ipcMain.handle(
    'clean:start',
    async (
      event: IpcMainInvokeEvent,
      items: CleanableItem[],
      action: CleanAction,
      moveTo?: string,
    ) => {
      // Validate moveTo destination before doing anything else
      const validatedMoveTo = moveTo && action === 'move' ? validateMoveTo(moveTo) : undefined;

      // Only allow cleaning paths that were returned by a prior scan
      const validatedItems = items.filter((item) => isKnownScanResult(item.path));
      if (validatedItems.length === 0) {
        return {
          totalItems: 0,
          successCount: 0,
          failedCount: items.length,
          bytesRecovered: 0,
          errors: items.map((item) => ({
            path: item.path,
            message: 'Path was not found in scan results',
          })),
        };
      }

      const sender = event.sender;

      const result = await cleanItems(
        validatedItems,
        { action, moveTo: validatedMoveTo },
        (progress) => {
          if (!sender.isDestroyed()) {
            sender.send('clean:progress', progress);
          }
        },
      );

      return result;
    },
  );

  ipcMain.handle('clean:is-admin', async () => {
    return isAdmin();
  });

  // ── Settings ────────────────────────────────────────────────────────

  ipcMain.handle('settings:load', () => {
    return loadSettings();
  });

  ipcMain.handle('settings:save', (_event: IpcMainInvokeEvent, partial: Partial<AppSettings>) => {
    return updateSettings(partial);
  });

  ipcMain.handle(
    'settings:set-api-key',
    (_event: IpcMainInvokeEvent, provider: string, apiKey: string) => {
      if (!VALID_API_KEY_PROVIDERS.has(provider)) {
        throw new Error(`Unknown API key provider: ${provider}`);
      }
      setApiKey(provider, apiKey);
    },
  );

  ipcMain.handle('settings:has-api-key', (_event: IpcMainInvokeEvent, provider: string) => {
    if (!VALID_API_KEY_PROVIDERS.has(provider)) return false;
    return hasApiKey(provider);
  });

  // ── AI Advisory ──────────────────────────────────────────────────────

  ipcMain.handle('ai:configure', (_event: IpcMainInvokeEvent, config: AIProviderConfig) => {
    // Never accept apiKey or baseUrl from the renderer — always resolve from secure storage.
    // baseUrl is only allowed for Ollama (local server) and must be localhost.
    const resolvedConfig: AIProviderConfig = {
      type: config.type,
      model: config.model,
      apiKey: config.type !== 'none' ? getApiKey(config.type) : undefined,
      baseUrl: config.type === 'ollama' ? validateLocalUrl(config.baseUrl) : undefined,
    };
    advisor.configure(resolvedConfig);
  });

  ipcMain.handle('ai:analyze', async (_event: IpcMainInvokeEvent, results: ScanResult[]) => {
    return advisor.analyze(results);
  });

  ipcMain.handle('ai:explain-item', async (_event: IpcMainInvokeEvent, result: ScanResult) => {
    return advisor.explainItem(result);
  });

  ipcMain.handle('ai:test-connection', async () => {
    return advisor.testConnection();
  });

  // ── Cleanup on app quit ─────────────────────────────────────────────

  app.on('will-quit', () => {
    workerManager.terminateAll();
  });
}
