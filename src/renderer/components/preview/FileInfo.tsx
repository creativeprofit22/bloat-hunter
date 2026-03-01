import type { FileMetadata } from '../../hooks/usePreview';
import type { RiskLevel } from '../../../main/scanners/types';
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
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FileInfoProps {
  metadata: FileMetadata;
  risk: RiskLevel;
  category: string;
  description: string;
}

export function FileInfo({ metadata, risk, category, description }: FileInfoProps) {
  return (
    <div className="file-info">
      <div className="file-info-header">
        <span className="file-info-name" title={metadata.name}>
          {metadata.name}
        </span>
        <RiskIndicator risk={risk} />
      </div>

      <div className="file-info-category">{category}</div>

      {description && <div className="file-info-description">{description}</div>}

      <div className="file-info-grid">
        <div className="file-info-row">
          <span className="file-info-label">Size</span>
          <span className="file-info-value">{formatBytes(metadata.size)}</span>
        </div>

        <div className="file-info-row">
          <span className="file-info-label">Type</span>
          <span className="file-info-value">
            {metadata.isDirectory ? 'Directory' : metadata.extension || 'File'}
          </span>
        </div>

        <div className="file-info-row">
          <span className="file-info-label">Modified</span>
          <span className="file-info-value">{formatDate(metadata.modified)}</span>
        </div>

        <div className="file-info-row">
          <span className="file-info-label">Created</span>
          <span className="file-info-value">{formatDate(metadata.created)}</span>
        </div>

        <div className="file-info-row">
          <span className="file-info-label">Folder</span>
          <span className="file-info-value file-info-value--path" title={metadata.parentDir}>
            {metadata.parentDir}
          </span>
        </div>

        <div className="file-info-row">
          <span className="file-info-label">Full Path</span>
          <span className="file-info-value file-info-value--path" title={metadata.path}>
            {metadata.path}
          </span>
        </div>
      </div>
    </div>
  );
}
