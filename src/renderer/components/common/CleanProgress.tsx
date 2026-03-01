import type { CleanProgressInfo, CleanResult } from '../../../main/scanners/types';

interface CleanProgressProps {
  /** Whether the progress overlay is visible */
  open: boolean;
  /** Current progress data (null before first update) */
  progress: CleanProgressInfo | null;
  /** Final result (set when cleaning is complete) */
  result: CleanResult | null;
  /** Called when user dismisses the result */
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function CleanProgress({ open, progress, result, onClose }: CleanProgressProps) {
  if (!open) return null;

  const isComplete = result !== null;
  const percent = progress ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="clean-progress-overlay">
      <div className="clean-progress">
        <div className="clean-progress-header">
          <h2 className="clean-progress-title">
            {isComplete ? 'Cleanup Complete' : 'Cleaning...'}
          </h2>
        </div>

        <div className="clean-progress-body">
          {!isComplete && progress && (
            <>
              <div className="clean-progress-bar-container">
                <div className="clean-progress-bar">
                  <div className="clean-progress-bar-fill" style={{ width: `${percent}%` }} />
                </div>
                <span className="clean-progress-percent">{percent}%</span>
              </div>

              <div className="clean-progress-stats">
                <span className="clean-progress-stat">
                  {progress.current} / {progress.total} items
                </span>
                <span className="clean-progress-stat">
                  {formatBytes(progress.bytesRecovered)} recovered
                </span>
              </div>

              <div className="clean-progress-path" title={progress.currentPath}>
                {progress.currentPath}
              </div>
            </>
          )}

          {isComplete && result && (
            <div className="clean-progress-result">
              <div className="clean-progress-result-stat clean-progress-result-stat--success">
                <span className="clean-progress-result-value">{result.successCount}</span>
                <span className="clean-progress-result-label">cleaned</span>
              </div>
              <div className="clean-progress-result-stat clean-progress-result-stat--recovered">
                <span className="clean-progress-result-value">
                  {formatBytes(result.bytesRecovered)}
                </span>
                <span className="clean-progress-result-label">recovered</span>
              </div>
              {result.failedCount > 0 && (
                <div className="clean-progress-result-stat clean-progress-result-stat--failed">
                  <span className="clean-progress-result-value">{result.failedCount}</span>
                  <span className="clean-progress-result-label">failed</span>
                </div>
              )}
            </div>
          )}

          {isComplete && result && result.errors.length > 0 && (
            <div className="clean-progress-errors">
              <div className="clean-progress-errors-title">
                {result.errors.length} error{result.errors.length > 1 ? 's' : ''}:
              </div>
              <div className="clean-progress-errors-list">
                {result.errors.slice(0, 10).map((err, i) => (
                  <div key={i} className="clean-progress-error">
                    <span className="clean-progress-error-path" title={err.path}>
                      {err.path}
                    </span>
                    <span className="clean-progress-error-msg">
                      {err.code ? `[${err.code}] ` : ''}
                      {err.message}
                    </span>
                  </div>
                ))}
                {result.errors.length > 10 && (
                  <div className="clean-progress-error-more">
                    ...and {result.errors.length - 10} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {isComplete && (
          <div className="clean-progress-footer">
            <button className="clean-progress-btn" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
