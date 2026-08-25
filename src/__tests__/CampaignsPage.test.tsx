import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CampaignsPage } from '../pages/CampaignsPage';
import { TooltipProvider } from '../components/ui/tooltip';
import { where } from 'firebase/firestore';

// ─── firebase/firestore mock ─────────────────────────────────────────────────
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
}));


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('CampaignsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('presift_uid', 'campaign-uid-9');
  });

  it('scopes the campaigns query to the presift_uid in localStorage', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <CampaignsPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(where).toHaveBeenCalledWith('recruiterId', '==', 'campaign-uid-9');
    });
    expect(where).not.toHaveBeenCalledWith('recruiterId', '==', 'demo_recruiter');
  });

  it('aborts fetch when no presift_uid is set', async () => {
    localStorage.removeItem('presift_uid');
    render(
      <TooltipProvider>
        <MemoryRouter>
          <CampaignsPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(where).not.toHaveBeenCalled();
    });
    expect(where).not.toHaveBeenCalledWith('recruiterId', '==', 'demo_recruiter');
  });
});
