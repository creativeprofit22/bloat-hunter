import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '../../store/settings-store';
import type { AIProviderType } from '../../../main/scanners/types';

interface AISettingsProps {
  persist: (partial: Record<string, unknown>) => void;
}

const PROVIDERS: { value: AIProviderType; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'AI features disabled' },
  { value: 'claude', label: 'Claude (Anthropic)', description: 'Recommended — fast and accurate' },
  { value: 'openai', label: 'OpenAI', description: 'GPT models' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Free, runs on your machine' },
];

export function AISettings({ persist }: AISettingsProps) {
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const aiBaseUrl = useSettingsStore((s) => s.aiBaseUrl);
  const aiModel = useSettingsStore((s) => s.aiModel);

  const setAIEnabled = useSettingsStore((s) => s.setAIEnabled);
  const setAIProvider = useSettingsStore((s) => s.setAIProvider);
  const setAIBaseUrl = useSettingsStore((s) => s.setAIBaseUrl);
  const setAIModel = useSettingsStore((s) => s.setAIModel);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Check if an API key is stored for the current provider
  useEffect(() => {
    if (aiProvider !== 'none' && aiProvider !== 'ollama') {
      window.electronAPI.hasApiKey(aiProvider).then(setHasKey);
    } else {
      // Use a resolved promise to avoid synchronous setState in effect
      Promise.resolve(false).then(setHasKey);
    }
  }, [aiProvider]);

  const saveApiKey = useCallback(async () => {
    if (!apiKeyInput.trim()) return;
    await window.electronAPI.setApiKey(aiProvider, apiKeyInput.trim());
    setApiKeyInput('');
    setHasKey(true);
  }, [aiProvider, apiKeyInput]);

  const removeApiKey = useCallback(async () => {
    await window.electronAPI.setApiKey(aiProvider, '');
    setHasKey(false);
  }, [aiProvider]);

  const testConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestError('');

    try {
      // Configure the provider first
      const settings = useSettingsStore.getState();
      await window.electronAPI.aiConfigure({
        type: settings.aiProvider,
        baseUrl: settings.aiBaseUrl,
        model: settings.aiModel,
      });

      const result = await window.electronAPI.aiTestConnection();
      if (result.ok) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(result.error ?? 'Unknown error');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const needsApiKey = aiProvider !== 'none' && aiProvider !== 'ollama';

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">AI Advisory</h3>

      <div className="settings-field">
        <label className="settings-label-inline">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => {
              setAIEnabled(e.target.checked);
              persist({ aiEnabled: e.target.checked });
            }}
          />
          Enable AI features
        </label>
        <span className="settings-hint">
          Get AI-powered cleanup recommendations and file explanations.
        </span>
      </div>

      {aiEnabled && (
        <>
          <div className="settings-field">
            <label className="settings-label">Provider</label>
            <select
              className="settings-select"
              value={aiProvider}
              onChange={(e) => {
                const val = e.target.value as AIProviderType;
                setAIProvider(val);
                persist({ aiProvider: val });
                setTestStatus('idle');
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} — {p.description}
                </option>
              ))}
            </select>
          </div>

          {needsApiKey && (
            <div className="settings-field">
              <label className="settings-label">API Key</label>
              {hasKey ? (
                <div className="settings-api-key-status">
                  <span className="settings-api-key-saved">API key saved (encrypted)</span>
                  <button className="settings-btn settings-btn--danger" onClick={removeApiKey}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="settings-api-key-input">
                  <input
                    className="settings-input"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        saveApiKey();
                      }
                    }}
                    placeholder={aiProvider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                  />
                  <button
                    className="settings-btn"
                    onClick={saveApiKey}
                    disabled={!apiKeyInput.trim()}
                  >
                    Save
                  </button>
                </div>
              )}
              <span className="settings-hint">
                Encrypted with Windows DPAPI — only accessible on this machine.
              </span>
            </div>
          )}

          <div className="settings-field">
            <label className="settings-label">Custom API URL (optional)</label>
            <input
              className="settings-input"
              type="text"
              value={aiBaseUrl}
              onChange={(e) => {
                setAIBaseUrl(e.target.value);
                persist({ aiBaseUrl: e.target.value });
              }}
              placeholder={
                aiProvider === 'ollama'
                  ? 'http://localhost:11434'
                  : 'Leave empty for default endpoint'
              }
            />
            <span className="settings-hint">
              Override the default API endpoint. Useful for proxies or self-hosted services.
            </span>
          </div>

          <div className="settings-field">
            <label className="settings-label">Model (optional)</label>
            <input
              className="settings-input"
              type="text"
              value={aiModel}
              onChange={(e) => {
                setAIModel(e.target.value);
                persist({ aiModel: e.target.value });
              }}
              placeholder={
                aiProvider === 'claude'
                  ? 'claude-haiku-4-5-20251001'
                  : aiProvider === 'openai'
                    ? 'gpt-4o-mini'
                    : aiProvider === 'ollama'
                      ? 'llama3'
                      : ''
              }
            />
            <span className="settings-hint">Leave empty to use the default model.</span>
          </div>

          {aiProvider !== 'none' && (
            <div className="settings-field">
              <button
                className="settings-btn"
                onClick={testConnection}
                disabled={testStatus === 'testing'}
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              {testStatus === 'success' && (
                <span className="settings-test-success">Connection successful</span>
              )}
              {testStatus === 'error' && <span className="settings-test-error">{testError}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
