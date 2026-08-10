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
  it('renders nothing when not in dev mode', () => {
    // Arrange
    // Act
    const { container } = renderToolbar('/dashboard');
    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it('renders when ?demo=true is present', () => {
    // Act
    renderToolbar('/dashboard?demo=true');
    // Assert
    expect(screen.getByText(/Dev Mode/)).toBeTruthy();
  });

  it('shows the Auto-Fill & Submit button only on test pages', () => {
    // Act
    renderToolbar('/test/assess_1?demo=true');
    // Assert
    expect(screen.getByText(/Auto-Fill & Submit Test/)).toBeTruthy();
  });
});