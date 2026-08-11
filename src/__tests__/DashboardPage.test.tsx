import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';

const { docs } = vi.hoisted(() => ({
  docs: [
    { id: 'cand_1', name: 'Alice Strong', fitBadge: '🟢 Strong Fit', appliedRole: 'Senior Engineer', integrityEvents: [], status: 'Completed', scoreResult: { icar: { percentile: 88, standardScore: 118, rawScore: 14, maxRawScore: 16, theta: 1.2 }, wleis: { rawScores: { SEA: 20, OEA: 20, UOE: 20, ROE: 20, Total: 100 } } } },
    { id: 'cand_2', name: 'Harry Flag', fitBadge: '🔴 Low Fit', appliedRole: 'Senior Engineer', integrityEvents: [{ type: 'blur', at: 1 }], status: 'Completed', scoreResult: { icar: { percentile: 10, standardScore: 81, rawScore: 4, maxRawScore: 16, theta: -1.2 }, wleis: { rawScores: { SEA: 20, OEA: 20, UOE: 20, ROE: 20, Total: 100 } } } },
  ]
}));

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) })),
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ credits: 10 }) })),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

describe('DashboardPage (iteration 5)', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // mock window.location.href
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
  });

  afterEach(() => {
    window.location = originalLocation as any;
  });

  it('renders candidates and balances', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();
    expect(await screen.findByText('Harry Flag')).toBeInTheDocument();
    expect(await screen.findByText(/10\s*Credits/i)).toBeInTheDocument();
  });

  it('sidebar links are visible and navigate properly', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    
    // Sidebar should be immediately visible
    expect(await screen.findByRole('button', { name: 'Recruiter Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Owner / Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pricing / Buy Credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home / Landing' })).toBeInTheDocument();
    
    const adminLink = screen.getByRole('button', { name: 'Owner / Admin' });
    fireEvent.click(adminLink);
    
    await waitFor(() => {
      expect(window.location.href).toMatch(/\/admin$/);
    });
  });
});
