import { useScanStore } from '../../store/scan-store';
import { useUIStore } from '../../store/ui-store';
import { useScanner } from '../../hooks/useScanner';
import type { ScannerType } from '../../../main/scanners/types';

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  settings: 'Settings',
  'system-junk': 'System Junk',
  'browser-cache': 'Browser Cache',
  duplicates: 'Duplicates',
  'big-files': 'Big Files',
  'empty-items': 'Empty Items',
  'stale-files': 'Stale Files',
  'app-leftovers': 'App Leftovers',
  registry: 'Registry',
};

const ALL_SCANNER_TYPES: ScannerType[] = [
  'system-junk',
  'browser-cache',
  'duplicates',
  'big-files',
  'empty-items',
  'stale-files',
  'app-leftovers',
  'registry',
];

interface HeaderProps {
  onClean?: () => void;
}

export function Header({ onClean }: HeaderProps) {
  const activeView = useUIStore((s) => s.activeView);
  const isAnyScanning = useScanStore((s) => s.isAnyScanning());
  const selectedCount = useUIStore((s) => s.selectedIds.size);

  // Get overall progress (average of all scanning scanners)
  const scanners = useScanStore((s) => s.scanners);
  const scanningEntries = Object.values(scanners).filter((s) => s?.status === 'scanning');
  const overallProgress =
    scanningEntries.length > 0
      ? scanningEntries.reduce((sum, s) => sum + (s?.progress ?? 0), 0) / scanningEntries.length
      : 0;

  // Get current path being scanned (from any active scanner)
  const currentPath = scanningEntries.find((s) => s?.currentPath)?.currentPath ?? '';

  const { startScan, cancelScan } = useScanner();

  const isScannerView = activeView !== 'dashboard' && activeView !== 'settings';

  const handleScan = () => {
    if (isScannerView) {
      startScan(activeView);
    } else {
      for (const type of ALL_SCANNER_TYPES) {
        startScan(type);
      }
    }
  };

  const handleStop = () => {
    if (isScannerView) {
      cancelScan(activeView);
    } else {
      for (const type of ALL_SCANNER_TYPES) {
        cancelScan(type);
      }
    }
  };

  return (
    <header className="header">
      <div className="header-title-area">
        <h1 className="header-title">{VIEW_LABELS[activeView] ?? 'Bloat Hunter'}</h1>
      </div>

      <div className="header-actions">
        {!isAnyScanning ? (
          <button className="header-btn header-btn--scan" onClick={handleScan}>
            Scan
          </button>
        ) : (
          <button className="header-btn header-btn--stop" onClick={handleStop}>
            Stop
          </button>
        )}

        <button
          className="header-btn header-btn--clean"
          disabled={selectedCount === 0}
          onClick={onClean}
        >
          Clean ({selectedCount})
        </button>
      </div>

      {isAnyScanning && (
        <div className="header-progress">
          <div className="header-progress-bar">
            <div
              className="header-progress-fill"
              style={{ width: `${Math.round(overallProgress)}%` }}
            />
          </div>
          <span className="header-progress-text">
            {Math.round(overallProgress)}%
            {currentPath && (
              <span className="header-progress-path" title={currentPath}>
                {' '}
                &mdash; {currentPath}
              </span>
            )}
          </span>
        </div>
      )}
    </header>
  );
}
