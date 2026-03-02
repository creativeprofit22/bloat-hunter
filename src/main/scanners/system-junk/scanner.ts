import { randomUUID } from 'crypto';
import { BaseScanner } from '../base-scanner';
import { executeRule } from '../rule-engine';
import type { ScannerConfig, ScanResult, ScanRule } from '../types';

import windowsTempRules from './rules/windows-temp.json';
import windowsCacheRules from './rules/windows-cache.json';
import windowsUpdatesRules from './rules/windows-updates.json';
import windowsLogsRules from './rules/windows-logs.json';
import windowsMiscRules from './rules/windows-misc.json';

const allRules: ScanRule[] = [
  ...(windowsTempRules as ScanRule[]),
  ...(windowsCacheRules as ScanRule[]),
  ...(windowsUpdatesRules as ScanRule[]),
  ...(windowsLogsRules as ScanRule[]),
  ...(windowsMiscRules as ScanRule[]),
];

/**
 * System Junk Scanner — finds Windows temp files, caches, logs,
 * update remnants, and other system junk using JSON-defined rules.
 */
export class SystemJunkScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('system-junk', config);
  }

  async scan(): Promise<ScanResult[]> {
    // Note: this.config.paths is not used — this scanner targets fixed well-known locations
    const results: ScanResult[] = [];
    let totalBytes = 0;

    for (let i = 0; i < allRules.length; i++) {
      if (this.cancelled) break;

      const rule = allRules[i];

      this.updateProgress({
        percent: Math.round((i / allRules.length) * 100),
        phase: rule.name,
      });

      for await (const match of executeRule(rule, () => this.cancelled)) {
        totalBytes += match.size;

        results.push({
          id: randomUUID(),
          scannerType: 'system-junk',
          path: match.path,
          size: match.size,
          modified: match.modified,
          risk: rule.risk,
          category: rule.name,
          description: rule.description,
          ruleId: rule.id,
          isDirectory: match.isDirectory,
        });

        this.updateProgress({
          currentPath: match.path,
          itemsFound: results.length,
          bytesFound: totalBytes,
        });
      }
    }

    this.updateProgress({ percent: 100, phase: 'Complete' });
    return results;
  }
}
