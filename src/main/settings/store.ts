import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// ── Settings Shape ──────────────────────────────────────────────────

export interface AppSettings {
  scanPaths: string[];
  exclusions: string[];
  maxDepth: number;
  minSize: number;
  staleMonths: number;
  topN: number;
  aiProvider: 'claude' | 'openai' | 'ollama' | 'none';
  aiBaseUrl: string;
  aiModel: string;
  aiEnabled: boolean;
  defaultCleanAction: 'recycle' | 'delete' | 'move';
  quarantinePath: string;
}

const DEFAULTS: AppSettings = {
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
};

// ── Persistent Settings Store ───────────────────────────────────────

let cached: AppSettings | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  if (cached) return cached;

  try {
    const raw = readFileSync(getSettingsPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    cached = { ...DEFAULTS, ...parsed };
  } catch {
    cached = { ...DEFAULTS };
  }

  return cached;
}

function saveSettings(settings: AppSettings): void {
  const dir = path.dirname(getSettingsPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  // Only update cache after successful write — if writeFileSync throws,
  // the cache stays at the previous value instead of diverging from disk.
  cached = settings;
}

function validateSettings(partial: Partial<AppSettings>): Partial<AppSettings> {
  const validated = { ...partial };
  if (
    'maxDepth' in validated &&
    (typeof validated.maxDepth !== 'number' || !Number.isFinite(validated.maxDepth))
  ) {
    delete validated.maxDepth;
  }
  if (
    'minSize' in validated &&
    (typeof validated.minSize !== 'number' || !Number.isFinite(validated.minSize))
  ) {
    delete validated.minSize;
  }
  if (
    'staleMonths' in validated &&
    (typeof validated.staleMonths !== 'number' || !Number.isFinite(validated.staleMonths))
  ) {
    delete validated.staleMonths;
  }
  if (
    'topN' in validated &&
    (typeof validated.topN !== 'number' || !Number.isFinite(validated.topN))
  ) {
    delete validated.topN;
  }
  const validProviders = ['none', 'claude', 'openai', 'ollama'];
  if ('aiProvider' in validated && !validProviders.includes(validated.aiProvider as string)) {
    delete validated.aiProvider;
  }
  const validActions = ['recycle', 'delete', 'move'];
  if (
    'defaultCleanAction' in validated &&
    !validActions.includes(validated.defaultCleanAction as string)
  ) {
    delete validated.defaultCleanAction;
  }
  return validated;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const validated = validateSettings(partial);
  const updated = { ...current, ...validated };
  saveSettings(updated);
  return updated;
}
