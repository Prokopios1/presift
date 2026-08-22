import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DevToolbar } from '../components/DevToolbar';

const renderToolbar = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DevToolbar />
    </MemoryRouter>
  );

describe('DevToolbar', () => {
  it('renders in dev/test mode on app routes — no ?demo=true escape hatch needed', () => {
    // Vitest runs in MODE=test; the toolbar is dev/test-only by construction.
    renderToolbar('/dashboard');
    expect(screen.getByText(/Dev Mode/)).toBeTruthy();
    expect(screen.getByText(/Seed Demo Data/)).toBeTruthy();
  });

  it('never renders on public routes', () => {
    for (const path of ['/', '/pricing']) {
      const { container } = renderToolbar(path);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it('shows the Auto-Fill & Submit button only on test pages', () => {
    renderToolbar('/test/assess_1');
    expect(screen.getByText(/Auto-Fill & Submit Test/)).toBeTruthy();
  });

  it('hides seeder/login buttons on test pages', () => {
    renderToolbar('/test/assess_1');
    expect(screen.queryByText(/Recruiter Login/)).toBeNull();
    expect(screen.queryByText(/Owner Login/)).toBeNull();
    expect(screen.queryByText(/Seed Demo Data/)).toBeNull();
  });
});
