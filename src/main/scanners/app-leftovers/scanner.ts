import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { readdir, stat, readlink } from 'fs/promises';
import { basename, join } from 'path';
import { promisify } from 'util';
import { BaseScanner } from '../base-scanner';
import { executeRule, resolveEnvVars, calculateDirSize } from '../rule-engine';
import type { ScannerConfig, ScanResult, ScanRule } from '../types';

import commonLeftovers from './rules/common-leftovers.json';

const execAsync = promisify(exec);

/** Well-known Windows folders that should never be flagged as orphans. */
const SYSTEM_FOLDERS = new Set([
  'microsoft',
  'windows',
  'packages',
  'connecteddevicesplatform',
  'comms',
  'crdownload',
  'desktop',
  'd3dscache',
  'defaultaccount',
  'identitycrl',
  'intelhaxm',
  'lxss',
  'playlists',
  'publishers',
  'sun',
  'temp',
  'vclibs',
  'windowsapps',
]);

/**
 * Fetch the set of installed application display names from the Windows
 * registry Uninstall keys. Returns lowercase names for case-insensitive matching.
 */
async function getInstalledPrograms(): Promise<Set<string>> {
  const programs = new Set<string>();

  const regPaths = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ];

  for (const regPath of regPaths) {
    try {
      const { stdout } = await execAsync(`reg query "${regPath}" /s /v DisplayName`, {
        windowsHide: true,
        timeout: 15000,
      });

      // Parse "reg query" output lines like:
      //     DisplayName    REG_SZ    Application Name
      for (const line of stdout.split('\n')) {
        const match = line.match(/DisplayName\s+REG_SZ\s+(.+)/i);
        if (match?.[1]) {
          programs.add(match[1].trim().toLowerCase());
        }
      }
    } catch {
      // Registry path doesn't exist or access denied — skip
    }
  }

  return programs;
}

/**
 * Check whether a folder name matches any installed program (fuzzy).
 * Compares the folder name against all installed program display names.
 */
