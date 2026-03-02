import { safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { app } from 'electron';
import path from 'path';

/**
 * Encrypted API key storage using Electron's safeStorage API.
 * Keys are encrypted at rest and only decryptable on the same machine.
 */

interface EncryptedKeys {
  [provider: string]: string; // base64-encoded encrypted data
}

function getKeysPath(): string {
  return path.join(app.getPath('userData'), 'api-keys.enc');
}

function readKeys(): EncryptedKeys {
  const p = getKeysPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as EncryptedKeys;
  } catch {
    return {};
  }
}

function writeKeys(keys: EncryptedKeys): void {
  const dir = path.dirname(getKeysPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(getKeysPath(), JSON.stringify(keys), 'utf-8');
}

export function setApiKey(provider: string, apiKey: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system');
  }

  const keys = readKeys();

  if (apiKey === '') {
    delete keys[provider];
  } else {
    const encrypted = safeStorage.encryptString(apiKey);
    keys[provider] = encrypted.toString('base64');
  }

  writeKeys(keys);
}

export function getApiKey(provider: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return '';
  }

  const keys = readKeys();
  const encoded = keys[provider];
  if (!encoded) return '';

  try {
    const buffer = Buffer.from(encoded, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return '';
  }
}

export function hasApiKey(provider: string): boolean {
  const keys = readKeys();
  if (!(provider in keys)) return false;
  if (!safeStorage.isEncryptionAvailable()) return false;
  try {
    const buffer = Buffer.from(keys[provider], 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return decrypted.length > 0;
  } catch {
    return false;
  }
}
