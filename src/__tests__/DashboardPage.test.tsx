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

  it('hamburger menu works and navigates properly', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    
    // find menu trigger (button containing Menu icon)
    // The closest semantic locator is probably getByRole('button') but let's find the SVG or the container.
    // Given the markup: <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)}><Menu className="w-6 h-6" /></Button>
    // Since there's no aria-label, we can find it by looking for the sibling of the title or querying buttons.
    // A safe way: the button has no text, but we can query by a combination.
    // Wait for initial render
    await screen.findByText('Alice Strong');
    
    // The title Recruiter Dashboard is next to the button. Let's find all buttons and get the one without text or specific classes if needed, 
    // or we can add aria-label="Menu" but the prompt didn't say. Let's just find the first ghost button that has no text Content or contains SVG.
    const allButtons = screen.getAllByRole('button');
    const menuBtn = allButtons.find(b => b.innerHTML.includes('svg') && !b.textContent);
    
    expect(menuBtn).toBeTruthy();
    fireEvent.click(menuBtn!);
    
    expect(await screen.findByText('Navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recruiter Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Owner / Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pricing / Buy Credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home / Landing' })).toBeInTheDocument();
    
    const adminLink = screen.getByRole('button', { name: 'Owner / Admin' });
    fireEvent.click(adminLink);
    
    await waitFor(() => {
      expect(window.location.href).toBe('/admin');
    });
  });
});
