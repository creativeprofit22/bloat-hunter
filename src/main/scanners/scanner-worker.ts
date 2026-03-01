/**
 * Scanner worker entry point — runs in a worker_threads context.
 *
 * Receives scan configuration via workerData, creates the appropriate
 * scanner instance, runs it, and streams progress/results back to the
 * main thread via parentPort.
 */
import { parentPort, workerData } from 'worker_threads';
import type { BaseScanner } from './base-scanner';
import type { ScannerType, ScannerConfig, ScanProgress, WorkerMessage } from './types';

// ── Scanner Registry ────────────────────────────────────────────────

import { SystemJunkScanner } from './system-junk/scanner';
import { BrowserCacheScanner } from './browser-cache/scanner';
import { BigFilesScanner } from './big-files/scanner';
import { EmptyItemsScanner } from './empty-items/scanner';
import { DuplicatesScanner } from './duplicates/scanner';
import { StaleFilesScanner } from './stale-files/scanner';
import { AppLeftoversScanner } from './app-leftovers/scanner';
import { RegistryScanner } from './registry/scanner';

type ScannerFactory = (config: ScannerConfig) => BaseScanner;

const scannerRegistry = new Map<ScannerType, ScannerFactory>();

scannerRegistry.set('system-junk', (c) => new SystemJunkScanner(c));
scannerRegistry.set('browser-cache', (c) => new BrowserCacheScanner(c));
scannerRegistry.set('big-files', (c) => new BigFilesScanner(c));
scannerRegistry.set('empty-items', (c) => new EmptyItemsScanner(c));
scannerRegistry.set('duplicates', (c) => new DuplicatesScanner(c));
scannerRegistry.set('stale-files', (c) => new StaleFilesScanner(c));
scannerRegistry.set('app-leftovers', (c) => new AppLeftoversScanner(c));
scannerRegistry.set('registry', (c) => new RegistryScanner(c));

// ── Message Helpers ─────────────────────────────────────────────────

function send(msg: WorkerMessage): void {
  parentPort?.postMessage(msg);
}

// ── Main Worker Logic ───────────────────────────────────────────────

async function run(): Promise<void> {
  const { scannerType, config } = workerData as {
    scannerType: ScannerType;
    config: ScannerConfig;
  };

  // Look up the scanner factory
  const factory = scannerRegistry.get(scannerType);
  if (!factory) {
    const available = [...scannerRegistry.keys()].join(', ') || 'none';
    send({
      type: 'error',
      data: `Unknown scanner type: "${scannerType}". Registered scanners: ${available}`,
    });
    return;
  }

  // Create the scanner and wire up progress forwarding
  const scanner = factory(config);

  scanner.setProgressCallback((progress: ScanProgress) => {
    send({ type: 'progress', data: progress });
  });

  // Listen for cancellation requests from the main thread
  parentPort?.on('message', (msg: { type: string }) => {
    if (msg.type === 'cancel') {
      scanner.cancel();
    }
  });

  // Run the scan
  try {
    const results = await scanner.scan();

    if (scanner.isCancelled) {
      send({ type: 'cancelled', data: scannerType });
    } else {
      send({ type: 'result', data: results });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send({ type: 'error', data: message });
  } finally {
    // Close the port so the worker thread can exit cleanly
    parentPort?.close();
  }
}

run();
