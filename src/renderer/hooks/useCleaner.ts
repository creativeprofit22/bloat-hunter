import { useState, useEffect, useCallback } from 'react';
import { useScanStore } from '../store/scan-store';
import { useUIStore } from '../store/ui-store';
import { useSettingsStore } from '../store/settings-store';
import type {
  CleanAction,
  CleanableItem,
  CleanProgressInfo,
  CleanResult,
  RiskLevel,
  ScanResult,
} from '../../main/scanners/types';

export type CleanerPhase = 'idle' | 'confirming' | 'cleaning' | 'done';

export interface CleanerState {
  phase: CleanerPhase;
  items: CleanableItem[];
  totalBytes: number;
  riskBreakdown: Record<RiskLevel, number>;
  progress: CleanProgressInfo | null;
  result: CleanResult | null;
}

function scanResultToCleanable(result: ScanResult): CleanableItem {
  return {
    resultId: result.id,
    path: result.path,
    size: result.size,
    risk: result.risk,
    isDirectory: result.isDirectory ?? false,
  };
}

/**
 * Hook that manages the full cleaning flow:
 * 1. Gathers selected items from scan results
 * 2. Shows confirmation dialog
 * 3. Runs cleaning via IPC
 * 4. Shows progress + results
 */
export function useCleaner() {
  const [state, setState] = useState<CleanerState>({
    phase: 'idle',
    items: [],
    totalBytes: 0,
    riskBreakdown: { green: 0, yellow: 0, red: 0 },
    progress: null,
    result: null,
  });

  const selectedIds = useUIStore((s) => s.selectedIds);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const scanners = useScanStore((s) => s.scanners);
  const defaultAction = useSettingsStore((s) => s.defaultCleanAction);

  // Listen for clean progress events
  useEffect(() => {
    const api = window.electronAPI;
    const unsub = api.onCleanProgress((data) => {
      setState((prev) => ({
        ...prev,
        progress: data as CleanProgressInfo,
      }));
    });
    return unsub;
  }, []);

  /** Initiate the clean flow — gathers selected items and opens confirm dialog */
  const requestClean = useCallback(() => {
    // Collect all scan results across all scanners
    const allResults: ScanResult[] = [];
    for (const scannerState of Object.values(scanners)) {
      if (scannerState?.results) {
        allResults.push(...scannerState.results);
      }
    }

    // Filter to only selected items
    const selectedResults = allResults.filter((r) => selectedIds.has(r.id));
    if (selectedResults.length === 0) return;

    const items = selectedResults.map(scanResultToCleanable);
    const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
    const riskBreakdown: Record<RiskLevel, number> = { green: 0, yellow: 0, red: 0 };
    for (const item of items) {
      riskBreakdown[item.risk]++;
    }

    setState({
      phase: 'confirming',
      items,
      totalBytes,
      riskBreakdown,
      progress: null,
      result: null,
    });
  }, [scanners, selectedIds]);

  /** User confirmed — start cleaning */
  const confirmClean = useCallback(
    async (action: CleanAction, moveTo?: string) => {
      setState((prev) => ({
        ...prev,
        phase: 'cleaning',
        progress: null,
        result: null,
      }));

      try {
        const result = (await window.electronAPI.startClean(
          state.items,
          action,
          moveTo,
        )) as CleanResult;

        setState((prev) => ({
          ...prev,
          phase: 'done',
          result,
        }));

        // Clear selection for successfully cleaned items
        if (result.successCount > 0) {
          clearSelection();
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          phase: 'done',
          result: {
            totalItems: prev.items.length,
            successCount: 0,
            failedCount: prev.items.length,
            bytesRecovered: 0,
            errors: [
              {
                path: '',
                message: err instanceof Error ? err.message : String(err),
              },
            ],
          },
        }));
      }
    },
    [state.items, clearSelection],
  );

  /** Cancel the confirmation dialog */
  const cancelClean = useCallback(() => {
    setState({
      phase: 'idle',
      items: [],
      totalBytes: 0,
      riskBreakdown: { green: 0, yellow: 0, red: 0 },
      progress: null,
      result: null,
    });
  }, []);

  /** Dismiss the results dialog */
  const dismissResults = useCallback(() => {
    setState({
      phase: 'idle',
      items: [],
      totalBytes: 0,
      riskBreakdown: { green: 0, yellow: 0, red: 0 },
      progress: null,
      result: null,
    });
  }, []);

  return {
    ...state,
    defaultAction,
    requestClean,
    confirmClean,
    cancelClean,
    dismissResults,
  };
}
