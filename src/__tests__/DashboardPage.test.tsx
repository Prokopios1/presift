import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage, toggleSelectAll, toggleSelectRow, getSelectionState } from '../pages/DashboardPage';
import { TooltipProvider } from '../components/ui/tooltip';
import { getDocs, where, doc } from 'firebase/firestore';

// ─── Hoisted fixtures ────────────────────────────────────────────────────────
const { docs, mockArchiveCandidate } = vi.hoisted(() => ({
  docs: [
    {
      id: 'cand_1',
      name: 'Alice Strong',
      fitBadge: '🟢 Strong Fit',
      appliedRole: 'Senior Engineer',
      integrityEvents: [],
      status: 'Completed',
      archived: false,
      scoreResult: {
        icar: { percentile: 88, standardScore: 118, rawScore: 14, maxRawScore: 16, theta: 1.2 },
        wleis: { rawScores: { SEA: 20, OEA: 20, UOE: 20, ROE: 20, Total: 100 } },
      },
    },
    {
      id: 'cand_2',
      name: 'Harry Flag',
      fitBadge: '🔴 Low Fit',
      appliedRole: 'Senior Engineer',
      integrityEvents: [{ type: 'blur', at: 1 }],
      status: 'Completed',
      archived: false,
      scoreResult: {
        icar: { percentile: 10, standardScore: 81, rawScore: 4, maxRawScore: 16, theta: -1.2 },
        wleis: { rawScores: { SEA: 20, OEA: 20, UOE: 20, ROE: 20, Total: 100 } },
      },
    },
  ],
  mockArchiveCandidate: vi.fn(() => Promise.resolve({ data: {} })),
}));

// ─── firebase/functions mock ─────────────────────────────────────────────────
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'archiveCandidate') return mockArchiveCandidate;
    return vi.fn(() => Promise.resolve({ data: {} }));
  }),
}));

// ─── firebase/firestore mock ─────────────────────────────────────────────────
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getDocs: vi.fn(() => Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) })),
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ credits: 10, companyName: 'Acme Recruiter', role: 'admin' }) })),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
  };
});

const renderDashboard = () =>
  render(
    <TooltipProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </TooltipProvider>
  );

// helper: set docs for getDocs
const setCandidateDocs = (docList: Array<{ id: string; data: () => Record<string, unknown> }>) => {
  vi.mocked(getDocs).mockResolvedValue({ docs: docList } as any);
};

// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
describe('DashboardPage Core Rendering & Navigation', () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.clearAllMocks();
    setCandidateDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
    originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' } as any;
    localStorage.setItem('presift_uid', 'test-uid');
  });

  afterEach(() => {
    window.location = originalLocation as any;
  });

  it('renders candidates and balances', async () => {
    // Arrange & Act
    renderDashboard();

    // Assert
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();
    expect(await screen.findByText('Harry Flag')).toBeInTheDocument();
    expect(await screen.findByText(/10\s*Credits/i)).toBeInTheDocument();
  });

  it('scopes all Firestore reads to the presift_uid in localStorage', async () => {
    // Arrange — a distinct recruiter identity, not the demo account
    localStorage.setItem('presift_uid', 'scoped-uid-123');
    setCandidateDocs(docs.map(d => ({ id: d.id, data: () => d as any })));

    // Act
    renderDashboard();
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();

    // Assert — user doc and both queries (candidates + campaigns) use the
    // logged-in uid, never the hardcoded demo id
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'users', 'scoped-uid-123');
    expect(where).toHaveBeenCalledWith('recruiterId', '==', 'scoped-uid-123');
    expect(where).not.toHaveBeenCalledWith('recruiterId', '==', 'demo_recruiter');
  });

  it('aborts fetch when no presift_uid exists', async () => {
    // Arrange — no identity in localStorage
    localStorage.removeItem('presift_uid');
    setCandidateDocs(docs.map(d => ({ id: d.id, data: () => d as any })));

    // Act
    renderDashboard();

    // Give it a moment to complete the useEffect
    await waitFor(() => {
      expect(where).not.toHaveBeenCalled();
    });

    // Assert — demo fallback is no longer used
    expect(where).not.toHaveBeenCalledWith('recruiterId', '==', 'demo_recruiter');
  });

  it('sidebar links are visible and navigate properly', async () => {
    // Arrange
    renderDashboard();

    // Assert — sidebar buttons rendered
    expect(await screen.findByRole('button', { name: 'Recruiter Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Owner / Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy Credits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home / Landing' })).toBeInTheDocument();

    // Act — click admin
    const adminLink = screen.getByRole('button', { name: 'Owner / Admin' });
    fireEvent.click(adminLink);

    // Assert
    await waitFor(() => {
      expect(window.location.href).toMatch(/\/admin$/);
    });
  });

  it('renders bulk action bar when row is selected', async () => {
    // Arrange
    renderDashboard();
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();

    // Act — select row
    const selectAlice = screen.getByRole('checkbox', { name: 'Select Alice Strong' });
    fireEvent.click(selectAlice);

    // Assert — bulk action bar with delete button visible
    expect(await screen.findByText('1 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete selected/i })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DashboardPage Candidate Archiving & Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArchiveCandidate.mockResolvedValue({ data: {} });
  });

  it('archive/unarchive action calls archiveCandidate', async () => {
    // Arrange
    setCandidateDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
    renderDashboard();
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();

    // Act — click archive icon button on Alice Strong
    const archiveBtn = screen.getByRole('button', { name: /Archive Alice Strong/i });
    fireEvent.click(archiveBtn);

    // Assert — archiveCandidate callable called
    await waitFor(() => {
      expect(mockArchiveCandidate).toHaveBeenCalledWith({
        candidateId: 'cand_1',
        archived: true,
      });
    });
  });

  it('Show-archived toggle filters archived candidates', async () => {
    // Arrange — cand_1 active, cand_2 archived
    setCandidateDocs([
      { id: 'cand_1', data: () => ({ ...docs[0], archived: false } as any) },
      { id: 'cand_2', data: () => ({ ...docs[1], archived: true } as any) },
    ]);

    // Act
    renderDashboard();

    // Assert — active candidate visible, archived candidate hidden by default
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();
    expect(screen.queryByText('Harry Flag')).not.toBeInTheDocument();

    // Act — toggle Show archived
    const toggle = screen.getByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — archived candidate now visible with Archived badge
    expect(await screen.findByText('Harry Flag')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('Copy link is disabled for archived candidates', async () => {
    // Arrange — cand_1 is archived
    setCandidateDocs([
      { id: 'cand_1', data: () => ({ ...docs[0], archived: true } as any) },
    ]);

    // Act
    renderDashboard();

    // Toggle show archived to reveal cand_1
    const toggle = await screen.findByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — row visible and Copy button is disabled
    expect(await screen.findByText('Alice Strong')).toBeInTheDocument();
    const copyBtn = screen.getByRole('button', { name: /Copy link for Alice Strong/i });
    expect(copyBtn).toBeDisabled();
  });
});
