import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { XXHashAPI } from 'xxhash-wasm';

/**
 * Streaming file hasher — uses xxhash-wasm for speed, with crypto SHA-256
 * as a fallback if WASM initialization fails.
 *
 * xxhash-wasm is initialized once on first use and the instance is reused
 * for all subsequent hashing operations.
 */

let xxhashInstance: XXHashAPI | null = null;
let xxhashFailed = false;

/** Initialize xxhash-wasm once, reuse forever. */
async function getXXHash(): Promise<XXHashAPI | null> {
  if (xxhashFailed) return null;
  if (xxhashInstance) return xxhashInstance;

  try {
    const xxhash = await import('xxhash-wasm');
    xxhashInstance = await xxhash.default();
    return xxhashInstance;
  } catch {
    xxhashFailed = true;
    return null;
  }
}

/**
 * Hash an entire file using streaming reads.
 * Prefers xxhash64 for speed; falls back to SHA-256.
 */
export async function hashFile(filePath: string): Promise<string> {
  const xx = await getXXHash();
  if (xx) {
    return hashFileXXHash(filePath, xx);
  }
  return hashFileCrypto(filePath);
}

/**
 * Hash the first N bytes of a file (prehash stage).
 * Fast early-rejection of non-duplicates before doing a full hash.
 */
export async function hashFilePartial(filePath: string, bytes = 4096): Promise<string> {
  const xx = await getXXHash();
  if (xx) {
    return hashFileXXHashPartial(filePath, xx, bytes);
  }
  return hashFileCryptoPartial(filePath, bytes);
}

// ── xxhash-wasm implementations ──────────────────────────────────────

async function hashFileXXHash(filePath: string, xx: XXHashAPI): Promise<string> {
  const hasher = xx.create64();
  const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });

  for await (const chunk of stream) {
    hasher.update(chunk as Buffer);
  }

  return hasher.digest().toString(16);
}

async function hashFileXXHashPartial(
  filePath: string,
  xx: XXHashAPI,
  bytes: number,
): Promise<string> {
  const hasher = xx.create64();
  const stream = createReadStream(filePath, { start: 0, end: bytes - 1 });

  for await (const chunk of stream) {
    hasher.update(chunk as Buffer);
  }

  return hasher.digest().toString(16);
}

// ── crypto SHA-256 fallback ──────────────────────────────────────────

async function hashFileCrypto(filePath: string): Promise<string> {
  const hasher = createHash('sha256');
  await pipeline(createReadStream(filePath, { highWaterMark: 1024 * 1024 }), hasher);
  return hasher.digest('hex');
}

async function hashFileCryptoPartial(filePath: string, bytes: number): Promise<string> {
  const hasher = createHash('sha256');
  await pipeline(createReadStream(filePath, { start: 0, end: bytes - 1 }), hasher);
  return hasher.digest('hex');
}
