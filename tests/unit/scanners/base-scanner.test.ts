// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseScanner, type FileEntry } from '../../../src/main/scanners/base-scanner';
import type { ScannerConfig, ScanResult, ScanProgress } from '../../../src/main/scanners/types';

// Concrete test scanner to exercise abstract base class
class TestScanner extends BaseScanner {
  scanResults: ScanResult[] = [];

  constructor(config?: Partial<ScannerConfig>) {
    super('system-junk', {
      paths: [],
      exclusions: [],
      maxDepth: 10,
      ...config,
    });
  }

  async scan(): Promise<ScanResult[]> {
    return this.scanResults;
  }

  // Expose protected methods for testing
  public testUpdateProgress(update: Partial<ScanProgress>): void {
    this.updateProgress(update);
  }

  public async *testWalkFiles(dir: string, maxDepth?: number): AsyncGenerator<FileEntry> {
    yield* this.walkFiles(dir, maxDepth);
  }
}

describe('BaseScanner', () => {
  let scanner: TestScanner;

  beforeEach(() => {
    scanner = new TestScanner();
  });

  it('initializes with correct type', () => {
    expect(scanner.type).toBe('system-junk');
  });

  it('starts with cancelled = false', () => {
    expect(scanner.isCancelled).toBe(false);
  });

  it('cancel() sets cancelled to true', () => {
    scanner.cancel();
    expect(scanner.isCancelled).toBe(true);
  });

  it('getProgress() returns initial progress', () => {
    const progress = scanner.getProgress();
    expect(progress).toEqual({
      scannerType: 'system-junk',
      percent: 0,
      currentPath: '',
      itemsFound: 0,
      bytesFound: 0,
    });
  });

  it('getProgress() returns a copy (not reference)', () => {
    const p1 = scanner.getProgress();
    const p2 = scanner.getProgress();
    expect(p1).toEqual(p2);
    expect(p1).not.toBe(p2);
  });

  it('updateProgress updates progress state', () => {
    scanner.testUpdateProgress({ percent: 50, currentPath: '/test/path' });
    const progress = scanner.getProgress();
    expect(progress.percent).toBe(50);
    expect(progress.currentPath).toBe('/test/path');
  });

  it('updateProgress calls the progress callback', () => {
    const callback = vi.fn();
    scanner.setProgressCallback(callback);
    scanner.testUpdateProgress({ percent: 25, itemsFound: 10 });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ percent: 25, itemsFound: 10 }));
  });

  it('updateProgress does not throw without callback', () => {
    expect(() => {
      scanner.testUpdateProgress({ percent: 50 });
    }).not.toThrow();
  });

  it('scan() returns results', async () => {
    const result: ScanResult = {
      id: 'test-1',
      scannerType: 'system-junk',
      path: '/tmp/test',
      size: 1024,
      modified: Date.now(),
      risk: 'green',
      category: 'Test',
      description: 'Test item',
    };
    scanner.scanResults = [result];
    const results = await scanner.scan();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('test-1');
  });

  it('walkFiles handles non-existent directory gracefully', async () => {
    const entries: FileEntry[] = [];
    for await (const entry of scanner.testWalkFiles('/nonexistent/path/that/does/not/exist')) {
      entries.push(entry);
    }
    expect(entries).toHaveLength(0);
  });

  it('walkFiles stops when cancelled', async () => {
    scanner.cancel();
    const entries: FileEntry[] = [];
    for await (const entry of scanner.testWalkFiles('/tmp')) {
      entries.push(entry);
    }
    expect(entries).toHaveLength(0);
  });
});
