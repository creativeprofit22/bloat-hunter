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
      updateProgress(data as ScanProgress);
    });

    const unsubResult = api.onScanResult((data) => {
      const payload = data as ScanResultPayload;
      setResults(payload.scannerType, payload.results);
    });

    const unsubError = api.onScanError((data) => {
      const payload = data as ScanErrorPayload;
      setError(payload.scannerType, payload.error);
    });

    const unsubCancelled = api.onScanCancelled((data) => {
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

  const settingsStore = useSettingsStore();

  /** Start a scan for the given scanner type */
  const startScan = useCallback(
    (scannerType: ScannerType) => {
      const config: ScannerConfig = {
        paths: settingsStore.scanPaths,
        exclusions: settingsStore.exclusions,
        maxDepth: settingsStore.maxDepth,
        minSize: settingsStore.minSize > 0 ? settingsStore.minSize : undefined,
        staleMonths: settingsStore.staleMonths,
        topN: settingsStore.topN,
      };

      markStarted(scannerType);
      window.electronAPI.startScan(scannerType, config);
    },
    [markStarted, settingsStore],
  );

  /** Cancel a running scan */
  const cancelScan = useCallback((scannerType: ScannerType) => {
    window.electronAPI.cancelScan(scannerType);
  }, []);

  return { startScan, cancelScan };
}
