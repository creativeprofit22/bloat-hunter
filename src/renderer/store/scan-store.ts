import { create } from 'zustand';
import type { ScannerType, ScanProgress, ScanResult } from '../../main/scanners/types';

type ScanStatus = 'idle' | 'scanning' | 'complete' | 'error';

export interface ScannerState {
  status: ScanStatus;
  progress: number;
  currentPath: string;
  itemsFound: number;
  bytesFound: number;
  phase: string;
  results: ScanResult[];
  error: string | null;
}

const defaultScannerState: ScannerState = {
  status: 'idle',
  progress: 0,
  currentPath: '',
  itemsFound: 0,
  bytesFound: 0,
  phase: '',
  results: [],
  error: null,
};

interface ScanStore {
  scanners: Partial<Record<ScannerType, ScannerState>>;

  /** Get scanner state, returning defaults for uninitialized scanners */
  getScanner: (type: ScannerType) => ScannerState;

  /** Mark a scanner as scanning */
  startScan: (type: ScannerType) => void;

  /** Update progress for a scanner */
  updateProgress: (progress: ScanProgress) => void;

  /** Set results for a scanner (marks as complete) */
  setResults: (type: ScannerType, results: ScanResult[]) => void;

  /** Set error for a scanner */
  setError: (type: ScannerType, error: string) => void;

  /** Mark a scanner as cancelled (reset to idle) */
  setCancelled: (type: ScannerType) => void;

  /** Reset a single scanner to idle */
  reset: (type: ScannerType) => void;

  /** Reset all scanners to idle */
  resetAll: () => void;

  /** Get total bytes found across all scanners */
  getTotalBytes: () => number;

  /** Get total items found across all scanners */
  getTotalItems: () => number;

  /** Check if any scanner is currently running */
  isAnyScanning: () => boolean;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  scanners: {},

  getScanner: (type) => get().scanners[type] ?? defaultScannerState,

  startScan: (type) =>
    set((state) => ({
      scanners: {
        ...state.scanners,
        [type]: { ...defaultScannerState, status: 'scanning' as const },
      },
    })),

  updateProgress: (progress) =>
    set((state) => ({
      scanners: {
        ...state.scanners,
        [progress.scannerType]: {
          ...(state.scanners[progress.scannerType] ?? defaultScannerState),
          status: 'scanning' as const,
          progress: progress.percent,
          currentPath: progress.currentPath,
          itemsFound: progress.itemsFound,
          bytesFound: progress.bytesFound,
          phase: progress.phase ?? '',
        },
      },
    })),

  setResults: (type, results) =>
    set((state) => {
      const existing = state.scanners[type] ?? defaultScannerState;
      const totalBytes = results.reduce((sum, r) => sum + r.size, 0);
      return {
        scanners: {
          ...state.scanners,
          [type]: {
            ...existing,
            status: 'complete' as const,
            progress: 100,
            results,
            itemsFound: results.length,
            bytesFound: totalBytes,
            error: null,
          },
        },
      };
    }),

  setError: (type, error) =>
    set((state) => ({
      scanners: {
        ...state.scanners,
        [type]: {
          ...(state.scanners[type] ?? defaultScannerState),
          status: 'error' as const,
          error,
        },
      },
    })),

  setCancelled: (type) =>
    set((state) => ({
      scanners: {
        ...state.scanners,
        [type]: {
          ...(state.scanners[type] ?? defaultScannerState),
          status: 'idle' as const,
          progress: 0,
          currentPath: '',
          phase: '',
        },
      },
    })),

  reset: (type) =>
    set((state) => ({
      scanners: {
        ...state.scanners,
        [type]: { ...defaultScannerState },
      },
    })),

  resetAll: () => set({ scanners: {} }),

  getTotalBytes: () =>
    Object.values(get().scanners).reduce((sum, s) => sum + (s?.bytesFound ?? 0), 0),

  getTotalItems: () =>
    Object.values(get().scanners).reduce((sum, s) => sum + (s?.itemsFound ?? 0), 0),

  isAnyScanning: () => Object.values(get().scanners).some((s) => s?.status === 'scanning'),
}));
