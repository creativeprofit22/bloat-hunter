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

/**
 * Manages worker threads for scanner operations.
 * Spawns one worker per scan, tracks active workers, handles cancellation.
 */
export class WorkerManager {
  private workers = new Map<ScannerType, Worker>();

  /**
   * Resolve the path to the compiled scanner-worker.js.
   * In both dev and packaged modes, the worker is compiled alongside
   * the main process bundle in the same directory.
   *
   * Note: For ASAR-packed apps, scanner-worker.js must be listed in
   * electron-builder's asar.unpacked config since worker_threads
   * cannot load scripts from inside an ASAR archive.
   */
  private getWorkerPath(): string {
    if (app.isPackaged) {
      // In packaged app, resolve relative to the app's root
      return path.join(app.getAppPath(), 'dist', 'main', 'scanner-worker.js');
    }
    // In dev mode, esbuild compiles the worker to dist/main/
    return path.join(__dirname, 'scanner-worker.js');
  }

  /**
   * Start a scan in a worker thread.
   * If a scan of the same type is already running, it is cancelled first.
   */
  startScan(scannerType: ScannerType, config: ScannerConfig, callbacks: WorkerCallbacks): void {
    // Cancel existing scan of same type if running
    if (this.workers.has(scannerType)) {
      this.cancelScan(scannerType);
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
          callbacks.onCancelled(scannerType);
          this.workers.delete(scannerType);
          break;
      }
    });

    worker.on('error', (err: Error) => {
      callbacks.onError(scannerType, err.message);
      this.workers.delete(scannerType);
    });

    worker.on('exit', (code) => {
      // Only report if the worker exited abnormally and we haven't
      // already handled it via a message event
      if (code !== 0 && this.workers.has(scannerType)) {
        callbacks.onError(scannerType, `Worker exited with code ${code}`);
        this.workers.delete(scannerType);
      }
    });
  }

  /** Send a cancel request to the worker running the given scanner type. */
  cancelScan(scannerType: ScannerType): void {
    const worker = this.workers.get(scannerType);
    if (worker) {
      worker.postMessage({ type: 'cancel' });
    }
  }

  /** Cancel all active scans. */
  cancelAll(): void {
    for (const [type] of this.workers) {
      this.cancelScan(type);
    }
  }

  /** Check if a scan of the given type is currently running. */
  isRunning(scannerType: ScannerType): boolean {
    return this.workers.has(scannerType);
  }

  /** Forcefully terminate all workers. Call on app shutdown. */
  async terminateAll(): Promise<void> {
    const terminations = [...this.workers.values()].map((w) => w.terminate());
    await Promise.all(terminations);
    this.workers.clear();
  }
}
