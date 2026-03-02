import { useEffect, useCallback, useRef } from 'react';
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

  // Keep refs pointing to the latest store functions so the IPC effect
  // doesn't need to re-register listeners when store references change.
  const updateProgressRef = useRef(updateProgress);
  const setResultsRef = useRef(setResults);
  const setErrorRef = useRef(setError);
  const setCancelledRef = useRef(setCancelled);

  useEffect(() => {
    updateProgressRef.current = updateProgress;
    setResultsRef.current = setResults;
    setErrorRef.current = setError;
    setCancelledRef.current = setCancelled;
  });

  // Subscribe to IPC events once on mount, clean up on unmount.
  // Using refs avoids re-subscribing during StrictMode's unmount-remount cycle.
  useEffect(() => {
    const api = window.electronAPI;

    const unsubProgress = api.onScanProgress((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      updateProgressRef.current(data as ScanProgress);
    });

    const unsubResult = api.onScanResult((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanResultPayload;
      setResultsRef.current(payload.scannerType, payload.results);
    });

    const unsubError = api.onScanError((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanErrorPayload;
      setErrorRef.current(payload.scannerType, payload.error);
    });

    const unsubCancelled = api.onScanCancelled((data) => {
      if (typeof data !== 'object' || data === null || !('scannerType' in data)) return;
      const payload = data as ScanCancelledPayload;
      setCancelledRef.current(payload.scannerType);
    });

    return () => {
      unsubProgress();
      unsubResult();
      unsubError();
      unsubCancelled();
    };
  }, []);

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
