import type { ScannerType } from '../../../main/scanners/types';

interface CategoryData {
  type: ScannerType;
  label: string;
  bytes: number;
  color: string;
}

const SCANNER_COLORS: Record<ScannerType, string> = {
  'system-junk': '#6366f1',
  'browser-cache': '#8b5cf6',
  duplicates: '#ec4899',
  'big-files': '#f97316',
  'empty-items': '#06b6d4',
  'stale-files': '#eab308',
  'app-leftovers': '#22c55e',
  registry: '#64748b',
};

const SCANNER_LABELS: Record<ScannerType, string> = {
  'system-junk': 'System Junk',
  'browser-cache': 'Browser Cache',
  duplicates: 'Duplicates',
  'big-files': 'Big Files',
  'empty-items': 'Empty Items',
  'stale-files': 'Stale Files',
  'app-leftovers': 'App Leftovers',
  registry: 'Registry',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface SpaceBreakdownProps {
  scannerBytes: Partial<Record<ScannerType, number>>;
  totalBytes: number;
}

export function SpaceBreakdown({ scannerBytes, totalBytes }: SpaceBreakdownProps) {
  const categories: CategoryData[] = (Object.keys(scannerBytes) as ScannerType[])
    .filter((type) => (scannerBytes[type] ?? 0) > 0)
    .sort((a, b) => (scannerBytes[b] ?? 0) - (scannerBytes[a] ?? 0))
    .map((type) => ({
      type,
      label: SCANNER_LABELS[type],
      bytes: scannerBytes[type] ?? 0,
      color: SCANNER_COLORS[type],
    }));

  if (categories.length === 0) return null;

  return (
    <div className="space-breakdown">
      <h3 className="dashboard-section-title">Space Breakdown</h3>

      <div className="space-breakdown-total">
        <span className="space-breakdown-total-value">{formatBytes(totalBytes)}</span>
        <span className="space-breakdown-total-label">recoverable</span>
      </div>

      <div className="space-breakdown-bar">
        {categories.map((cat) => {
          const percent = totalBytes > 0 ? (cat.bytes / totalBytes) * 100 : 0;
          if (percent < 0.5) return null;
          return (
            <div
              key={cat.type}
              className="space-breakdown-segment"
              style={{ width: `${percent}%`, background: cat.color }}
              title={`${cat.label}: ${formatBytes(cat.bytes)}`}
            />
          );
        })}
      </div>

      <div className="space-breakdown-legend">
        {categories.map((cat) => (
          <div key={cat.type} className="space-breakdown-legend-item">
            <span className="space-breakdown-legend-dot" style={{ background: cat.color }} />
            <span className="space-breakdown-legend-label">{cat.label}</span>
            <span className="space-breakdown-legend-value">{formatBytes(cat.bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
