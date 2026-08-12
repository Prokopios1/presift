import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage, toggleSelectAll, toggleSelectRow, getSelectionState } from '../pages/DashboardPage';

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

describe('Selection Logic Helpers', () => {
  it('toggleSelectAll selects and deselects all filtered ids', () => {
    const initial = new Set<string>();
    const filtered = ['cand_1', 'cand_2'];
    
    const selected = toggleSelectAll(initial, filtered, true);
    expect(Array.from(selected)).toEqual(['cand_1', 'cand_2']);

    const deselected = toggleSelectAll(selected, filtered, false);
    expect(deselected.size).toBe(0);
  });

  it('toggleSelectRow adds and removes candidate id', () => {
    const initial = new Set<string>();
    const withOne = toggleSelectRow(initial, 'cand_1', true);
    expect(withOne.has('cand_1')).toBe(true);

    const withoutOne = toggleSelectRow(withOne, 'cand_1', false);
    expect(withoutOne.has('cand_1')).toBe(false);
  });

  it('getSelectionState computes isAllSelected and isSomeSelected', () => {
    const filtered = ['cand_1', 'cand_2'];
    
    const none = getSelectionState(new Set(), filtered);
    expect(none).toEqual({ isAllSelected: false, isSomeSelected: false });

    const partial = getSelectionState(new Set(['cand_1']), filtered);
    expect(partial).toEqual({ isAllSelected: false, isSomeSelected: true });

    const all = getSelectionState(new Set(['cand_1', 'cand_2']), filtered);
    expect(all).toEqual({ isAllSelected: true, isSomeSelected: false });
  });
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
    expect(screen.getByRole('button', { name: 'Buy Credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home / Landing' })).toBeInTheDocument();
    
    const adminLink = screen.getByRole('button', { name: 'Owner / Admin' });
    fireEvent.click(adminLink);
    
    await waitFor(() => {
      expect(window.location.href).toMatch(/\/admin$/);
    });
  });

  it('renders bulk action bar when row is selected', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );
    
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();
    const selectAlice = screen.getByRole('checkbox', { name: 'Select Alice Strong' });
    fireEvent.click(selectAlice);

    expect(await screen.findByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete selected/i })).toBeInTheDocument();
  });
});
