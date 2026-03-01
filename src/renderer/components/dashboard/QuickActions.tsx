import type { ScanResult } from '../../../main/scanners/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface QuickActionsProps {
  allResults: ScanResult[];
  onSelectSafeItems: (ids: string[]) => void;
}

export function QuickActions({ allResults, onSelectSafeItems }: QuickActionsProps) {
  const safeItems = allResults.filter((r) => r.risk === 'green');
  const safeBytes = safeItems.reduce((sum, r) => sum + r.size, 0);

  if (safeItems.length === 0) return null;

  const handleCleanSafe = () => {
    onSelectSafeItems(safeItems.map((r) => r.id));
  };

  return (
    <div className="quick-actions">
      <button className="quick-actions-btn" onClick={handleCleanSafe}>
        <span className="quick-actions-btn-icon">&#x2714;</span>
        <span className="quick-actions-btn-text">
          Select All Safe Items
          <span className="quick-actions-btn-meta">
            {safeItems.length.toLocaleString()} items &middot; {formatBytes(safeBytes)}
          </span>
        </span>
      </button>
    </div>
  );
}
