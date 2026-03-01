import { Worker } from 'worker_threads';
import { app } from 'electron';
import path from 'path';
import type { ScannerType, ScannerConfig, ScanProgress, ScanResult, WorkerMessage } from './types';

export interface WorkerCallbacks {
  onProgress: (progress: ScanProgress) => void;
  onResult: (scannerType: ScannerType, results: ScanResult[]) => void;
  onError: (scannerType: ScannerType, error: string) => void;
  onCancelled: (scannerType: ScannerType) => void;
}

/** Grace period before force-terminating a cancelled worker (ms). */
const CANCEL_TIMEOUT_MS = 5000;

/**
 * Manages worker threads for scanner operations.
 * Spawns one worker per scan, tracks active workers, handles cancellation.
 */
export class WorkerManager {
  private workers = new Map<ScannerType, Worker>();
  private cancelTimeouts = new Map<ScannerType, ReturnType<typeof setTimeout>>();

  /**
   * Resolve the path to the compiled scanner-worker.js.
   * In packaged builds the worker is unpacked outside the ASAR archive
   * (worker_threads cannot load scripts from inside an ASAR).
   */
  private getWorkerPath(): string {
    if (app.isPackaged) {
      // asarUnpack places the file at app.asar.unpacked/dist/main/scanner-worker.js
      return path.join(
        app.getAppPath().replace('app.asar', 'app.asar.unpacked'),
        'dist',
        'main',
        'scanner-worker.js',
      );
    }
    // In dev mode, esbuild compiles the worker to dist/main/
    return path.join(__dirname, 'scanner-worker.js');
  }

  /** Clear any pending cancel timeout for a scanner type. */
  private clearCancelTimeout(scannerType: ScannerType): void {
    const timeout = this.cancelTimeouts.get(scannerType);
    if (timeout) {
      clearTimeout(timeout);
      this.cancelTimeouts.delete(scannerType);
    }
  }

  /**
   * Start a scan in a worker thread.
   * If a scan of the same type is already running, it is force-terminated first.
   */
  startScan(scannerType: ScannerType, config: ScannerConfig, callbacks: WorkerCallbacks): void {
    // Force-terminate existing worker of same type — we're replacing it
    const existing = this.workers.get(scannerType);
    if (existing) {
      this.clearCancelTimeout(scannerType);
      existing.terminate();
      this.workers.delete(scannerType);
    }

    const worker = new Worker(this.getWorkerPath(), {
      workerData: { scannerType, config },
    });

    this.workers.set(scannerType, worker);

    worker.on('message', (msg: WorkerMessage) => {
      switch (msg.type) {
        case 'progress':
          callbacks.onProgress(msg.data as ScanProgress);
          break;
        case 'result':
          callbacks.onResult(scannerType, msg.data as ScanResult[]);
          this.workers.delete(scannerType);
          break;
        case 'error':
          callbacks.onError(scannerType, msg.data as string);
          this.workers.delete(scannerType);
          break;
        case 'cancelled':
          this.clearCancelTimeout(scannerType);
          callbacks.onCancelled(scannerType);
          this.workers.delete(scannerType);
          break;
      }
    });

    worker.on('error', (err: Error) => {
      // Only act if this worker is still the current one for this type
      if (this.workers.get(scannerType) === worker) {
        callbacks.onError(scannerType, err.message);
        this.workers.delete(scannerType);
      }
    });

    worker.on('exit', (code) => {
      // Only report if this specific worker exited abnormally and is still tracked
      if (code !== 0 && this.workers.get(scannerType) === worker) {
        callbacks.onError(scannerType, `Worker exited with code ${code}`);
        this.workers.delete(scannerType);
      }
    });
  }

  /**
   * Send a cancel request to the worker running the given scanner type.
   * If the worker doesn't respond within the grace period, it is force-terminated.
   */
  cancelScan(scannerType: ScannerType): void {
    const worker = this.workers.get(scannerType);
    if (worker) {
      worker.postMessage({ type: 'cancel' });

      // Force-terminate if cooperative cancel doesn't respond in time
      this.clearCancelTimeout(scannerType);
      this.cancelTimeouts.set(
        scannerType,
        setTimeout(() => {
          if (this.workers.get(scannerType) === worker) {
            worker.terminate();
            // The 'exit' handler will clean up this.workers
          }
          this.cancelTimeouts.delete(scannerType);
        }, CANCEL_TIMEOUT_MS),
      );
    }
  }

  /** Forcefully terminate all workers. Call on app shutdown. */
  async terminateAll(): Promise<void> {
    // Clear all pending cancel timeouts
    for (const timeout of this.cancelTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.cancelTimeouts.clear();

    const terminations = [...this.workers.values()].map((w) => w.terminate());
    await Promise.all(terminations);
    this.workers.clear();
  }
}
