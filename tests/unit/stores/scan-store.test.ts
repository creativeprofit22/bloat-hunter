import { describe, it, expect, beforeEach } from 'vitest';
import { useScanStore } from '../../../src/renderer/store/scan-store';

describe('ScanStore', () => {
  beforeEach(() => {
    useScanStore.getState().resetAll();
  });

  it('initializes with empty scanners map', () => {
    const state = useScanStore.getState();
    expect(state.scanners).toEqual({});
  });

  it('getScanner returns defaults for uninitialized scanner', () => {
    const scanner = useScanStore.getState().getScanner('system-junk');
    expect(scanner.status).toBe('idle');
    expect(scanner.progress).toBe(0);
    expect(scanner.results).toEqual([]);
    expect(scanner.error).toBeNull();
  });

  it('startScan marks scanner as scanning', () => {
    useScanStore.getState().startScan('system-junk');
    const scanner = useScanStore.getState().getScanner('system-junk');
    expect(scanner.status).toBe('scanning');
    expect(scanner.progress).toBe(0);
  });

  it('updateProgress updates scanner state', () => {
    useScanStore.getState().startScan('duplicates');
    useScanStore.getState().updateProgress({
      scannerType: 'duplicates',
      percent: 50,
      currentPath: '/test/path',
      itemsFound: 10,
      bytesFound: 1024,
      phase: 'prehash',
    });

    const scanner = useScanStore.getState().getScanner('duplicates');
    expect(scanner.status).toBe('scanning');
    expect(scanner.progress).toBe(50);
    expect(scanner.currentPath).toBe('/test/path');
    expect(scanner.itemsFound).toBe(10);
    expect(scanner.bytesFound).toBe(1024);
    expect(scanner.phase).toBe('prehash');
  });

  it('setResults marks scanner as complete', () => {
    const results = [
      {
        id: 'r1',
        scannerType: 'system-junk' as const,
        path: '/tmp/test',
        size: 500,
        modified: Date.now(),
        risk: 'green' as const,
        category: 'Test',
        description: 'Test item',
      },
      {
        id: 'r2',
        scannerType: 'system-junk' as const,
        path: '/tmp/test2',
        size: 1500,
        modified: Date.now(),
        risk: 'green' as const,
        category: 'Test',
        description: 'Test item 2',
      },
    ];

    useScanStore.getState().setResults('system-junk', results);
    const scanner = useScanStore.getState().getScanner('system-junk');
    expect(scanner.status).toBe('complete');
    expect(scanner.progress).toBe(100);
    expect(scanner.results).toHaveLength(2);
    expect(scanner.itemsFound).toBe(2);
    expect(scanner.bytesFound).toBe(2000);
  });

  it('setError marks scanner with error', () => {
    useScanStore.getState().setError('browser-cache', 'Permission denied');
    const scanner = useScanStore.getState().getScanner('browser-cache');
    expect(scanner.status).toBe('error');
    expect(scanner.error).toBe('Permission denied');
  });

  it('setCancelled resets scanner to idle', () => {
    useScanStore.getState().startScan('big-files');
    useScanStore.getState().setCancelled('big-files');
    const scanner = useScanStore.getState().getScanner('big-files');
    expect(scanner.status).toBe('idle');
    expect(scanner.progress).toBe(0);
  });

  it('reset resets a single scanner', () => {
    useScanStore.getState().startScan('system-junk');
    useScanStore.getState().startScan('duplicates');
    useScanStore.getState().reset('system-junk');

    expect(useScanStore.getState().getScanner('system-junk').status).toBe('idle');
    expect(useScanStore.getState().getScanner('duplicates').status).toBe('scanning');
  });

  it('resetAll clears all scanners', () => {
    useScanStore.getState().startScan('system-junk');
    useScanStore.getState().startScan('duplicates');
    useScanStore.getState().resetAll();

    expect(useScanStore.getState().scanners).toEqual({});
  });

  it('getTotalBytes sums across all scanners', () => {
    useScanStore.getState().setResults('system-junk', [
      {
        id: 'r1',
        scannerType: 'system-junk',
        path: '/a',
        size: 1000,
        modified: 0,
        risk: 'green',
        category: '',
        description: '',
      },
    ]);
    useScanStore.getState().setResults('duplicates', [
      {
        id: 'r2',
        scannerType: 'duplicates',
        path: '/b',
        size: 2000,
        modified: 0,
        risk: 'green',
        category: '',
        description: '',
      },
    ]);

    expect(useScanStore.getState().getTotalBytes()).toBe(3000);
  });

  it('getTotalItems sums across all scanners', () => {
    useScanStore.getState().setResults('system-junk', [
      {
        id: 'r1',
        scannerType: 'system-junk',
        path: '/a',
        size: 0,
        modified: 0,
        risk: 'green',
        category: '',
        description: '',
      },
      {
        id: 'r2',
        scannerType: 'system-junk',
        path: '/b',
        size: 0,
        modified: 0,
        risk: 'green',
        category: '',
        description: '',
      },
    ]);

    expect(useScanStore.getState().getTotalItems()).toBe(2);
  });

  it('isAnyScanning returns true when a scanner is running', () => {
    expect(useScanStore.getState().isAnyScanning()).toBe(false);
    useScanStore.getState().startScan('system-junk');
    expect(useScanStore.getState().isAnyScanning()).toBe(true);
  });

  it('isAnyScanning returns false when all scanners complete', () => {
    useScanStore.getState().startScan('system-junk');
    useScanStore.getState().setResults('system-junk', []);
    expect(useScanStore.getState().isAnyScanning()).toBe(false);
  });
});
