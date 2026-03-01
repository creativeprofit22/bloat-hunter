import { readdir, access } from 'fs/promises';
import { join } from 'path';
import { resolveEnvVars } from '../rule-engine';
import type { BrowserProfile } from '../types';

/** Internal definition for each supported browser. */
interface BrowserDefinition {
  name: string;
  /** Base User Data directory (may contain %ENV% vars) */
  dataPath: string;
  /** How profiles are organised on disk */
  profileType: 'chromium' | 'firefox' | 'opera';
}

const BROWSERS: BrowserDefinition[] = [
  {
    name: 'Chrome',
    dataPath: '%LOCALAPPDATA%\\Google\\Chrome\\User Data',
    profileType: 'chromium',
  },
  {
    name: 'Edge',
    dataPath: '%LOCALAPPDATA%\\Microsoft\\Edge\\User Data',
    profileType: 'chromium',
  },
  {
    name: 'Brave',
    dataPath: '%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data',
    profileType: 'chromium',
  },
  {
    name: 'Opera',
    dataPath: '%APPDATA%\\Opera Software\\Opera Stable',
    profileType: 'opera',
  },
  {
    name: 'Firefox',
    dataPath: '%APPDATA%\\Mozilla\\Firefox\\Profiles',
    profileType: 'firefox',
  },
];

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find Chromium-style profile directories.
 * Profiles are "Default", "Profile 1", "Profile 2", etc.
 */
async function findChromiumProfiles(dataPath: string): Promise<string[]> {
  const profiles: string[] = [];

  try {
    const entries = await readdir(dataPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'Default' || entry.name.startsWith('Profile ')) {
        const profilePath = join(dataPath, entry.name);
        // Verify it's a real profile (has Preferences or History)
        if (
          (await pathExists(join(profilePath, 'Preferences'))) ||
          (await pathExists(join(profilePath, 'History')))
        ) {
          profiles.push(profilePath);
        }
      }
    }
  } catch {
    // Can't read the directory
  }

  return profiles;
}

/**
 * Find Firefox profile directories.
 * Profiles are named like "abc123.default-release".
 */
async function findFirefoxProfiles(profilesPath: string): Promise<string[]> {
  const profiles: string[] = [];

  try {
    const entries = await readdir(profilesPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const profilePath = join(profilesPath, entry.name);
      if (
        (await pathExists(join(profilePath, 'prefs.js'))) ||
        (await pathExists(join(profilePath, 'places.sqlite')))
      ) {
        profiles.push(profilePath);
      }
    }
  } catch {
    // Can't read the directory
  }

  return profiles;
}

/**
 * Opera uses a single profile at its data path.
 */
async function findOperaProfiles(dataPath: string): Promise<string[]> {
  if (
    (await pathExists(join(dataPath, 'Preferences'))) ||
    (await pathExists(join(dataPath, 'History')))
  ) {
    return [dataPath];
  }
  return [];
}

/**
 * Detect all installed browsers and their profile directories.
 * Returns only browsers that are actually installed on the system.
 */
export async function detectBrowsers(): Promise<BrowserProfile[]> {
  const results: BrowserProfile[] = [];

  for (const browser of BROWSERS) {
    const resolvedPath = resolveEnvVars(browser.dataPath);
    if (!resolvedPath) continue;
    if (!(await pathExists(resolvedPath))) continue;

    let profilePaths: string[];
    switch (browser.profileType) {
      case 'chromium':
        profilePaths = await findChromiumProfiles(resolvedPath);
        break;
      case 'firefox':
        profilePaths = await findFirefoxProfiles(resolvedPath);
        break;
      case 'opera':
        profilePaths = await findOperaProfiles(resolvedPath);
        break;
    }

    for (const profilePath of profilePaths) {
      const profileName =
        browser.profileType === 'opera'
          ? 'Default'
          : (profilePath.split(/[\\/]/).pop() ?? 'Unknown');

      results.push({
        browser: browser.name,
        profileName,
        profilePath,
      });
    }
  }

  return results;
}

/**
 * Check if a browser appears to be running by looking for lock files.
 * Chromium browsers create a "lockfile" in their User Data directory.
 * Firefox creates "parent.lock" in each profile directory.
 */
export async function isBrowserRunning(profile: BrowserProfile): Promise<boolean> {
  // Chromium-based: lockfile is in User Data (parent of profile dir)
  if (['Chrome', 'Edge', 'Brave', 'Opera'].includes(profile.browser)) {
    const userDataDir =
      profile.browser === 'Opera' ? profile.profilePath : join(profile.profilePath, '..');
    return pathExists(join(userDataDir, 'lockfile'));
  }

  // Firefox: parent.lock is in the profile directory
  if (profile.browser === 'Firefox') {
    return pathExists(join(profile.profilePath, 'parent.lock'));
  }

  return false;
}
