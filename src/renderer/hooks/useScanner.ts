import { useEffect, useCallback } from 'react';
import { useScanStore } from '../store/scan-store';
import { useSettingsStore } from '../store/settings-store';
import type {
  ScannerType,
  ScanProgress,
  ScanResult,
  ScannerConfig,
} from '../../main/scanners/types';

interface ScanResultPayload {
  scannerType: ScannerType;
  results: ScanResult[];
}

interface ScanErrorPayload {
  scannerType: ScannerType;
  error: string;
}

interface ScanCancelledPayload {
  scannerType: ScannerType;
}

/**
 * Hook that bridges the Electron IPC scanner events to the Zustand scan store.
 * Mount this once at the app level to set up event listeners.
 */
export function useScanner() {
  const {
    startScan: markStarted,
    updateProgress,
    setResults,
    setError,
    setCancelled,
  } = useScanStore();

  // Subscribe to IPC events on mount, clean up on unmount
  useEffect(() => {
    const api = window.electronAPI;

    const unsubProgress = api.onScanProgress((data) => {
      if (typeof data !== 'object' || data === null) return;
      updateProgress(data as ScanProgress);
    });

    const unsubResult = api.onScanResult((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanResultPayload;
      setResults(payload.scannerType, payload.results);
    });

    const unsubError = api.onScanError((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanErrorPayload;
      setError(payload.scannerType, payload.error);
    });

    const unsubCancelled = api.onScanCancelled((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanCancelledPayload;
      setCancelled(payload.scannerType);
    });

    return () => {
      unsubProgress();
      unsubResult();
      unsubError();
      unsubCancelled();
    };
  }, [updateProgress, setResults, setError, setCancelled]);

  const scanPaths = useSettingsStore((s) => s.scanPaths);
  const exclusions = useSettingsStore((s) => s.exclusions);
  const maxDepth = useSettingsStore((s) => s.maxDepth);
  const minSize = useSettingsStore((s) => s.minSize);
  const staleMonths = useSettingsStore((s) => s.staleMonths);
  const topN = useSettingsStore((s) => s.topN);

  /** Start a scan for the given scanner type */
  const startScan = useCallback(
    (scannerType: ScannerType) => {
      const config: ScannerConfig = {
        paths: scanPaths,
        exclusions,
        maxDepth,
        minSize: minSize > 0 ? minSize : undefined,
        staleMonths,
        topN,
      };

      markStarted(scannerType);
      window.electronAPI.startScan(scannerType, config);
    },
    [markStarted, scanPaths, exclusions, maxDepth, minSize, staleMonths, topN],
  );

  /** Cancel a running scan */
  const cancelScan = useCallback((scannerType: ScannerType) => {
    window.electronAPI.cancelScan(scannerType);
  }, []);

  return { startScan, cancelScan };
}
