import { create } from 'zustand';
import type { AIProviderType } from '../../main/scanners/types';

interface SettingsStore {
  /** Directories to scan */
  scanPaths: string[];

  /** Glob patterns to exclude from scanning */
  exclusions: string[];

  /** Maximum directory depth for scanning */
  maxDepth: number;

  /** Minimum file size filter in bytes (for big-files, duplicates) */
  minSize: number;

  /** For stale-files: months threshold */
  staleMonths: number;

  /** For big-files: number of top results */
  topN: number;

  /** AI provider type */
  aiProvider: AIProviderType;

  /** Custom AI API base URL */
  aiBaseUrl: string;

  /** AI model name */
  aiModel: string;

  /** Whether AI features are enabled */
  aiEnabled: boolean;

  /** Default clean action */
  defaultCleanAction: 'recycle' | 'delete' | 'move';

  /** Quarantine folder for 'move' action */
  quarantinePath: string;

  /** Update scan paths */
  setScanPaths: (paths: string[]) => void;

  /** Update exclusions */
  setExclusions: (exclusions: string[]) => void;

  /** Update max depth */
  setMaxDepth: (depth: number) => void;

  /** Update min size */
  setMinSize: (size: number) => void;

  /** Update stale months threshold */
  setStaleMonths: (months: number) => void;

  /** Update top N */
  setTopN: (n: number) => void;

  /** Update AI provider */
  setAIProvider: (provider: AIProviderType) => void;

  /** Update AI base URL */
  setAIBaseUrl: (url: string) => void;

  /** Update AI model */
  setAIModel: (model: string) => void;

  /** Toggle AI features */
  setAIEnabled: (enabled: boolean) => void;

  /** Update default clean action */
  setDefaultCleanAction: (action: 'recycle' | 'delete' | 'move') => void;

  /** Update quarantine path */
  setQuarantinePath: (path: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  scanPaths: [],
  exclusions: [],
  maxDepth: 10,
  minSize: 0,
  staleMonths: 6,
  topN: 100,
  aiProvider: 'none',
  aiBaseUrl: '',
  aiModel: '',
  aiEnabled: false,
  defaultCleanAction: 'recycle',
  quarantinePath: '',

  setScanPaths: (paths) => set({ scanPaths: paths }),
  setExclusions: (exclusions) => set({ exclusions }),
  setMaxDepth: (depth) => set({ maxDepth: depth }),
  setMinSize: (size) => set({ minSize: size }),
  setStaleMonths: (months) => set({ staleMonths: months }),
  setTopN: (n) => set({ topN: n }),
  setAIProvider: (provider) => set({ aiProvider: provider }),
  setAIBaseUrl: (url) => set({ aiBaseUrl: url }),
  setAIModel: (model) => set({ aiModel: model }),
  setAIEnabled: (enabled) => set({ aiEnabled: enabled }),
  setDefaultCleanAction: (action) => set({ defaultCleanAction: action }),
  setQuarantinePath: (path) => set({ quarantinePath: path }),
}));
