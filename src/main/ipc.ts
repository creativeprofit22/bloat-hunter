import { ipcMain, app } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { stat } from 'fs/promises';
import sharp from 'sharp';
import { WorkerManager } from './scanners/worker-manager';
import type {
  ScannerType,
  ScannerConfig,
  CleanableItem,
  CleanAction,
  AIProviderConfig,
  ScanResult,
} from './scanners/types';
import { cleanItems } from './cleaners/cleaner';
import { isAdmin } from './cleaners/service-manager';
import { advisor } from './ai/advisor';
import { loadSettings, updateSettings, type AppSettings } from './settings/store';
import { setApiKey, getApiKey, hasApiKey } from './settings/secure-store';

const workerManager = new WorkerManager();

export function registerIpcHandlers(): void {
  // ── App Info ────────────────────────────────────────────────────────

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('get-platform', () => {
    return process.platform;
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
    workerManager.cancelScan(scannerType);
  });

  // ── Preview / Thumbnails ───────────────────────────────────────────

  ipcMain.handle(
    'preview:thumbnail',
    async (_event: IpcMainInvokeEvent, filePath: string, maxSize: number) => {
      try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const buf = await image
          .resize({
            width: maxSize,
            height: maxSize,
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

  ipcMain.handle('preview:file-stat', async (_event: IpcMainInvokeEvent, filePath: string) => {
    try {
      const s = await stat(filePath);
      return {
        size: s.size,
        created: s.birthtime.getTime(),
        modified: s.mtime.getTime(),
        accessed: s.atime.getTime(),
        isDirectory: s.isDirectory(),
        isFile: s.isFile(),
      };
    } catch {
      return null;
    }
  });

  // ── Cleaning Actions ──────────────────────────────────────────────────

  ipcMain.handle(
    'clean:start',
    async (
      event: IpcMainInvokeEvent,
      items: CleanableItem[],
      action: CleanAction,
      moveTo?: string,
    ) => {
      const sender = event.sender;

      const result = await cleanItems(items, { action, moveTo }, (progress) => {
        if (!sender.isDestroyed()) {
          sender.send('clean:progress', progress);
        }
      });

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
      setApiKey(provider, apiKey);
    },
  );

  ipcMain.handle('settings:has-api-key', (_event: IpcMainInvokeEvent, provider: string) => {
    return hasApiKey(provider);
  });

  // ── AI Advisory ──────────────────────────────────────────────────────

  ipcMain.handle('ai:configure', (_event: IpcMainInvokeEvent, config: AIProviderConfig) => {
    // Inject the API key from secure storage if not provided
    const resolvedConfig = { ...config };
    if (!resolvedConfig.apiKey && resolvedConfig.type !== 'none') {
      resolvedConfig.apiKey = getApiKey(resolvedConfig.type);
    }
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
