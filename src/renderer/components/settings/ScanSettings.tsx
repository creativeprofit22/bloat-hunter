import { useState } from 'react';
import { useSettingsStore } from '../../store/settings-store';

interface ScanSettingsProps {
  persist: (partial: Record<string, unknown>) => void;
}

export function ScanSettings({ persist }: ScanSettingsProps) {
  const scanPaths = useSettingsStore((s) => s.scanPaths);
  const exclusions = useSettingsStore((s) => s.exclusions);
  const maxDepth = useSettingsStore((s) => s.maxDepth);
  const minSize = useSettingsStore((s) => s.minSize);
  const staleMonths = useSettingsStore((s) => s.staleMonths);
  const topN = useSettingsStore((s) => s.topN);

  const setScanPaths = useSettingsStore((s) => s.setScanPaths);
  const setExclusions = useSettingsStore((s) => s.setExclusions);
  const setMaxDepth = useSettingsStore((s) => s.setMaxDepth);
  const setMinSize = useSettingsStore((s) => s.setMinSize);
  const setStaleMonths = useSettingsStore((s) => s.setStaleMonths);
  const setTopN = useSettingsStore((s) => s.setTopN);

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">Directories</h3>
      <ListEditor
        label="Directories to scan"
        hint="Add directories to include in scans. Leave empty to scan common locations automatically."
        placeholder="e.g. C:\Users\YourName"
        items={scanPaths}
        onChange={(paths) => {
          setScanPaths(paths);
          persist({ scanPaths: paths });
        }}
      />

      <ListEditor
        label="Exclusion patterns"
        hint="Glob patterns for files/folders to skip during scanning."
        placeholder="e.g. node_modules, *.iso, .git"
        items={exclusions}
        onChange={(excs) => {
          setExclusions(excs);
          persist({ exclusions: excs });
        }}
      />

      <h3 className="settings-section-title">Limits</h3>

      <div className="settings-field">
        <label className="settings-label">Maximum scan depth</label>
        <input
          className="settings-input settings-input--number"
          type="number"
          min={1}
          max={50}
          value={maxDepth}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 10;
            setMaxDepth(val);
            persist({ maxDepth: val });
          }}
        />
        <span className="settings-hint">How many directory levels deep to scan. Default: 10.</span>
      </div>

      <div className="settings-field">
        <label className="settings-label">Minimum file size (bytes)</label>
        <input
          className="settings-input settings-input--number"
          type="number"
          min={0}
          value={minSize}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 0;
            setMinSize(val);
            persist({ minSize: val });
          }}
        />
        <span className="settings-hint">
          Ignore files smaller than this. 0 = no minimum. Applies to big-files and duplicates.
        </span>
      </div>

      <h3 className="settings-section-title">Scanner-Specific</h3>

      <div className="settings-field">
        <label className="settings-label">Stale files threshold (months)</label>
        <input
          className="settings-input settings-input--number"
          type="number"
          min={1}
          max={120}
          value={staleMonths}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 6;
            setStaleMonths(val);
            persist({ staleMonths: val });
          }}
        />
        <span className="settings-hint">
          Files not accessed or modified in this many months are considered stale. Default: 6.
        </span>
      </div>

      <div className="settings-field">
        <label className="settings-label">Big files — top N results</label>
        <input
          className="settings-input settings-input--number"
          type="number"
          min={10}
          max={1000}
          value={topN}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10) || 100;
            setTopN(val);
            persist({ topN: val });
          }}
        />
        <span className="settings-hint">How many of the largest files to show. Default: 100.</span>
      </div>
    </div>
  );
}

// ── Reusable list editor for paths / exclusions ─────────────────────

function ListEditor({
  label,
  hint,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setDraft('');
    }
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="settings-field">
      <label className="settings-label">{label}</label>
      <div className="settings-list-editor">
        <div className="settings-list-input-row">
          <input
            className="settings-input"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
          />
          <button className="settings-list-add" onClick={add}>
            Add
          </button>
        </div>
        {items.length > 0 && (
          <ul className="settings-list-items">
            {items.map((item, i) => (
              <li key={i} className="settings-list-item">
                <span className="settings-list-item-text">{item}</span>
                <button className="settings-list-item-remove" onClick={() => remove(i)}>
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="settings-hint">{hint}</span>
    </div>
  );
}
