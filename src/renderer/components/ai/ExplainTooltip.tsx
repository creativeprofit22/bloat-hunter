import { useState, useCallback } from 'react';
import type { ScanResult } from '../../../main/scanners/types';
import { useSettingsStore } from '../../store/settings-store';

interface ExplainTooltipProps {
  result: ScanResult;
}

export function ExplainTooltip({ result }: ExplainTooltipProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const aiProvider = useSettingsStore((s) => s.aiProvider);

  const handleExplain = useCallback(async () => {
    if (explanation) {
      setOpen(!open);
      return;
    }

    setLoading(true);
    setOpen(true);

    try {
      const settings = useSettingsStore.getState();
      await window.electronAPI.aiConfigure({
        type: settings.aiProvider,
        baseUrl: settings.aiBaseUrl,
        model: settings.aiModel,
      });

      const text = await window.electronAPI.aiExplainItem(result);
      setExplanation(text ?? 'No explanation available.');
    } catch (err) {
      setExplanation(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [result, explanation, open]);

  if (!aiEnabled || aiProvider === 'none') return null;

  return (
    <span className="explain-tooltip-wrapper">
      <button
        className="explain-tooltip-trigger"
        onClick={handleExplain}
        title="Ask AI: What is this?"
      >
        ?
      </button>
      {open && (
        <div className="explain-tooltip-popover">
          <div className="explain-tooltip-header">
            <span>AI Explanation</span>
            <button className="explain-tooltip-close" onClick={() => setOpen(false)}>
              &times;
            </button>
          </div>
          <div className="explain-tooltip-body">
            {loading ? (
              <div className="explain-tooltip-loading">
                <div className="advisor-panel-spinner advisor-panel-spinner--small" />
                <span>Asking AI...</span>
              </div>
            ) : (
              <p>{explanation}</p>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
