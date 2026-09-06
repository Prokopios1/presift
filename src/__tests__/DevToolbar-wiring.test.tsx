import { I18nProvider } from '@/contexts/I18nContext';
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
    <I18nProvider><MemoryRouter initialEntries={[path]}>
      <DevToolbar />
    </MemoryRouter></I18nProvider>
  );


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('DevToolbar wiring (iteration 7)', () => {


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
