import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** A single registry value entry. */
interface RegistryValue {
  /** Value name (empty string = default value) */
  name: string;
  /** Registry value type (REG_SZ, REG_DWORD, REG_BINARY, etc.) */
  type: string;
  /** Raw string representation of the value data */
  data: string;
}

/** Information about a single registry key. */
interface RegistryKeyInfo {
  /** Full registry key path */
  keyPath: string;
  /** Values contained in this key */
  values: RegistryValue[];
  /** Number of sub-keys (from enumeration) */
  subKeyCount: number;
  /** Names of sub-keys */
  subKeys: string[];
}

/**
 * Safe, read-only Windows registry reader using `reg query` via child_process.
 * No native addons or third-party packages required.
 *
 * All operations are read-only — this module never writes to the registry.
 * Returns null/empty results on non-Windows platforms instead of throwing.
 */

const IS_WINDOWS = process.platform === 'win32';

/**
 * Query a registry key and return its values.
 * Returns null if the key does not exist or cannot be read.
 */
export async function queryKey(keyPath: string): Promise<RegistryKeyInfo | null> {
  if (!IS_WINDOWS) return null;

  try {
    const { stdout } = await execFileAsync('reg', ['query', keyPath], {
      windowsHide: true,
      timeout: 10000,
    });

    return parseRegQueryOutput(keyPath, stdout);
  } catch {
    // Key doesn't exist or access denied
    return null;
  }
}

/**
 * Enumerate sub-keys of a registry key.
 * Returns an empty array if the key does not exist.
 */
export async function enumSubKeys(keyPath: string): Promise<string[]> {
  if (!IS_WINDOWS) return [];

  try {
    const { stdout } = await execFileAsync('reg', ['query', keyPath], {
      windowsHide: true,
      timeout: 10000,
    });

    const subKeys: string[] = [];
    const keyPathUpper = keyPath.toUpperCase();

    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Sub-key lines start with the parent key path + backslash
      // and do NOT contain REG_ (which would indicate a value line)
      if (trimmed.toUpperCase().startsWith(keyPathUpper + '\\') && !trimmed.includes('REG_')) {
        subKeys.push(trimmed);
      }
    }

    return subKeys;
  } catch {
    return [];
  }
}

/**
 * Check if a registry key exists.
 */
export async function keyExists(keyPath: string): Promise<boolean> {
  if (!IS_WINDOWS) return false;

  try {
    await execFileAsync('reg', ['query', keyPath, '/ve'], {
      windowsHide: true,
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse the text output of `reg query` into structured data.
 *
 * Example reg query output:
 * ```
 * HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Explorer\RunMRU
 *     a    REG_SZ    notepad\1
 *     b    REG_SZ    calc\1
 *     MRUList    REG_SZ    ba
 * ```
 */
function parseRegQueryOutput(keyPath: string, stdout: string): RegistryKeyInfo {
  const values: RegistryValue[] = [];
  const subKeys: string[] = [];
  const keyPathUpper = keyPath.toUpperCase();

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Value lines are indented and contain REG_ type
    const valueMatch = trimmed.match(/^(.+?)\s+(REG_\w+)\s+(.*)/);
    if (valueMatch) {
      values.push({
        name: valueMatch[1].trim(),
        type: valueMatch[2],
        data: valueMatch[3].trim(),
      });
      continue;
    }

    // Sub-key lines are full paths that extend the parent key
    if (
      trimmed.toUpperCase().startsWith(keyPathUpper + '\\') &&
      trimmed.toUpperCase() !== keyPathUpper
    ) {
      subKeys.push(trimmed);
    }
  }

  return {
    keyPath,
    values,
    subKeyCount: subKeys.length,
    subKeys,
  };
}
