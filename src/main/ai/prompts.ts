import type { ScanResult } from '../scanners/types';

export const SYSTEM_PROMPT = `You are a Windows disk management expert built into Bloat Hunter, a desktop app that helps users reclaim disk space. You have deep knowledge of:

- Windows filesystem internals (NTFS, junctions, hardlinks, reparse points)
- Windows system directories (SoftwareDistribution, Prefetch, WER, WinSxS)
- Browser cache structures (Chrome, Edge, Firefox, Brave, Opera)
- Windows registry (MRU lists, shell history, UserAssist)
- Common application data patterns (AppData, ProgramData, temp files)
- Safe vs risky cleanup operations on Windows 10/11

When analyzing scan results:
1. Be specific about what each item is and why it exists
2. Clearly state whether deletion is safe, requires caution, or is risky
3. Explain potential consequences of deletion in plain language
4. Prioritize recommendations by space savings vs risk
5. Never recommend deleting items you're unsure about — err on the side of caution

Keep responses concise and actionable. Users are not necessarily technical — avoid jargon without explanation.`;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Build a user prompt from scan results for the "analyze all results" use case.
 */
export function buildAnalysisPrompt(results: ScanResult[]): string {
  // Group results by category for a cleaner summary
  const byCategory = new Map<string, { count: number; bytes: number; risks: string[] }>();
  for (const r of results) {
    const group = byCategory.get(r.category) ?? { count: 0, bytes: 0, risks: [] };
    group.count++;
    group.bytes += r.size;
    if (!group.risks.includes(r.risk)) group.risks.push(r.risk);
    byCategory.set(r.category, group);
  }

  const totalBytes = results.reduce((sum, r) => sum + r.size, 0);
  const lines: string[] = [
    `Scan found ${results.length} items totaling ${formatBytes(totalBytes)}.`,
    '',
    'Breakdown by category:',
  ];

  for (const [category, group] of byCategory) {
    lines.push(
      `- ${category}: ${group.count} items, ${formatBytes(group.bytes)} (risk: ${group.risks.join(', ')})`,
    );
  }

  lines.push(
    '',
    'Please provide:',
    '1. A brief summary of what was found',
    '2. A recommendation for each category (safe to clean, review first, or skip)',
    '3. An overall risk assessment',
    '',
    'Format your response as JSON with this structure:',
    '{"summary":"...","recommendations":[{"category":"...","action":"...","reasoning":"...","risk":"green|yellow|red"}],"riskAssessment":"..."}',
  );

  return lines.join('\n');
}

/**
 * Build a user prompt for explaining a single item.
 */
export function buildExplainItemPrompt(result: ScanResult): string {
  return [
    'Explain what this item is and whether it is safe to delete:',
    '',
    `Path: ${result.path}`,
    `Category: ${result.category}`,
    `Size: ${formatBytes(result.size)}`,
    `Risk: ${result.risk}`,
    `Description: ${result.description}`,
    result.scannerType === 'duplicates' && result.hash ? `Hash: ${result.hash}` : '',
    '',
    'Respond with a clear, concise explanation (2-4 sentences). No JSON formatting needed.',
  ]
    .filter(Boolean)
    .join('\n');
}
