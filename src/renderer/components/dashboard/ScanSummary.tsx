import type { ScannerType, RiskLevel, ScanResult } from '../../../main/scanners/types';
import type { ScannerState } from '../../store/scan-store';
import { RiskIndicator } from './RiskIndicator';

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

const SCANNER_DESCRIPTIONS: Record<ScannerType, string> = {
  'system-junk': 'Temp files, caches, logs',
  'browser-cache': 'Web browser data',
  duplicates: 'Identical files',
  'big-files': 'Largest files on disk',
  'empty-items': 'Empty folders & zero-byte files',
  'stale-files': 'Untouched for months',
  'app-leftovers': 'Orphaned uninstall data',
  registry: 'MRU lists, shell history',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function countByRisk(results: ScanResult[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { green: 0, yellow: 0, red: 0 };
  for (const r of results) {
    counts[r.risk]++;
  }
  return counts;
}

interface ScanSummaryProps {
  scannerStates: Partial<Record<ScannerType, ScannerState>>;
  onNavigate: (type: ScannerType) => void;
}

export function ScanSummary({ scannerStates, onNavigate }: ScanSummaryProps) {
  const entries = (Object.keys(scannerStates) as ScannerType[]).filter(
    (type) => scannerStates[type] !== undefined,
  );

  if (entries.length === 0) return null;

  return (
    <div className="scan-summary">
      <h3 className="dashboard-section-title">Scan Results</h3>
      <div className="scan-summary-grid">
        {entries.map((type) => {
          const state = scannerStates[type]!;
          const riskCounts = countByRisk(state.results);

          return (
            <button
              key={type}
              className={`scan-summary-card scan-summary-card--${state.status}`}
              onClick={() => onNavigate(type)}
            >
              <div className="scan-summary-card-header">
                <span className="scan-summary-card-title">{SCANNER_LABELS[type]}</span>
                {state.status === 'scanning' && (
                  <span className="scan-summary-card-badge scan-summary-card-badge--scanning">
                    {Math.round(state.progress)}%
                  </span>
                )}
                {state.status === 'error' && (
                  <span className="scan-summary-card-badge scan-summary-card-badge--error">
                    Error
                  </span>
                )}
              </div>

              <p className="scan-summary-card-desc">{SCANNER_DESCRIPTIONS[type]}</p>

              {state.status === 'complete' && (
                <>
                  <div className="scan-summary-card-stats">
                    <span className="scan-summary-card-stat">
                      <span className="scan-summary-card-stat-value">
                        {state.itemsFound.toLocaleString()}
                      </span>
                      <span className="scan-summary-card-stat-label">items</span>
                    </span>
                    <span className="scan-summary-card-stat">
                      <span className="scan-summary-card-stat-value">
                        {formatBytes(state.bytesFound)}
                      </span>
                      <span className="scan-summary-card-stat-label">size</span>
                    </span>
                  </div>

                  <div className="scan-summary-card-risks">
                    {riskCounts.green > 0 && (
                      <RiskIndicator risk="green" count={riskCounts.green} />
                    )}
                    {riskCounts.yellow > 0 && (
                      <RiskIndicator risk="yellow" count={riskCounts.yellow} />
                    )}
                    {riskCounts.red > 0 && <RiskIndicator risk="red" count={riskCounts.red} />}
                  </div>
                </>
              )}

              {state.status === 'scanning' && (
                <div className="scan-summary-card-progress">
                  <div className="scan-summary-card-progress-bar">
                    <div
                      className="scan-summary-card-progress-fill"
                      style={{ width: `${Math.round(state.progress)}%` }}
                    />
                  </div>
                  <span className="scan-summary-card-progress-text">
                    {state.itemsFound.toLocaleString()} found &middot;{' '}
                    {formatBytes(state.bytesFound)}
                  </span>
                </div>
              )}

              {state.status === 'error' && <p className="scan-summary-card-error">{state.error}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
