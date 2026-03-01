import { randomUUID } from 'crypto';
import { BaseScanner } from '../base-scanner';
import { executeRule } from '../rule-engine';
import { detectBrowsers, isBrowserRunning } from './browser-detector';
import type { ScannerConfig, ScanResult, ScanRule, RulePath, BrowserProfile } from '../types';

import chromeRules from './rules/chrome.json';
import edgeRules from './rules/edge.json';
import firefoxRules from './rules/firefox.json';
import braveRules from './rules/brave.json';
import operaRules from './rules/opera.json';

/** Map browser names to their rule sets. */
const BROWSER_RULES: Record<string, ScanRule[]> = {
  Chrome: chromeRules as ScanRule[],
  Edge: edgeRules as ScanRule[],
  Firefox: firefoxRules as ScanRule[],
  Brave: braveRules as ScanRule[],
  Opera: operaRules as ScanRule[],
};

/**
 * Replace $$PROFILE$$ in rule paths with the actual profile directory.
 * Returns a deep-cloned rule with resolved paths.
 */
function resolveProfilePaths(rule: ScanRule, profilePath: string): ScanRule {
  return {
    ...rule,
    paths: rule.paths.map(
      (rp): RulePath => ({
        ...rp,
        path: rp.path.replace(/\$\$PROFILE\$\$/g, profilePath),
      }),
    ),
  };
}

/**
 * Browser Cache Scanner — finds caches, cookies, history, session data,
 * and DOM storage for all detected browsers using JSON-defined rules.
 *
 * Auto-detects installed browsers and their profile directories.
 * Skips rules for browsers that are not installed.
 * Warns when a browser appears to be actively running (files may be locked).
 */
export class BrowserCacheScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super('browser-cache', config);
  }

  async scan(): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    let totalBytes = 0;

    // Phase 1: Detect installed browsers
    this.updateProgress({ phase: 'Detecting browsers', percent: 0 });
    const profiles = await detectBrowsers();

    if (profiles.length === 0) {
      this.updateProgress({ percent: 100, phase: 'No browsers detected' });
      return results;
    }

    // Build the work list: each (profile, rule) pair to execute
    const workItems: { profile: BrowserProfile; rule: ScanRule; running: boolean }[] = [];

    for (const profile of profiles) {
      if (this.cancelled) break;

      const rules = BROWSER_RULES[profile.browser];
      if (!rules) continue;

      const running = await isBrowserRunning(profile);

      for (const rule of rules) {
        workItems.push({ profile, rule, running });
      }
    }

    // Phase 2: Execute rules per profile
    for (let i = 0; i < workItems.length; i++) {
      if (this.cancelled) break;

      const { profile, rule, running } = workItems[i];
      const resolvedRule = resolveProfilePaths(rule, profile.profilePath);
      const categoryLabel = `${profile.browser} (${profile.profileName})`;

      this.updateProgress({
        percent: Math.round((i / workItems.length) * 100),
        phase: `${categoryLabel}: ${rule.name}`,
      });

      for await (const match of executeRule(resolvedRule, () => this.cancelled)) {
        totalBytes += match.size;

        const description = running
          ? `${rule.description} ⚠ Browser is running — files may be locked`
          : rule.description;

        results.push({
          id: randomUUID(),
          scannerType: 'browser-cache',
          path: match.path,
          size: match.size,
          modified: match.modified,
          risk: rule.risk,
          category: `${categoryLabel}: ${rule.name}`,
          description,
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
