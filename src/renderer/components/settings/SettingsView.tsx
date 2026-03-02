import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../../store/settings-store';
import { ScanSettings } from './ScanSettings';
import { AISettings } from './AISettings';
import { AboutPage } from './AboutPage';

type SettingsTab = 'general' | 'scanning' | 'ai' | 'about';

export function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings from main process on mount
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.loadSettings().then((settings) => {
      if (cancelled) return;
      const s = useSettingsStore.getState();
      s.setScanPaths(settings.scanPaths);
      s.setExclusions(settings.exclusions);
      s.setMaxDepth(settings.maxDepth);
      s.setMinSize(settings.minSize);
      s.setStaleMonths(settings.staleMonths);
      s.setTopN(settings.topN);
      s.setAIProvider(settings.aiProvider);
      s.setAIBaseUrl(settings.aiBaseUrl);
      s.setAIModel(settings.aiModel);
      s.setAIEnabled(settings.aiEnabled);
      s.setDefaultCleanAction(settings.defaultCleanAction);
      s.setQuarantinePath(settings.quarantinePath);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist changes to main process
  const persist = useCallback((partial: Record<string, unknown>) => {
    window.electronAPI.saveSettings(partial).catch((err: unknown) => {
      console.error('Failed to save settings:', err);
    });
  }, []);

  if (!loaded) {
    return (
      <div className="settings-view">
        <div className="settings-loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-header">
        <h2 className="settings-title">Settings</h2>
      </div>

      <div className="settings-tabs">
        {(
          [
            ['general', 'General'],
            ['scanning', 'Scanning'],
            ['ai', 'AI'],
            ['about', 'About'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`settings-tab ${activeTab === key ? 'settings-tab--active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === 'general' && <GeneralSettings persist={persist} />}
        {activeTab === 'scanning' && <ScanSettings persist={persist} />}
        {activeTab === 'ai' && <AISettings persist={persist} />}
        {activeTab === 'about' && <AboutPage />}
      </div>
    </div>
  );
}

function GeneralSettings({ persist }: { persist: (p: Record<string, unknown>) => void }) {
  const defaultCleanAction = useSettingsStore((s) => s.defaultCleanAction);
  const quarantinePath = useSettingsStore((s) => s.quarantinePath);
  const setDefaultCleanAction = useSettingsStore((s) => s.setDefaultCleanAction);
  const setQuarantinePath = useSettingsStore((s) => s.setQuarantinePath);

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Cleaning</h3>

      <div className="settings-field">
        <label className="settings-label">Default clean action</label>
        <select
          className="settings-select"
          value={defaultCleanAction}
          onChange={(e) => {
            const val = e.target.value as 'recycle' | 'delete' | 'move';
            setDefaultCleanAction(val);
            persist({ defaultCleanAction: val });
          }}
        >
          <option value="recycle">Move to Recycle Bin (safest)</option>
          <option value="delete">Permanently delete</option>
          <option value="move">Move to quarantine folder</option>
        </select>
        <span className="settings-hint">
          Recycle Bin is recommended — files can be recovered if needed.
        </span>
      </div>

      {defaultCleanAction === 'move' && (
        <div className="settings-field">
          <label className="settings-label">Quarantine folder</label>
          <input
            className="settings-input"
            type="text"
            value={quarantinePath}
            onChange={(e) => {
              setQuarantinePath(e.target.value);
              persist({ quarantinePath: e.target.value });
            }}
            placeholder="e.g. D:\BloatHunter-Quarantine"
          />
          <span className="settings-hint">
            Files will be moved here instead of deleted. Create this folder first.
          </span>
        </div>
      )}
    </div>
  );
}
