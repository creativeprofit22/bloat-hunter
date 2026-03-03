import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/renderer/App';

describe('App', () => {
  it('renders the app title in the sidebar', () => {
    render(<App />);
    expect(screen.getByText('Bloat Hunter')).toBeInTheDocument();
  });

  it('renders the dashboard CTA', () => {
    render(<App />);
    expect(screen.getAllByText('Scan your system').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the scan button', () => {
    render(<App />);
    const scanButtons = screen.getAllByRole('button', { name: /^scan$/i });
    expect(scanButtons.length).toBeGreaterThanOrEqual(1);
  });
});
