import { useScanStore } from '../../store/scan-store';
import { useUIStore } from '../../store/ui-store';
import { useScanner } from '../../hooks/useScanner';
import type { ScannerType, ScanResult } from '../../../main/scanners/types';
import { SpaceBreakdown } from './SpaceBreakdown';
import { ScanSummary } from './ScanSummary';
import { QuickActions } from './QuickActions';
import { AdvisorPanel } from '../ai/AdvisorPanel';

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

export function Dashboard() {
  const scanners = useScanStore((s) => s.scanners);
  const isAnyScanning = useScanStore((s) => s.isAnyScanning());
  const totalBytes = useScanStore((s) => s.getTotalBytes());
  const setActiveView = useUIStore((s) => s.setActiveView);
  const selectAll = useUIStore((s) => s.selectAll);
  const { startScan } = useScanner();

  // Determine if we have any scan data (scanning, complete, or error)
  const hasAnyData = Object.keys(scanners).length > 0;

  // Collect per-scanner bytes for SpaceBreakdown
  const scannerBytes: Partial<Record<ScannerType, number>> = {};
  for (const [type, state] of Object.entries(scanners)) {
    if (state && state.bytesFound > 0) {
      scannerBytes[type as ScannerType] = state.bytesFound;
    }
  }

  // Collect all results across scanners
  const allResults: ScanResult[] = Object.values(scanners).flatMap((s) => s?.results ?? []);

  const handleScanAll = () => {
    for (const type of ALL_SCANNER_TYPES) {
      startScan(type);
    }
  };

  const handleNavigate = (type: ScannerType) => {
    setActiveView(type);
  };

  const handleSelectSafeItems = (ids: string[]) => {
    selectAll(ids);
  };

  // Before any scan: show CTA
  if (!hasAnyData) {
    return (
      <div className="dashboard">
        <div className="dashboard-cta">
          <div className="dashboard-cta-icon">&#x1F50D;</div>
          <h2 className="dashboard-cta-title">Scan your system</h2>
          <p className="dashboard-cta-text">
            Analyze your disk for recoverable space — temp files, browser caches, duplicates, and
            more.
          </p>
          <button className="dashboard-cta-btn" onClick={handleScanAll}>
            Start Full Scan
          </button>
        </div>
      </div>
    );
  }

  // After scan started or completed: show summary
  return (
    <div className="dashboard">
      {!isAnyScanning && totalBytes > 0 && (
        <SpaceBreakdown scannerBytes={scannerBytes} totalBytes={totalBytes} />
      )}

      <ScanSummary scannerStates={scanners} onNavigate={handleNavigate} />

      {!isAnyScanning && allResults.length > 0 && (
        <QuickActions allResults={allResults} onSelectSafeItems={handleSelectSafeItems} />
      )}

      <AdvisorPanel />
    </div>
  );
}
