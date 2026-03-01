import type { ScanResult } from '../../../main/scanners/types';
import { RiskIndicator } from '../dashboard/RiskIndicator';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(epoch: number): string {
  if (epoch === 0) return '—';
  const d = new Date(epoch);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function getFileName(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\';
  const parts = filePath.split(sep);
  return parts[parts.length - 1] || filePath;
}

function getParentDir(filePath: string): string {
  const sep = filePath.includes('/') ? '/' : '\\';
  const parts = filePath.split(sep);
  parts.pop();
  return parts.join(sep);
}

const FILE_ICONS: Record<string, string> = {
  '.jpg': '\uD83D\uDDBC',
  '.jpeg': '\uD83D\uDDBC',
  '.png': '\uD83D\uDDBC',
  '.gif': '\uD83D\uDDBC',
  '.webp': '\uD83D\uDDBC',
  '.bmp': '\uD83D\uDDBC',
  '.svg': '\uD83D\uDDBC',
  '.mp4': '\uD83C\uDFA5',
  '.avi': '\uD83C\uDFA5',
  '.mkv': '\uD83C\uDFA5',
  '.mov': '\uD83C\uDFA5',
  '.mp3': '\uD83C\uDFB5',
  '.wav': '\uD83C\uDFB5',
  '.flac': '\uD83C\uDFB5',
  '.zip': '\uD83D\uDCE6',
  '.rar': '\uD83D\uDCE6',
  '.7z': '\uD83D\uDCE6',
  '.tar': '\uD83D\uDCE6',
  '.gz': '\uD83D\uDCE6',
  '.exe': '\u2699',
  '.msi': '\u2699',
  '.dll': '\u2699',
  '.log': '\uD83D\uDCC4',
  '.txt': '\uD83D\uDCC4',
  '.tmp': '\uD83D\uDCC4',
};

function getFileIcon(filePath: string, isDirectory?: boolean): string {
  if (isDirectory) return '\uD83D\uDCC1';
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return FILE_ICONS[ext] ?? '\uD83D\uDCC4';
}

interface FileRowProps {
  result: ScanResult;
  selected: boolean;
  onToggle: (id: string) => void;
  indented?: boolean;
  onContextMenu: (e: React.MouseEvent, result: ScanResult) => void;
}

export function FileRow({ result, selected, onToggle, indented, onContextMenu }: FileRowProps) {
  const name = getFileName(result.path);
  const dir = getParentDir(result.path);
  const icon = getFileIcon(result.path, result.isDirectory);

  return (
    <div
      className={`file-row ${selected ? 'file-row--selected' : ''} ${indented ? 'file-row--indented' : ''}`}
      onContextMenu={(e) => onContextMenu(e, result)}
    >
      <label className="file-row-checkbox">
        <input type="checkbox" checked={selected} onChange={() => onToggle(result.id)} />
      </label>

      <span className="file-row-icon">{icon}</span>

      <div className="file-row-name" title={result.path}>
        <span className="file-row-name-text">{name}</span>
        <span className="file-row-path" title={dir}>
          {dir}
        </span>
      </div>

      <span className="file-row-size">{formatBytes(result.size)}</span>

      <span className="file-row-date">{formatDate(result.modified)}</span>

      <span className="file-row-risk">
        <RiskIndicator risk={result.risk} />
      </span>
    </div>
  );
}
