// ── Risk Levels ──────────────────────────────────────────────────────

/** Green = safe to delete, Yellow = review first, Red = proceed with caution */
export type RiskLevel = 'green' | 'yellow' | 'red';

// ── Scanner Types ────────────────────────────────────────────────────

export type ScannerType =
  | 'system-junk'
  | 'browser-cache'
  | 'duplicates'
  | 'big-files'
  | 'empty-items'
  | 'stale-files'
  | 'app-leftovers'
  | 'registry';

// ── Scan Results ─────────────────────────────────────────────────────

export interface ScanResult {
  /** Unique id for this result item */
  id: string;
  /** Which scanner produced this result */
  scannerType: ScannerType;
  /** Absolute file/directory/registry path */
  path: string;
  /** Size in bytes (0 for registry items, empty dirs) */
  size: number;
  /** Last modified timestamp (epoch ms) */
  modified: number;
  /** Risk level for this item */
  risk: RiskLevel;
  /** Human-readable category (e.g. "Windows Temp", "Chrome Cache") */
  category: string;
  /** Human-readable description of what this item is */
  description: string;
  /** Rule ID that matched this item (if from rule engine) */
  ruleId?: string;
  /** For duplicates: hash of the file content */
  hash?: string;
  /** For duplicates: group ID linking duplicate sets */
  groupId?: string;
  /** Whether this is a directory */
  isDirectory?: boolean;
}

// ── Scan Progress ────────────────────────────────────────────────────

export interface ScanProgress {
  /** Which scanner is reporting */
  scannerType: ScannerType;
  /** 0-100 progress percentage */
  percent: number;
  /** Current file/path being processed */
  currentPath: string;
  /** Items found so far */
  itemsFound: number;
  /** Total bytes found so far */
  bytesFound: number;
  /** Current scanning phase description */
  phase?: string;
}

// ── Scanner Configuration ────────────────────────────────────────────

export interface ScannerConfig {
  /** Directories to scan */
  paths: string[];
  /** Glob patterns to exclude */
  exclusions: string[];
  /** Maximum directory depth */
  maxDepth: number;
  /** Minimum file size in bytes (for big-files, duplicates) */
  minSize?: number;
  /** Maximum file size in bytes */
  maxSize?: number;
  /** File extensions to include (empty = all) */
  includeExtensions?: string[];
  /** File extensions to exclude */
  excludeExtensions?: string[];
  /** For stale-files: months of inactivity threshold */
  staleMonths?: number;
  /** For big-files: number of largest files to return */
  topN?: number;
}

// ── Cleanable Items ──────────────────────────────────────────────────

export type CleanAction = 'recycle' | 'delete' | 'move';

export interface CleanableItem {
  /** Reference to the scan result */
  resultId: string;
  /** Absolute path to clean */
  path: string;
  /** Size in bytes */
  size: number;
  /** Risk level */
  risk: RiskLevel;
  /** Whether this is a directory */
  isDirectory: boolean;
}

export interface CleanResult {
  /** Total items processed */
  totalItems: number;
  /** Items successfully cleaned */
  successCount: number;
  /** Items that failed to clean */
  failedCount: number;
  /** Total bytes recovered */
  bytesRecovered: number;
  /** Errors encountered */
  errors: CleanError[];
}

export interface CleanError {
  /** Path that failed */
  path: string;
  /** Error message */
  message: string;
  /** Error code (EACCES, EBUSY, etc.) */
  code?: string;
}

export interface CleanProgressInfo {
  /** Current item index (1-based) */
  current: number;
  /** Total items to clean */
  total: number;
  /** Path currently being cleaned */
  currentPath: string;
  /** Bytes recovered so far */
  bytesRecovered: number;
  /** Number of items successfully cleaned so far */
  successCount: number;
  /** Number of items that failed so far */
  failedCount: number;
}

// ── JSON Rule Engine ─────────────────────────────────────────────────

export interface ScanRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Description of what this rule targets */
  description: string;
  /** Risk level for items matched by this rule */
  risk: RiskLevel;
  /** Paths to scan for this rule */
  paths: RulePath[];
}

export interface RulePath {
  /** Base path (can contain env vars like %TEMP%, %LOCALAPPDATA%) */
  path: string;
  /** Glob pattern to match files within the path */
  pattern: string;
  /** Search type: 'files', 'dirs', or 'both' */
  search: 'files' | 'dirs' | 'both';
  /** Whether to search recursively */
  recursive: boolean;
  /** Max depth for recursive search */
  maxDepth?: number;
}

// ── Browser Scanner ──────────────────────────────────────────────────

export interface BrowserProfile {
  /** Browser name (Chrome, Edge, Firefox, Brave, Opera) */
  browser: string;
  /** Profile name (Default, Profile 1, etc.) */
  profileName: string;
  /** Absolute path to the profile directory */
  profilePath: string;
}

// ── Registry Scanner ─────────────────────────────────────────────────

export interface RegistryFinding {
  /** Registry key path */
  keyPath: string;
  /** Number of values in this key */
  valueCount: number;
  /** Category (MRU, shell history, etc.) */
  category: string;
  /** Privacy impact description */
  privacyImpact: string;
}

// ── AI Advisory Layer ────────────────────────────────────────────────

export type AIProviderType = 'claude' | 'openai' | 'ollama' | 'none';

export interface AIProviderConfig {
  /** Which provider to use */
  type: AIProviderType;
  /** API key (encrypted at rest via safeStorage) */
  apiKey?: string;
  /** Custom API endpoint (for proxy or local Ollama) */
  baseUrl?: string;
  /** Model name to use */
  model?: string;
}

export interface AIAdvice {
  /** Overall summary of scan findings */
  summary: string;
  /** Per-category recommendations */
  recommendations: AIRecommendation[];
  /** Risk assessment overview */
  riskAssessment: string;
}

export interface AIRecommendation {
  /** Which category this recommendation is for */
  category: string;
  /** What the AI recommends */
  action: string;
  /** Why the AI recommends this */
  reasoning: string;
  /** Risk level of following this recommendation */
  risk: RiskLevel;
}

// ── IPC Message Types ────────────────────────────────────────────────

export interface WorkerMessage {
  type: 'progress' | 'result' | 'error' | 'cancelled';
  data: ScanProgress | ScanResult[] | string;
}
