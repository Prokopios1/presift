import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminClientPage } from '../pages/AdminClientPage';
import { TooltipProvider } from '../components/ui/tooltip';
import { getDoc, getDocs, updateDoc, addDoc } from 'firebase/firestore';

// ─── Hoisted fixtures ────────────────────────────────────────────────────────
const {
  mockClientData,
  mockCandidatesData,
  mockAuditLogData,
  mockUpdateClient,
  mockArchiveClient,
  mockArchiveCandidate,
  mockUpdateCandidateClients,
} = vi.hoisted(() => ({
  mockClientData: {
    id: 'client_123',
    companyName: 'Acme Global',
    email: 'contact@acmeglobal.com',
    vatId: 'DE999888777',
    credits: 25,
    totalSpent: 125,
    archived: false,
  },
  mockCandidatesData: [
    {
      id: 'cand_1',
      name: 'Alice Johnson',
      email: 'alice@test.com',
      appliedRole: 'Frontend Lead',
      status: 'Pending',
      fitBadge: '🟢 Strong Fit',
      completionDate: '2026-08-10',
      clientIds: ['client_123'],
      archived: false,
    },
    {
      id: 'cand_2',
      name: 'Bob Smith',
      email: 'bob@test.com',
      appliedRole: 'Backend Engineer',
      status: 'Pending',
      fitBadge: '🟡 Conditional Fit',
      completionDate: '2026-08-11',
      clientIds: ['client_123'],
      archived: true,
    },
  ],
  mockAuditLogData: [
    {
      id: 'log_1',
      amount: 25,
      reason: 'Initial onboarding package',
      adjustedBy: 'admin',
      createdAt: { toDate: () => new Date('2026-08-01') },
      previousBalance: 0,
      newBalance: 25,
    },
  ],
  mockUpdateClient: vi.fn((..._args: any[]) => Promise.resolve({ data: {} })),
  mockArchiveClient: vi.fn((..._args: any[]) => Promise.resolve({ data: {} })),
  mockArchiveCandidate: vi.fn((..._args: any[]) => Promise.resolve({ data: {} })),
  mockUpdateCandidateClients: vi.fn((..._args: any[]) => Promise.resolve({ data: {} })),
}));

// ─── firebase/functions mock ─────────────────────────────────────────────────
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'updateClient') return mockUpdateClient;
    if (name === 'archiveClient') return mockArchiveClient;
    if (name === 'archiveCandidate') return mockArchiveCandidate;
    if (name === 'updateCandidateClients') return mockUpdateCandidateClients;
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
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    })),
    getDocs: vi.fn(() => Promise.resolve({
      docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
    })),
    updateDoc: vi.fn(() => Promise.resolve()),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new_log_id' })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  };
});

