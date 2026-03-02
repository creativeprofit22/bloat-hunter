import { useScanStore } from '../../store/scan-store';
import { useUIStore } from '../../store/ui-store';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function StatusBar() {
  const totalItems = useScanStore((s) => s.getTotalItems());
  const totalBytes = useScanStore((s) => s.getTotalBytes());
  const selectedCount = useUIStore((s) => Object.keys(s.selectedIds).length);
  const isAnyScanning = useScanStore((s) => s.isAnyScanning());

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        {isAnyScanning && <span className="status-bar-indicator" />}
        <span className="status-bar-item">
          {totalItems.toLocaleString()} {totalItems === 1 ? 'file' : 'files'} found
        </span>
        <span className="status-bar-separator">&middot;</span>
        <span className="status-bar-item">{formatBytes(totalBytes)} recoverable</span>
      </div>
      <div className="status-bar-right">
        <span className="status-bar-item">
          {selectedCount.toLocaleString()} {selectedCount === 1 ? 'item' : 'items'} selected
        </span>
        <span className="status-bar-separator">&middot;</span>
        <span className="status-bar-item status-bar-brand">Douro Digital</span>
      </div>
    </footer>
  );
}
