import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../../src/renderer/App';

describe('App', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the app title in the sidebar', () => {
    render(<App />);
    expect(screen.getByText('Bloat Hunter')).toBeInTheDocument();
  });

  it('renders the dashboard CTA', () => {
    render(<App />);
    expect(screen.getByText('Scan your system')).toBeInTheDocument();
  });

  it('renders the scan button', () => {
    render(<App />);
    expect(screen.getByText('Scan')).toBeInTheDocument();
  });
});
