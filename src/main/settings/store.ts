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

export function saveSettings(settings: AppSettings): void {
  const dir = path.dirname(getSettingsPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  // Only update cache after successful write — if writeFileSync throws,
  // the cache stays at the previous value instead of diverging from disk.
  cached = settings;
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const updated = { ...current, ...partial };
  saveSettings(updated);
  return updated;
}
