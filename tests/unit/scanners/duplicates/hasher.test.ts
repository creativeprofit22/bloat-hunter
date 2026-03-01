// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

// Reset the module state between tests so xxhash-wasm gets re-initialized
let hashFile: typeof import('../../../../src/main/scanners/duplicates/hasher').hashFile;
let hashFilePartial: typeof import('../../../../src/main/scanners/duplicates/hasher').hashFilePartial;

const testDir = join(tmpdir(), 'bloat-hunter-hasher-test-' + Date.now());

describe('Hasher', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../../../src/main/scanners/duplicates/hasher');
    hashFile = mod.hashFile;
    hashFilePartial = mod.hashFilePartial;
  });

  // Set up test directory
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  // Clean up after all tests
  afterAll(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('hashFile returns a non-empty string', async () => {
    const filePath = join(testDir, 'test-hash.txt');
    writeFileSync(filePath, 'hello world');

    const hash = await hashFile(filePath);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('hashFile returns same hash for identical content', async () => {
    const file1 = join(testDir, 'identical-1.txt');
    const file2 = join(testDir, 'identical-2.txt');
    writeFileSync(file1, 'identical content');
    writeFileSync(file2, 'identical content');

    const hash1 = await hashFile(file1);
    const hash2 = await hashFile(file2);
    expect(hash1).toBe(hash2);
  });

  it('hashFile returns different hash for different content', async () => {
    const file1 = join(testDir, 'diff-1.txt');
    const file2 = join(testDir, 'diff-2.txt');
    writeFileSync(file1, 'content A');
    writeFileSync(file2, 'content B');

    const hash1 = await hashFile(file1);
    const hash2 = await hashFile(file2);
    expect(hash1).not.toBe(hash2);
  });

  it('hashFilePartial returns a non-empty string', async () => {
    const filePath = join(testDir, 'test-partial.txt');
    writeFileSync(filePath, 'hello world partial hash');

    const hash = await hashFilePartial(filePath);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('hashFilePartial same result for files sharing first 4KB', async () => {
    const shared = 'A'.repeat(4096);
    const file1 = join(testDir, 'partial-1.txt');
    const file2 = join(testDir, 'partial-2.txt');
    writeFileSync(file1, shared + 'extra-1');
    writeFileSync(file2, shared + 'extra-2');

    const hash1 = await hashFilePartial(file1);
    const hash2 = await hashFilePartial(file2);
    expect(hash1).toBe(hash2);
  });

  it('hashFile throws for non-existent file', async () => {
    await expect(hashFile(join(testDir, 'nonexistent.txt'))).rejects.toThrow();
  });

  it('hashFilePartial throws for non-existent file', async () => {
    await expect(hashFilePartial(join(testDir, 'nonexistent.txt'))).rejects.toThrow();
  });

  it('hashFile handles empty file', async () => {
    const filePath = join(testDir, 'empty.txt');
    writeFileSync(filePath, '');

    const hash = await hashFile(filePath);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});
