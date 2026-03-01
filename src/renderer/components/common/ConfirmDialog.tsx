import { useState, useCallback, useEffect, useRef } from 'react';
import type { RiskLevel, CleanAction } from '../../../main/scanners/types';

interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Total number of items to clean */
  itemCount: number;
  /** Total bytes to be cleaned */
  totalBytes: number;
  /** Risk breakdown: count per risk level */
  riskBreakdown: Record<RiskLevel, number>;
  /** Current default action */
  defaultAction: CleanAction;
  /** Called when user confirms — passes chosen action and optional move path */
  onConfirm: (action: CleanAction, moveTo?: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function ConfirmDialog({
  open,
  itemCount,
  totalBytes,
  riskBreakdown,
  defaultAction,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [action, setAction] = useState<CleanAction>(defaultAction);
  const [moveTo, setMoveTo] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const hasRedRisk = riskBreakdown.red > 0;
  const hasYellowRisk = riskBreakdown.yellow > 0;

  return (
    <div className="confirm-dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="confirm-dialog">
        <div className="confirm-dialog-header">
          <h2 className="confirm-dialog-title">Confirm Cleanup</h2>
          <button className="confirm-dialog-close" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="confirm-dialog-body">
          <div className="confirm-dialog-summary">
            <div className="confirm-dialog-stat">
              <span className="confirm-dialog-stat-value">{itemCount}</span>
              <span className="confirm-dialog-stat-label">items</span>
            </div>
            <div className="confirm-dialog-stat">
              <span className="confirm-dialog-stat-value">{formatBytes(totalBytes)}</span>
              <span className="confirm-dialog-stat-label">to recover</span>
            </div>
          </div>

          <div className="confirm-dialog-risks">
            {riskBreakdown.green > 0 && (
              <div className="confirm-dialog-risk confirm-dialog-risk--green">
                <span className="confirm-dialog-risk-dot" />
                <span>{riskBreakdown.green} safe</span>
              </div>
            )}
            {hasYellowRisk && (
              <div className="confirm-dialog-risk confirm-dialog-risk--yellow">
                <span className="confirm-dialog-risk-dot" />
                <span>{riskBreakdown.yellow} caution</span>
              </div>
            )}
            {hasRedRisk && (
              <div className="confirm-dialog-risk confirm-dialog-risk--red">
                <span className="confirm-dialog-risk-dot" />
                <span>{riskBreakdown.red} danger</span>
              </div>
            )}
          </div>

          {hasRedRisk && (
            <div className="confirm-dialog-warning">
              {riskBreakdown.red} item{riskBreakdown.red > 1 ? 's are' : ' is'} marked as dangerous.
              Review carefully before proceeding.
            </div>
          )}

          <div className="confirm-dialog-action-select">
            <label className="confirm-dialog-label">Clean method:</label>
            <div className="confirm-dialog-actions">
              <button
                className={`confirm-dialog-action-btn ${action === 'recycle' ? 'confirm-dialog-action-btn--active' : ''}`}
                onClick={() => setAction('recycle')}
              >
                <span className="confirm-dialog-action-icon">&#x267B;</span>
                <span className="confirm-dialog-action-text">
                  <span className="confirm-dialog-action-name">Recycle Bin</span>
                  <span className="confirm-dialog-action-desc">Recoverable</span>
                </span>
              </button>
              <button
                className={`confirm-dialog-action-btn ${action === 'delete' ? 'confirm-dialog-action-btn--active' : ''}`}
                onClick={() => setAction('delete')}
              >
                <span className="confirm-dialog-action-icon">&#x2716;</span>
                <span className="confirm-dialog-action-text">
                  <span className="confirm-dialog-action-name">Permanent</span>
                  <span className="confirm-dialog-action-desc">Cannot undo</span>
                </span>
              </button>
              <button
                className={`confirm-dialog-action-btn ${action === 'move' ? 'confirm-dialog-action-btn--active' : ''}`}
                onClick={() => setAction('move')}
              >
                <span className="confirm-dialog-action-icon">&#x1F4C1;</span>
                <span className="confirm-dialog-action-text">
                  <span className="confirm-dialog-action-name">Move</span>
                  <span className="confirm-dialog-action-desc">Quarantine</span>
                </span>
              </button>
            </div>
          </div>

          {action === 'move' && (
            <div className="confirm-dialog-move-path">
              <label className="confirm-dialog-label">Move to:</label>
              <input
                type="text"
                className="confirm-dialog-input"
                value={moveTo}
                onChange={(e) => setMoveTo(e.target.value)}
                placeholder="C:\BloatHunter-Quarantine"
              />
            </div>
          )}
        </div>

        <div className="confirm-dialog-footer">
          <button className="confirm-dialog-btn confirm-dialog-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`confirm-dialog-btn confirm-dialog-btn--confirm ${action === 'delete' ? 'confirm-dialog-btn--danger' : ''}`}
            onClick={() => onConfirm(action, action === 'move' ? moveTo : undefined)}
            disabled={action === 'move' && !moveTo.trim()}
          >
            {action === 'recycle'
              ? 'Send to Recycle Bin'
              : action === 'delete'
                ? 'Delete Permanently'
                : 'Move Files'}
          </button>
        </div>
      </div>
    </div>
  );
}
