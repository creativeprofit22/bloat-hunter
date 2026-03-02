import { randomUUID } from 'crypto';
import { BaseScanner } from '../base-scanner';
import { queryKey, enumSubKeys, keyExists } from './registry-reader';
import type { ScannerConfig, ScanResult, RiskLevel } from '../types';

import mruListRules from './rules/mru-lists.json';
import shellHistoryRules from './rules/shell-history.json';

/** Schema for registry rule JSON entries. */
interface RegistryRule {
  id: string;
  name: string;
  description: string;
  risk: RiskLevel;
  keyPath: string;
  privacyImpact: string;
}

/**
 * Registry Cleanup Scanner — scans Windows registry for MRU lists,
 * shell history, and other privacy-sensitive data that can be cleaned.
 *
 * Features:
 * - Detects MRU (Most Recently Used) lists across Explorer, Office,
 *   Media Player, Paint, WordPad, and common file dialogs
 * - Finds shell history: Run dialog, search terms, address bar, network drives
 * - Reports "privacy impact" instead of file size (registry entries are tiny)
 * - ALWAYS yellow/red risk — never auto-clean without explicit user confirmation
 * - Windows-only: entire scanner is skipped on non-Windows platforms
 *
 * Uses `reg query` via child_process — no native addons required.
 * All operations are strictly read-only.
 */
export class RegistryScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('registry', config);
  }

  async scan(): Promise<ScanResult[]> {
    // Note: this.config.paths is not used — this scanner targets fixed well-known locations

    // Skip entirely on non-Windows platforms
    if (process.platform !== 'win32') {
      this.updateProgress({ percent: 100, phase: 'Skipped (non-Windows)' });
      return [];
    }

    const results: ScanResult[] = [];
    const allRules = [
      ...(mruListRules as RegistryRule[]),
      ...(shellHistoryRules as RegistryRule[]),
    ];

    this.updateProgress({ phase: 'Scanning registry', percent: 0 });

    for (let i = 0; i < allRules.length; i++) {
      if (this.cancelled) break;

      const rule = allRules[i];
      const percent = Math.round(((i + 1) / allRules.length) * 100);

      this.updateProgress({
        percent,
        currentPath: rule.keyPath,
        phase: `Checking ${rule.name}`,
      });

      const result = await this.checkRegistryRule(rule);
      if (result) {
        results.push(result);
        this.updateProgress({
          itemsFound: results.length,
        });
      }
    }

    this.updateProgress({
      percent: 100,
      phase: 'Complete',
      itemsFound: results.length,
      bytesFound: 0,
    });

    return results;
  }

  /**
   * Check a single registry rule: query the key, count values/sub-keys,
   * and produce a ScanResult if the key has content worth reporting.
   */
  private async checkRegistryRule(rule: RegistryRule): Promise<ScanResult | null> {
    // First check if the key exists at all
    const exists = await keyExists(rule.keyPath);
    if (!exists) return null;

    // For keys with sub-keys (like UserAssist, Office, RecentDocs),
    // count sub-keys rather than values
    const subKeys = await enumSubKeys(rule.keyPath);
    const keyInfo = await queryKey(rule.keyPath);

    const valueCount = keyInfo?.values.length ?? 0;
    const subKeyCount = subKeys.length;

    // Skip if there's nothing to report
    const totalItems = valueCount + subKeyCount;
    if (totalItems === 0) return null;

    // Build a meaningful description
    const parts: string[] = [];
    if (valueCount > 0) parts.push(`${valueCount} value${valueCount !== 1 ? 's' : ''}`);
    if (subKeyCount > 0) parts.push(`${subKeyCount} sub-key${subKeyCount !== 1 ? 's' : ''}`);

    return {
      id: randomUUID(),
      scannerType: 'registry',
      path: rule.keyPath,
      size: 0, // Registry entries have negligible size
      modified: 0,
      risk: rule.risk as RiskLevel,
      category: rule.name,
      description: `${rule.description} — ${parts.join(', ')} (${rule.privacyImpact})`,
      ruleId: rule.id,
    };
  }
}
