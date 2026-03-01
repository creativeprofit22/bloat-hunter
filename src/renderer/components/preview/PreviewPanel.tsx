import { usePreview } from '../../hooks/usePreview';
import { useUIStore } from '../../store/ui-store';
import { FileInfo } from './FileInfo';
import { ImagePreview } from './ImagePreview';
import { CompareView } from './CompareView';

export function PreviewPanel() {
  const previewVisible = useUIStore((s) => s.previewVisible);
  const togglePreview = useUIStore((s) => s.togglePreview);

  const {
    focusedResult,
    getMetadata,
    compareResults,
    thumbnail,
    thumbnailLoading,
    isImageFile: isImage,
  } = usePreview();

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
