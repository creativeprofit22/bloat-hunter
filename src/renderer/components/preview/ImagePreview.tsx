import type { ThumbnailData } from '../../hooks/usePreview';

interface ImagePreviewProps {
  thumbnail: ThumbnailData | null;
  loading: boolean;
  fileName: string;
}

export function ImagePreview({ thumbnail, loading, fileName }: ImagePreviewProps) {
  if (loading) {
    return (
      <div className="image-preview">
        <div className="image-preview-loading">Loading preview...</div>
      </div>
    );
  }

  if (!thumbnail) {
    return null;
  }

  return (
    <div className="image-preview">
      <img
        className="image-preview-img"
        src={`data:${thumbnail.mime};base64,${thumbnail.data}`}
        alt={fileName}
      />
      <div className="image-preview-meta">
        {thumbnail.width} x {thumbnail.height}
      </div>
    </div>
  );
}