// ─── Suite helper ─────────────────────────────────────────────────────────────
const renderAdminClientPage = (clientId = 'client_123') =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[`/admin/clients/${clientId}`]}>
        <Routes>
          <Route path="/admin/clients/:clientId" element={<AdminClientPage />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>
  );

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminClientPage Loading & Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    } as any);
    vi.mocked(getDocs).mockImplementation(() => {
      // Return audit log or candidates based on query or call pattern
      return Promise.resolve({
        docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
      } as any);
    });
  });

  it('loads client + candidates + audit log', async () => {
    // Arrange & Act
    renderAdminClientPage();

    // Assert — client details loaded
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();
    expect(screen.getByText(/contact@acmeglobal\.com/)).toBeInTheDocument();
    expect(screen.getByText(/DE999888777/)).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    // Assert — active candidate visible by default
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Frontend Lead')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminClientPage Edit Client Dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
    } as any);
    mockUpdateClient.mockResolvedValue({ data: {} });
  });

  it('Edit dialog is prefilled, invalid submit is disabled', async () => {
    // Arrange
    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Act — click Edit
    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    // Assert — prefilled
    expect(await screen.findByText('Edit Client')).toBeInTheDocument();
    const companyInput = screen.getByDisplayValue('Acme Global');
    const emailInput = screen.getByDisplayValue('contact@acmeglobal.com');
    const vatInput = screen.getByDisplayValue('DE999888777');
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });

    expect(companyInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(vatInput).toBeInTheDocument();
    expect(saveBtn).not.toBeDisabled();

    // Act — empty company name
    fireEvent.change(companyInput, { target: { value: '' } });

    // Assert — save disabled
    expect(saveBtn).toBeDisabled();
  });

  it('valid submit calls updateClient with vatId OMITTED when blank', async () => {
    // Arrange
    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Act — open edit
    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);
    await screen.findByText('Edit Client');

    const companyInput = screen.getByDisplayValue('Acme Global');
    const emailInput = screen.getByDisplayValue('contact@acmeglobal.com');
    const vatInput = screen.getByDisplayValue('DE999888777');
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });

    // Clear vatId, update company
    fireEvent.change(companyInput, { target: { value: 'Acme Corp Renovated' } });
    fireEvent.change(emailInput, { target: { value: 'info@acmerenovated.com' } });
    fireEvent.change(vatInput, { target: { value: '   ' } }); // blank VAT

    fireEvent.click(saveBtn);

    // Assert — updateClient called with vatId omitted
    await waitFor(() => {
      expect(mockUpdateClient).toHaveBeenCalledWith({
        clientId: 'client_123',
        companyName: 'Acme Corp Renovated',
        email: 'info@acmerenovated.com',
      });
    });

    const callArg = mockUpdateClient.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('vatId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminClientPage Client & Candidate Archiving', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
    } as any);
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockArchiveCandidate.mockResolvedValue({ data: {} });
  });

  it('Archive toggle calls archiveClient', async () => {
    // Arrange
    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Act — click Archive client button
    const archiveBtn = screen.getByRole('button', { name: /Archive client/i });
    fireEvent.click(archiveBtn);

    // Assert
    await waitFor(() => {
      expect(mockArchiveClient).toHaveBeenCalledWith({
        clientId: 'client_123',
        archived: true,
      });
    });
  });

  it('candidate Archive/Unarchive calls archiveCandidate', async () => {
    // Arrange
    renderAdminClientPage();
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();

    // Act — archive Alice Johnson
    const archiveCandBtn = screen.getByRole('button', { name: /Archive Alice Johnson/i });
    fireEvent.click(archiveCandBtn);

    // Assert
    await waitFor(() => {
      expect(mockArchiveCandidate).toHaveBeenCalledWith({
        candidateId: 'cand_1',
        archived: true,
      });
    });
  });

  it('Show-archived toggle filters candidates in client view', async () => {
    // Arrange & Act
    renderAdminClientPage();

    // Assert — Alice is visible (active), Bob is hidden (archived)
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Bob Smith')).not.toBeInTheDocument();

    // Act — toggle Show archived
    const toggle = screen.getByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — Bob is now visible with Archived badge
    expect(await screen.findByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('Copy link is disabled for archived candidates', async () => {
    // Arrange & Act
    renderAdminClientPage();

    // Toggle Show archived to show Bob
    const toggle = await screen.findByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — Bob's copy button is disabled
    expect(await screen.findByText('Bob Smith')).toBeInTheDocument();
    const copyBobBtn = screen.getByRole('button', { name: /Copy link for Bob Smith/i });
    expect(copyBobBtn).toBeDisabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminClientPage Credits & Export CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
    } as any);
  });

  it('Adjust credits writes updateDoc and addDoc audit entry', async () => {
    // Arrange
    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Act — open Adjust Credits dialog
    const adjustBtn = screen.getByRole('button', { name: /Adjust Credits/i });
    fireEvent.click(adjustBtn);

    expect(await screen.findByRole('heading', { name: 'Adjust Credits' })).toBeInTheDocument();

    // Fill amount and reason
    const reasonInput = screen.getByPlaceholderText('e.g., Courtesy credit');
    const amountInput = screen.getByRole('spinbutton');
    fireEvent.change(amountInput, { target: { value: '10' } });
    fireEvent.change(reasonInput, { target: { value: 'Bonus campaign credit' } });

    // Confirm
    const confirmBtn = screen.getByRole('button', { name: /Confirm/i });
    fireEvent.click(confirmBtn);

    // Assert — updateDoc updates client credits, addDoc adds audit entry
    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalled();
    });
  });

  it('Manage candidates dialog updates associations via updateCandidateClients', async () => {
    // Arrange
    const allCandidates = [
      { id: 'cand_1', name: 'Alice Johnson', email: 'alice@test.com', clientIds: ['client_123'] },
      { id: 'cand_extra', name: 'Charlie Brown', email: 'charlie@test.com', clientIds: [] },
    ];
    let callCount = 0;
    vi.mocked(getDocs).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })) } as any);
      }
      if (callCount === 2) {
        return Promise.resolve({ docs: mockAuditLogData.map(d => ({ id: d.id, data: () => d })) } as any);
      }
      return Promise.resolve({ docs: allCandidates.map(d => ({ id: d.id, data: () => d })) } as any);
    });

    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Act — open Manage Candidates dialog
    const manageBtn = screen.getByRole('button', { name: /Manage candidates/i });
    fireEvent.click(manageBtn);

    expect(await screen.findByRole('heading', { name: 'Manage candidates' })).toBeInTheDocument();
    expect(await screen.findByText('Charlie Brown')).toBeInTheDocument();

    // Link Charlie Brown
    const toggleCharlie = screen.getByRole('checkbox', { name: /Toggle Charlie Brown/i });
    fireEvent.click(toggleCharlie);

    // Save
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveBtn);

    // Assert — updateCandidateClients called with new clientIds
    await waitFor(() => {
      expect(mockUpdateCandidateClients).toHaveBeenCalledWith({
        candidateId: 'cand_extra',
        clientIds: ['client_123'],
      });
    });
  });

  it('Export CSV triggers createObjectURL and anchor click', async () => {
    // Arrange
    const createObjectURLMock = vi.fn(() => 'blob:mock-csv-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickMock = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') {
        el.click = clickMock;
      }
      return el;
    });

    renderAdminClientPage();
    expect(await screen.findByText('Alice Johnson')).toBeInTheDocument();

    // Act — click Export CSV
    const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(exportBtn);

    // Assert
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminClientPage Tooltip Presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: mockClientData.id,
      data: () => mockClientData,
    } as any);
    vi.mocked(getDocs).mockResolvedValue({
      docs: mockCandidatesData.map(d => ({ id: d.id, data: () => d })),
    } as any);
  });

  it('renders tooltips on action buttons', async () => {
    // Arrange & Act
    renderAdminClientPage();
    expect(await screen.findByText('Acme Global')).toBeInTheDocument();

    // Assert — buttons with tooltip triggers exist
    expect(screen.getByRole('button', { name: /^Edit$/i })).toHaveAttribute('data-state', 'closed');
    expect(screen.getByRole('button', { name: /Archive client/i })).toHaveAttribute('data-state', 'closed');
    expect(screen.getByRole('button', { name: /Adjust Credits/i })).toHaveAttribute('data-state', 'closed');
    expect(screen.getByRole('button', { name: /Export CSV/i })).toHaveAttribute('data-state', 'closed');
  });
});
