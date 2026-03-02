import { useEffect } from 'react';
import { usePreview } from '../../hooks/usePreview';
import { useUIStore } from '../../store/ui-store';
import { FileInfo } from './FileInfo';
import { ImagePreview } from './ImagePreview';
import { CompareView } from './CompareView';

export function PreviewPanel() {
  const previewVisible = useUIStore((s) => s.previewVisible);
  const togglePreview = useUIStore((s) => s.togglePreview);
  const selectedIds = useUIStore((s) => s.selectedIds);

  const {
    focusedResult,
    setFocusedId,
    getMetadata,
    compareResults,
    thumbnail,
    thumbnailLoading,
    isImageFile: isImage,
  } = usePreview();

  // When exactly one item is selected, treat it as the focused item for single-file preview
  useEffect(() => {
    const ids = Object.keys(selectedIds);
    if (ids.length === 1) {
      setFocusedId(ids[0]);
    } else if (ids.length === 0) {
      setFocusedId(null);
    }
    // When multiple items are selected, keep the current focusedId
    // (compareResults() handles the 2-selected case separately)
  }, [selectedIds, setFocusedId]);

  if (!previewVisible) return null;

  const compareItems = compareResults();

  return (
    <div className="preview-panel">
      <div className="preview-panel-header">
        <span className="preview-panel-title">Preview</span>
        <button className="preview-panel-close" onClick={togglePreview} title="Close preview">
          &times;
        </button>
      </div>

      <div className="preview-panel-body">
        {/* Compare mode: 2 items from same group selected */}
        {compareItems ? (
          <CompareView itemA={compareItems[0]} itemB={compareItems[1]} />
        ) : focusedResult ? (
          <>
            {/* Image thumbnail */}
            {isImage(focusedResult.path) && !focusedResult.isDirectory && (
              <ImagePreview
                thumbnail={thumbnail}
                loading={thumbnailLoading}
                fileName={getMetadata(focusedResult).name}
              />
            )}

            {/* File metadata */}
            <FileInfo
              metadata={getMetadata(focusedResult)}
              risk={focusedResult.risk}
              category={focusedResult.category}
              description={focusedResult.description}
            />
          </>
        ) : (
          <div className="preview-panel-empty">
            <p className="preview-panel-empty-text">Select a file to preview its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
