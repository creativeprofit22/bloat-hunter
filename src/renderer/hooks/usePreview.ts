import { useState, useCallback, useEffect, useRef } from 'react';
import { useUIStore } from '../store/ui-store';
import { useScanStore } from '../store/scan-store';
import type { ScanResult } from '../../main/scanners/types';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);

export interface FileMetadata {
  name: string;
  path: string;
  parentDir: string;
  size: number;
  created: number;
  modified: number;
  accessed: number;
  isDirectory: boolean;
  extension: string;
}

export interface ThumbnailData {
  /** Base64-encoded image data */
  data: string;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** MIME type */
  mime: string;
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.slice(lastDot).toLowerCase();
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

export function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filePath));
}

/**
 * Hook providing preview panel state.
 * Tracks the currently focused file, fetches thumbnails for images,
 * and manages compare mode for duplicate pairs.
 */
export function usePreview() {
  const selectedIds = useUIStore((s) => s.selectedIds);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<ThumbnailData | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const thumbnailCache = useRef(new Map<string, ThumbnailData>());
  const scanners = useScanStore((s) => s.scanners);

  /** Find a ScanResult by ID across all scanners */
  const findResult = useCallback(
    (id: string): ScanResult | null => {
      for (const scanner of Object.values(scanners)) {
        if (!scanner?.results) continue;
        const found = scanner.results.find((r) => r.id === id);
        if (found) return found;
      }
      return null;
    },
    [scanners],
  );

  /** The currently focused result */
  const focusedResult = focusedId ? findResult(focusedId) : null;

  /** Build metadata from a result */
  const getMetadata = useCallback((result: ScanResult): FileMetadata => {
    return {
      name: getFileName(result.path),
      path: result.path,
      parentDir: getParentDir(result.path),
      size: result.size,
      created: result.modified, // ScanResult only has modified; created comes from file stat
      modified: result.modified,
      accessed: result.modified,
      isDirectory: result.isDirectory ?? false,
      extension: getExtension(result.path),
    };
  }, []);

  /** For compare mode: get the two selected results (when exactly 2 selected in same group) */
  const compareResults = useCallback((): [ScanResult, ScanResult] | null => {
    if (selectedIds.size !== 2) return null;
    const ids = Array.from(selectedIds);
    const a = findResult(ids[0]);
    const b = findResult(ids[1]);
    if (!a || !b) return null;
    // Only compare items in the same duplicate group
    if (!a.groupId || a.groupId !== b.groupId) return null;
    return [a, b];
  }, [selectedIds, findResult]);

  /** Load thumbnail for an image file */
  const loadThumbnail = useCallback(async (filePath: string) => {
    // Check cache first
    const cached = thumbnailCache.current.get(filePath);
    if (cached) {
      setThumbnail(cached);
      return;
    }

    setThumbnailLoading(true);
    setThumbnail(null);
    try {
      const result = await window.electronAPI.generateThumbnail(filePath, 280);
      if (result) {
        const thumbData = result as ThumbnailData;
        thumbnailCache.current.set(filePath, thumbData);
        setThumbnail(thumbData);
      }
    } catch {
      setThumbnail(null);
    } finally {
      setThumbnailLoading(false);
    }
  }, []);

  // Auto-load thumbnail when focused result is an image
  useEffect(() => {
    if (focusedResult && isImageFile(focusedResult.path) && !focusedResult.isDirectory) {
      loadThumbnail(focusedResult.path);
    } else {
      setThumbnail(null);
      setThumbnailLoading(false);
    }
  }, [focusedResult, loadThumbnail]);

  return {
    focusedId,
    focusedResult,
    setFocusedId,
    getMetadata,
    compareResults,
    thumbnail,
    thumbnailLoading,
    loadThumbnail,
    isImageFile,
  };
}
