import { useState } from 'react';
import type { ScanResult } from '../../../main/scanners/types';
import { FileRow } from './FileRow';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

interface ResultGroupProps {
  groupId: string;
  items: ScanResult[];
  selectedIds: Set<string>;
  isGroupSelected: boolean;
  isGroupIndeterminate: boolean;
  onToggleItem: (id: string) => void;
  onToggleGroup: (groupId: string) => void;
  onContextMenu: (e: React.MouseEvent, result: ScanResult) => void;
}

export function ResultGroup({
  groupId,
  items,
  selectedIds,
  isGroupSelected,
  isGroupIndeterminate,
  onToggleItem,
  onToggleGroup,
  onContextMenu,
}: ResultGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  const totalSize = items.reduce((sum, r) => sum + r.size, 0);
  // Wasted = total size minus one copy (keep one)
  const wastedSize = totalSize > 0 && items.length > 1 ? totalSize - items[0].size : 0;

  return (
    <div className="result-group">
      <div className="result-group-header" onClick={() => setCollapsed(!collapsed)}>
        <label className="result-group-checkbox" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isGroupSelected}
            ref={(el) => {
              if (el) el.indeterminate = isGroupIndeterminate;
            }}
            onChange={() => onToggleGroup(groupId)}
          />
        </label>

        <span className="result-group-expand">{collapsed ? '\u25B6' : '\u25BC'}</span>

        <span className="result-group-title">{items.length} duplicates</span>

        <span className="result-group-meta">{formatBytes(wastedSize)} wasted</span>

        <span className="result-group-size">{formatBytes(items[0]?.size ?? 0)} each</span>
      </div>

      {!collapsed && (
        <div className="result-group-items">
          {items.map((item) => (
            <FileRow
              key={item.id}
              result={item}
              selected={selectedIds.has(item.id)}
              onToggle={onToggleItem}
              onContextMenu={onContextMenu}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
}
