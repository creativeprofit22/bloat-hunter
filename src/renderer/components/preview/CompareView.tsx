import { useState, useEffect, useRef } from 'react';
import type { ScanResult } from '../../../main/scanners/types';
import type { ThumbnailData } from '../../hooks/usePreview';
import { isImageFile } from '../../hooks/usePreview';

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

/** Small component that loads and displays a thumbnail for a given path */
function CompareThumbnail({ filePath }: { filePath: string }) {
  const [thumb, setThumb] = useState<ThumbnailData | null>(null);
  const cache = useRef(new Map<string, ThumbnailData>());

  useEffect(() => {
    if (!isImageFile(filePath)) return;

    let cancelled = false;
    const cached = cache.current.get(filePath);
    if (cached) {
      setThumb(cached);
      return;
    }

    window.electronAPI
      .generateThumbnail(filePath, 200)
      .then((result) => {
        if (!cancelled && result) {
          const data = result as ThumbnailData;
          cache.current.set(filePath, data);
          setThumb(data);
        }
      })
      .catch(() => {
        /* ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  if (!thumb) return null;

  return (
    <img
      className="compare-view-thumb"
      src={`data:${thumb.mime};base64,${thumb.data}`}
      alt={getFileName(filePath)}
    />
  );
}

interface CompareViewProps {
  itemA: ScanResult;
  itemB: ScanResult;
}

export function CompareView({ itemA, itemB }: CompareViewProps) {
  const sizeDiff = itemA.size - itemB.size;
  const dateDiff = itemA.modified - itemB.modified;

  return (
    <div className="compare-view">
      <div className="compare-view-title">Compare Duplicates</div>

      <div className="compare-view-panels">
        {/* Item A */}
        <div className="compare-view-panel">
          <CompareThumbnail key={itemA.path} filePath={itemA.path} />
          <div className="compare-view-name" title={itemA.path}>
            {getFileName(itemA.path)}
          </div>
          <div className="compare-view-detail">
            <span className="compare-view-label">Size</span>
            <span
              className={`compare-view-value ${sizeDiff > 0 ? 'compare-view-value--larger' : ''}`}
            >
              {formatBytes(itemA.size)}
            </span>
          </div>
          <div className="compare-view-detail">
            <span className="compare-view-label">Modified</span>
            <span
              className={`compare-view-value ${dateDiff > 0 ? 'compare-view-value--newer' : ''}`}
            >
              {formatDate(itemA.modified)}
            </span>
          </div>
          <div className="compare-view-path" title={itemA.path}>
            {itemA.path}
          </div>
        </div>

        {/* Divider */}
        <div className="compare-view-divider">vs</div>

        {/* Item B */}
        <div className="compare-view-panel">
          <CompareThumbnail key={itemB.path} filePath={itemB.path} />
          <div className="compare-view-name" title={itemB.path}>
            {getFileName(itemB.path)}
          </div>
          <div className="compare-view-detail">
            <span className="compare-view-label">Size</span>
            <span
              className={`compare-view-value ${sizeDiff < 0 ? 'compare-view-value--larger' : ''}`}
            >
              {formatBytes(itemB.size)}
            </span>
          </div>
          <div className="compare-view-detail">
            <span className="compare-view-label">Modified</span>
            <span
              className={`compare-view-value ${dateDiff < 0 ? 'compare-view-value--newer' : ''}`}
            >
              {formatDate(itemB.modified)}
            </span>
          </div>
          <div className="compare-view-path" title={itemB.path}>
            {itemB.path}
          </div>
        </div>
      </div>

      {sizeDiff !== 0 && (
        <div className="compare-view-summary">
          Size difference: {formatBytes(Math.abs(sizeDiff))}
        </div>
      )}
    </div>
  );
}
