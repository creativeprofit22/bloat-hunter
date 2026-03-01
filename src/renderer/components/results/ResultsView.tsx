import { useScanStore } from '../../store/scan-store';
import { useUIStore, type ActiveView } from '../../store/ui-store';
import { useScanner } from '../../hooks/useScanner';
import type { ScannerType } from '../../../main/scanners/types';
import { ResultsTable } from './ResultsTable';

const VIEW_LABELS: Record<ScannerType, string> = {
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

interface ResultsViewProps {
  scannerType: ScannerType;
}

export function ResultsView({ scannerType }: ResultsViewProps) {
  const scanner = useScanStore((s) => s.getScanner(scannerType));
  const { startScan } = useScanner();
  const setActiveView = useUIStore((s) => s.setActiveView);

  const label = VIEW_LABELS[scannerType];

  // Scanner hasn't been run yet
  if (scanner.status === 'idle') {
    return (
      <div className="results-view">
        <div className="results-view-empty">
          <p className="results-view-empty-title">No {label} results yet</p>
          <p className="results-view-empty-text">Run a scan to find items in this category.</p>
          <button className="results-view-scan-btn" onClick={() => startScan(scannerType)}>
            Scan {label}
          </button>
        </div>
      </div>
    );
  }

  // Scanner is running
  if (scanner.status === 'scanning') {
    return (
      <div className="results-view">
        <div className="results-view-scanning">
          <div className="results-view-scanning-bar">
            <div
              className="results-view-scanning-fill"
              style={{ width: `${Math.round(scanner.progress)}%` }}
            />
          </div>
          <p className="results-view-scanning-text">
            Scanning{scanner.phase ? ` — ${scanner.phase}` : ''}... {Math.round(scanner.progress)}%
          </p>
          <p className="results-view-scanning-meta">
            {scanner.itemsFound.toLocaleString()} items found &middot;{' '}
            {formatBytes(scanner.bytesFound)}
          </p>
          {scanner.currentPath && (
            <p className="results-view-scanning-path" title={scanner.currentPath}>
              {scanner.currentPath}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Scanner errored
  if (scanner.status === 'error') {
    return (
      <div className="results-view">
        <div className="results-view-error">
          <p className="results-view-error-title">Scan Error</p>
          <p className="results-view-error-text">{scanner.error}</p>
          <button className="results-view-scan-btn" onClick={() => startScan(scannerType)}>
            Retry Scan
          </button>
        </div>
      </div>
    );
  }

  // Scanner complete: show results
  return (
    <div className="results-view">
      <div className="results-view-summary">
        <button
          className="results-view-back"
          onClick={() => setActiveView('dashboard' as ActiveView)}
        >
          &larr; Dashboard
        </button>
        <span className="results-view-stats">
          {scanner.results.length.toLocaleString()} items &middot; {formatBytes(scanner.bytesFound)}
        </span>
      </div>

      <ResultsTable results={scanner.results} />
    </div>
  );
}