function isInstalledApp(folderName: string, installedPrograms: Set<string>): boolean {
  const lower = folderName.toLowerCase();

  // Direct match
  if (installedPrograms.has(lower)) return true;

  // Check if any installed program name contains the folder name or vice versa
  for (const program of installedPrograms) {
    if (program.includes(lower) || lower.includes(program.split(' ')[0])) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve a .lnk shortcut target on Windows using PowerShell.
 * Returns the target path or null if it cannot be resolved.
 */
async function resolveShortcutTarget(lnkPath: string): Promise<string | null> {
  try {
    // Use PowerShell COM object to read .lnk target
    const escaped = lnkPath.replace(/'/g, "''");
    const { stdout } = await execAsync(
      `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).CreateShortcut('${escaped}').TargetPath"`,
      { windowsHide: true, timeout: 5000 },
    );
    const target = stdout.trim();
    return target || null;
  } catch {
    return null;
  }
}

/**
 * App Leftovers Scanner — finds orphaned application data from uninstalled
 * programs by cross-referencing folder names in common app data locations
 * against the Windows registry's installed programs list.
 *
 * Also detects:
 * - Broken Start Menu shortcuts pointing to nonexistent executables
 * - Leftover installer files in temp directories
 * - Empty folders in app data locations from uninstalled apps
 */
export class AppLeftoversScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('app-leftovers', config);
  }

  async scan(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    let totalBytes = 0;

    // Phase 1: Fetch installed programs from registry
    this.updateProgress({ phase: 'Reading installed programs', percent: 0 });
    const installedPrograms = await getInstalledPrograms();

    if (this.cancelled) return results;

    // Phase 2: Scan orphan folders in AppData/LocalAppData/ProgramData
    this.updateProgress({ phase: 'Scanning for orphaned app folders', percent: 10 });
    const orphanResults = await this.findOrphanFolders(installedPrograms);
    for (const result of orphanResults) {
      totalBytes += result.size;
      results.push(result);
    }

    if (this.cancelled) return results;

    // Phase 3: Find broken Start Menu shortcuts
    this.updateProgress({
      phase: 'Checking Start Menu shortcuts',
      percent: 60,
      itemsFound: results.length,
      bytesFound: totalBytes,
    });
    const brokenShortcuts = await this.findBrokenShortcuts();
    for (const result of brokenShortcuts) {
      totalBytes += result.size;
      results.push(result);
    }

    if (this.cancelled) return results;

    // Phase 4: Find leftover installer files via rules
    this.updateProgress({
      phase: 'Scanning for leftover installers',
      percent: 80,
      itemsFound: results.length,
      bytesFound: totalBytes,
    });
    const installerResults = await this.findLeftoverInstallers();
    for (const result of installerResults) {
      totalBytes += result.size;
      results.push(result);
    }

    this.updateProgress({
      percent: 100,
      phase: 'Complete',
      itemsFound: results.length,
      bytesFound: totalBytes,
    });

    return results;
  }

  /**
   * Scan AppData, LocalAppData, and ProgramData for folders that don't
   * match any currently installed program.
   */
  private async findOrphanFolders(installedPrograms: Set<string>): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    const appDataDirs = [
      resolveEnvVars('%APPDATA%'),
      resolveEnvVars('%LOCALAPPDATA%'),
      resolveEnvVars('%PROGRAMDATA%'),
    ].filter((d): d is string => d !== null);

    for (let i = 0; i < appDataDirs.length; i++) {
      if (this.cancelled) break;

      const appDataDir = appDataDirs[i];

      this.updateProgress({
        percent: 10 + Math.round((i / appDataDirs.length) * 50),
        currentPath: appDataDir,
      });

      let entries;
      try {
        entries = await readdir(appDataDir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (this.cancelled) break;
        if (!entry.isDirectory()) continue;

        const folderName = entry.name;
        const folderPath = join(appDataDir, folderName);

        // Skip well-known system folders
        if (SYSTEM_FOLDERS.has(folderName.toLowerCase())) continue;

        // Skip if matches an installed program
        if (isInstalledApp(folderName, installedPrograms)) continue;

        // Calculate folder size
        const dirSize = await calculateDirSize(folderPath, () => this.cancelled, 5);

        // Only report folders with some content (skip tiny config-only folders)
        if (dirSize < 1024) continue;

        results.push({
          id: randomUUID(),
          scannerType: 'app-leftovers',
          path: folderPath,
          size: dirSize,
          modified: 0,
          risk: 'yellow',
          category: 'Orphaned App Data',
          description: `${folderName} — app data folder with no matching installed program`,
          isDirectory: true,
        });

        this.updateProgress({
          currentPath: folderPath,
          itemsFound: results.length,
          bytesFound: results.reduce((sum, r) => sum + r.size, 0),
        });
      }
    }

    return results;
  }

  /**
   * Find Start Menu shortcuts (.lnk files) that point to executables
   * that no longer exist on disk.
   */
  private async findBrokenShortcuts(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    // Use the shortcut rules from common-leftovers.json
    const shortcutRule = (commonLeftovers as ScanRule[]).find(
      (r) => r.id === 'app-leftovers.startmenu-broken',
    );
    if (!shortcutRule) return results;

    for await (const match of executeRule(shortcutRule, () => this.cancelled)) {
      if (this.cancelled) break;
      if (match.isDirectory) continue;

      // Resolve the shortcut target and check if it exists
      const target = await resolveShortcutTarget(match.path);
      if (!target) continue;

      let targetExists = true;
      try {
        await stat(target);
      } catch {
        targetExists = false;
      }

      // Also try readlink for symlink-style shortcuts
      if (targetExists) {
        try {
          await readlink(match.path);
        } catch {
          // Not a symlink, that's fine
        }
        continue; // Target exists — shortcut is valid
      }

      results.push({
        id: randomUUID(),
        scannerType: 'app-leftovers',
        path: match.path,
        size: match.size,
        modified: match.modified,
        risk: 'green',
        category: 'Broken Shortcuts',
        description: `${basename(match.path)} — shortcut target no longer exists: ${target}`,
      });
    }

    return results;
  }

  /**
   * Find leftover installer files (.msi, .exe) in temp and downloads
   * using the common-leftovers rule.
   */
  private async findLeftoverInstallers(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    const installerRule = (commonLeftovers as ScanRule[]).find(
      (r) => r.id === 'app-leftovers.temp-installers',
    );
    if (!installerRule) return results;

    for await (const match of executeRule(installerRule, () => this.cancelled)) {
      if (this.cancelled) break;
      if (match.isDirectory) continue;

      results.push({
        id: randomUUID(),
        scannerType: 'app-leftovers',
        path: match.path,
        size: match.size,
        modified: match.modified,
        risk: 'green',
        category: 'Leftover Installers',
        description: `${basename(match.path)} — installer file left behind after installation`,
      });
    }

    return results;
  }
}
