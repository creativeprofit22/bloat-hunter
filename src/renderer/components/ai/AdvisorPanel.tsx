import { useState, useCallback } from 'react';
import { useScanStore } from '../../store/scan-store';
import { useSettingsStore } from '../../store/settings-store';
import type { AIAdvice, ScanResult } from '../../../main/scanners/types';
import { RiskExplanation } from './RiskExplanation';

// TODO: Wire up window.electronAPI.aiExplainItem() for per-item AI explanations

type AdviceStatus = 'idle' | 'loading' | 'ready' | 'error';

export function AdvisorPanel() {
  const [advice, setAdvice] = useState<AIAdvice | null>(null);
  const [status, setStatus] = useState<AdviceStatus>('idle');
  const [error, setError] = useState('');

  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const scanners = useScanStore((s) => s.scanners);

  // Collect all completed results
  const allResults: ScanResult[] = Object.values(scanners).flatMap((s) => s?.results ?? []);
  const hasResults = allResults.length > 0;
  const isAnyScanning = useScanStore((s) => s.isAnyScanning());

  const handleAnalyze = useCallback(async () => {
    setStatus('loading');
    setError('');
    setAdvice(null);

    try {
      // Configure the provider first
      const settings = useSettingsStore.getState();
      await window.electronAPI.aiConfigure({
        type: settings.aiProvider,
        baseUrl: settings.aiBaseUrl,
        model: settings.aiModel,
      });

      const result = await window.electronAPI.aiAnalyze(allResults);
      if (result) {
        setAdvice(result);
        setStatus('ready');
      } else {
        setError('No advice returned. Check your AI provider configuration.');
        setStatus('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, [allResults]);

  // Not configured
  if (!aiEnabled || aiProvider === 'none') {
    return (
      <div className="advisor-panel">
        <div className="advisor-panel-header">
          <span className="advisor-panel-icon">&#x2728;</span>
          <h3 className="advisor-panel-title">AI Advisor</h3>
        </div>
        <p className="advisor-panel-disabled">
          AI features are disabled. Enable them in Settings to get AI-powered cleanup
          recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="advisor-panel">
      <div className="advisor-panel-header">
        <span className="advisor-panel-icon">&#x2728;</span>
        <h3 className="advisor-panel-title">AI Advisor</h3>
        {status === 'ready' && (
          <button className="advisor-panel-refresh" onClick={handleAnalyze} title="Re-analyze">
            &#x21BB;
          </button>
        )}
      </div>

      {/* Idle state — waiting for user to request analysis */}
      {status === 'idle' && (
        <div className="advisor-panel-idle">
          {hasResults && !isAnyScanning ? (
            <>
              <p className="advisor-panel-prompt">
                {allResults.length.toLocaleString()} items found. Get AI recommendations?
              </p>
              <button className="advisor-panel-btn" onClick={handleAnalyze}>
                Analyze with AI
              </button>
            </>
          ) : isAnyScanning ? (
            <p className="advisor-panel-prompt">Waiting for scan to complete...</p>
          ) : (
            <p className="advisor-panel-prompt">Run a scan first to get AI recommendations.</p>
          )}
        </div>
      )}

      {/* Loading state */}
      {status === 'loading' && (
        <div className="advisor-panel-loading">
          <div className="advisor-panel-spinner" />
          <p>Analyzing scan results...</p>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="advisor-panel-error">
          <p className="advisor-panel-error-text">{error}</p>
          <button className="advisor-panel-btn" onClick={handleAnalyze}>
            Retry
          </button>
        </div>
      )}

      {/* Ready state — show advice */}
      {status === 'ready' && advice && (
        <div className="advisor-panel-content">
          <div className="advisor-panel-summary">
            <p>{advice.summary}</p>
          </div>

          {advice.recommendations.length > 0 && (
            <div className="advisor-panel-recommendations">
              {advice.recommendations.map((rec, i) => (
                <RiskExplanation
                  key={i}
                  category={rec.category}
                  action={rec.action}
                  reasoning={rec.reasoning}
                  risk={rec.risk}
                />
              ))}
            </div>
          )}

          {advice.riskAssessment && (
            <div className="advisor-panel-risk-assessment">
              <h4>Risk Assessment</h4>
              <p>{advice.riskAssessment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
