import { useState, useEffect } from 'react';

export function AboutPage() {
  const [version, setVersion] = useState('');
  const { electron: electronVersion } = window.electronAPI.versions;

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion);
  }, []);

  return (
    <div className="settings-section about-page">
      <div className="about-hero">
        <h2 className="about-app-name">Bloat Hunter</h2>
        <p className="about-version">v{version || '0.1.0'}</p>
        <p className="about-tagline">Find and eliminate disk bloat on Windows.</p>
      </div>

      <div className="about-info">
        <div className="about-row">
          <span className="about-label">Electron</span>
          <span className="about-value">{electronVersion}</span>
        </div>
        <div className="about-row">
          <span className="about-label">Node</span>
          <span className="about-value">{window.electronAPI.versions.node}</span>
        </div>
        <div className="about-row">
          <span className="about-label">Chromium</span>
          <span className="about-value">{window.electronAPI.versions.chrome}</span>
        </div>
        <div className="about-row">
          <span className="about-label">License</span>
          <span className="about-value">MIT</span>
        </div>
      </div>

      <div className="about-branding">
        <p className="about-built-by">
          Built by{' '}
          <a
            className="about-link"
            href="https://wearedouro.agency"
            target="_blank"
            rel="noopener noreferrer"
          >
            Douro Digital
          </a>
        </p>
        <p className="about-description">
          Open source disk cleanup for Windows. Visual interface with smart scanning, grouped
          results, and optional AI-powered recommendations.
        </p>
      </div>

      <div className="about-links">
        <a
          className="about-link-btn"
          href="https://github.com/douro-digital/bloat-hunter"
          target="_blank"
          rel="noopener noreferrer"
        >
          Star us on GitHub
        </a>
        <a
          className="about-link-btn about-link-btn--secondary"
          href="https://github.com/douro-digital/bloat-hunter/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report an Issue
        </a>
      </div>
    </div>
  );
}
