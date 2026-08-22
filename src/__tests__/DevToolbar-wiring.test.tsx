import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { DevToolbar } from '../components/DevToolbar';

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(async () => ({ data: { success: true } }))),
}));

const renderToolbar = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <DevToolbar />
    </MemoryRouter>
  );

describe('DevToolbar wiring (iteration 7)', () => {
  it('Mock Recruiter Login writes the demo session', () => {
    // Arrange
    renderToolbar('/dashboard');
    // Act
    fireEvent.click(screen.getByText(/Recruiter Login/));
    // Assert
    const session = JSON.parse(localStorage.getItem('presift_demo_session') || '{}');
    expect(session.email).toBe('demo_recruiter@presift.app');
    expect(session.role).toBe('recruiter');
    expect(session.credits).toBe(5);
    expect(session.vatId).toBeTruthy();
    expect(session.assessments).toHaveLength(3);
    expect(localStorage.getItem('presift_uid')).toBe('demo_recruiter');
  });

  it('Mock Owner Login writes the owner session', () => {
    // Arrange
    renderToolbar('/dashboard');
    // Act
    fireEvent.click(screen.getByText(/Owner Login/));
    // Assert
    const session = JSON.parse(localStorage.getItem('presift_demo_session') || '{}');
    expect(session.email).toBe('prokopios@presift.app');
    expect(session.role).toBe('admin');
    expect(session.credits).toBe(999);
    expect(localStorage.getItem('presift_uid')).toBe('owner_prokopios');
  });

  it('Seed Demo Data calls the seedDemoData callable', async () => {
    // Arrange
    renderToolbar('/dashboard');
    // Act
    fireEvent.click(screen.getByText(/Seed Demo Data/));
    // Assert
    await waitFor(() => {
      expect(httpsCallable).toHaveBeenCalled();
    });
  });
});
