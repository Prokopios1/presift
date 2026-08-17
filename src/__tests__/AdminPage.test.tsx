import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage, buildCandidatesCsv } from '../pages/AdminPage';
import { addDoc, getDocs } from 'firebase/firestore';

// ─── Hoisted fixtures ────────────────────────────────────────────────────────
const { docs, candidateDocs, mockUpdateClient, mockArchiveClient, mockUpdateCandidateClients } = vi.hoisted(() => ({
  docs: [
    { id: 'user_1', companyName: 'Acme Corp', email: 'hello@acme.com', credits: 10, totalSpent: 0, vatId: 'DE123' },
  ],
  candidateDocs: [
    { id: 'cand_1', name: 'Alice', email: 'alice@example.com', appliedRole: 'Eng', status: 'done', clientIds: ['user_1'] },
    { id: 'cand_2', name: 'Bob',   email: 'bob@example.com',   appliedRole: 'PM',  status: 'done', clientIds: [] },
  ],
  mockUpdateClient:            vi.fn(() => Promise.resolve({ data: {} })),
  mockArchiveClient:           vi.fn(() => Promise.resolve({ data: {} })),
  mockUpdateCandidateClients:  vi.fn(() => Promise.resolve({ data: {} })),
}));

// ─── firebase/functions mock ─────────────────────────────────────────────────
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn((_fns: unknown, name: string) => {
    if (name === 'updateClient')           return mockUpdateClient;
    if (name === 'archiveClient')          return mockArchiveClient;
    if (name === 'updateCandidateClients') return mockUpdateCandidateClients;
    return vi.fn(() => Promise.resolve({ data: {} }));
  }),
}));

// ─── firebase/firestore mock — extends the setup-level mock ─────────────────
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
    getDocs: vi.fn(() => Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) })),
    doc: vi.fn(),
    updateDoc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new_user_123' })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  };
});

// ─── Suite helper ─────────────────────────────────────────────────────────────
const renderAdmin = () => render(<MemoryRouter><AdminPage /></MemoryRouter>);

// helper: make getDocs return a specific docs list for this test
const setGetDocs = (docList: Array<{ id: string; data: () => Record<string, unknown> }>) => {
  vi.mocked(getDocs).mockResolvedValue({ docs: docList } as any);
};

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Add Client Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGetDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
    mockUpdateClient.mockResolvedValue({ data: {} });
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockUpdateCandidateClients.mockResolvedValue({ data: {} });
  });

  it('renders table + Add Client button', async () => {
    // Arrange + Act
    renderAdmin();

    // Assert
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Client/i })).toBeInTheDocument();
  });

  it('submit disabled without company/email', async () => {
    // Arrange
    renderAdmin();

    // Act — open dialog
    const addButton = await screen.findByRole('button', { name: /Add Client/i });
    fireEvent.click(addButton);

    // Assert — dialog open, submit disabled
    expect(await screen.findByText('Add New Client')).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: /Create Client/i });
    expect(submitBtn).toBeDisabled();

    // Act — fill company only
    const companyInput = screen.getByPlaceholderText('e.g. Acme Corp');
    fireEvent.change(companyInput, { target: { value: 'New Test Corp' } });

    // Assert — still disabled (no email)
    expect(submitBtn).toBeDisabled();

    // Act — fill email
    const emailInput = screen.getByPlaceholderText('hello@acme.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Assert — now enabled
    expect(submitBtn).not.toBeDisabled();
  });

  it('valid submit calls addDoc and refreshes', async () => {
    // Arrange
    renderAdmin();
    const addButton = await screen.findByRole('button', { name: /Add Client/i });
    fireEvent.click(addButton);

    // Act
    const companyInput = await screen.findByPlaceholderText('e.g. Acme Corp');
    const emailInput = screen.getByPlaceholderText('hello@acme.com');
    const submitBtn = screen.getByRole('button', { name: /Create Client/i });
    fireEvent.change(companyInput, { target: { value: 'New Test Corp' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitBtn);

    // Assert — 1 call for user, 1 for audit log
    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledTimes(2);
    });

    // Assert — row appears in table
    expect(await screen.findByText('New Test Corp')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Edit Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGetDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
    mockUpdateClient.mockResolvedValue({ data: {} });
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockUpdateCandidateClients.mockResolvedValue({ data: {} });
  });

  it('Edit button opens dialog prefilled with client data', async () => {
    // Arrange
    renderAdmin();
    await screen.findByText('Acme Corp');

    // Act — open drawer by clicking row
    fireEvent.click(screen.getByText('Acme Corp'));

    // Act — click Edit button in drawer header
    const editBtn = await screen.findByRole('button', { name: /Edit client/i });
    fireEvent.click(editBtn);

    // Assert — dialog open with prefilled values
    expect(await screen.findByText('Edit Client')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Acme Corp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('hello@acme.com')).toBeInTheDocument();
  });

  it('Save Changes disabled when company is empty', async () => {
    // Arrange
    renderAdmin();
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Acme Corp'));
    const editBtn = await screen.findByRole('button', { name: /Edit client/i });
    fireEvent.click(editBtn);
    await screen.findByText('Edit Client');

    // Act — clear company name
    const companyInput = screen.getByDisplayValue('Acme Corp');
    fireEvent.change(companyInput, { target: { value: '' } });

    // Assert — save disabled
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();
  });

  it('valid Save Changes calls updateClient and updates row', async () => {
    // Arrange
    renderAdmin();
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Acme Corp'));
    const editBtn = await screen.findByRole('button', { name: /Edit client/i });
    fireEvent.click(editBtn);
    await screen.findByText('Edit Client');

    // Act — change company name and save
    const companyInput = screen.getByDisplayValue('Acme Corp');
    fireEvent.change(companyInput, { target: { value: 'Updated Corp' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    // Assert — updateClient callable invoked
    await waitFor(() => {
      expect(mockUpdateClient).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'user_1', companyName: 'Updated Corp' })
      );
    });

    // Assert — table row refreshed with new name (may appear in drawer + table)
    await waitFor(() => {
      expect(screen.getAllByText('Updated Corp').length).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Archive Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGetDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
    mockUpdateClient.mockResolvedValue({ data: {} });
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockUpdateCandidateClients.mockResolvedValue({ data: {} });
  });

  it('Archive button calls archiveClient callable', async () => {
    // Arrange
    renderAdmin();
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Acme Corp'));

    // Act — click Archive in drawer header
    const archiveBtn = await screen.findByRole('button', { name: /Archive client/i });
    fireEvent.click(archiveBtn);

    // Assert
    await waitFor(() => {
      expect(mockArchiveClient).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'user_1', archived: true })
      );
    });
  });

  it('archived client hidden when Show archived is off (default)', async () => {
    // Arrange — user_1 is archived
    setGetDocs([{ id: 'user_1', data: () => ({ ...docs[0], archived: true } as any) }]);
    renderAdmin();

    // Assert — row not visible (Show archived toggle is off by default)
    await waitFor(() => {
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    });
  });

  it('archived client visible with Archived badge when Show archived is on', async () => {
    // Arrange — user_1 is archived
    setGetDocs([{ id: 'user_1', data: () => ({ ...docs[0], archived: true } as any) }]);
    renderAdmin();
    await waitFor(() => {}); // let effect run

    // Act — toggle Show archived
    const toggle = screen.getByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — row appears with Archived badge
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Manage Candidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateClient.mockResolvedValue({ data: {} });
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockUpdateCandidateClients.mockResolvedValue({ data: {} });
  });

  it('calls updateCandidateClients only for changed candidates', async () => {
    // Arrange — first getDocs call = users, subsequent = all candidates
    let callCount = 0;
    vi.mocked(getDocs).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) } as any);
      }
      return Promise.resolve({
        docs: candidateDocs.map(d => ({ id: d.id, data: () => d }))
      } as any);
    });

    renderAdmin();
    await screen.findByText('Acme Corp');

    // Act — open drawer
    fireEvent.click(screen.getByText('Acme Corp'));

    // Act — open Manage candidates dialog
    const manageBtn = await screen.findByRole('button', { name: /Manage candidates/i });
    fireEvent.click(manageBtn);
    expect(await screen.findByText('Alice')).toBeInTheDocument();

    // cand_1 already linked (clientIds includes user_1), cand_2 not linked
    // Act — check Bob (cand_2) → change
    const bobCheckbox = screen.getByRole('checkbox', { name: /Toggle Bob/i });
    fireEvent.click(bobCheckbox);

    // Act — save
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Assert — only cand_2 changed → only 1 updateCandidateClients call
    await waitFor(() => {
      expect(mockUpdateCandidateClients).toHaveBeenCalledTimes(1);
      expect(mockUpdateCandidateClients).toHaveBeenCalledWith(
        expect.objectContaining({ candidateId: 'cand_2' })
      );
    });
  });

  it('missing clientIds treated as empty array (no crash)', async () => {
    // Arrange — candidate with no clientIds field
    let callCount = 0;
    vi.mocked(getDocs).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) } as any);
      }
      return Promise.resolve({
        docs: [{ id: 'cand_no_ids', data: () => ({ id: 'cand_no_ids', name: 'Charlie', email: 'c@c.com' }) }]
      } as any);
    });

    renderAdmin();
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Acme Corp'));

    const manageBtn = await screen.findByRole('button', { name: /Manage candidates/i });
    fireEvent.click(manageBtn);

    // Assert — Charlie rendered as unchecked (no crash from missing clientIds)
    expect(await screen.findByText('Charlie')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Toggle Charlie/i })).not.toBeChecked();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Export CSV', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateClient.mockResolvedValue({ data: {} });
    mockArchiveClient.mockResolvedValue({ data: {} });
    mockUpdateCandidateClients.mockResolvedValue({ data: {} });
  });

  it('buildCandidatesCsv produces correct header and data rows', () => {
    // Arrange
    const candidates = [
      { id: 'c1', name: 'Alice', email: 'a@a.com', appliedRole: 'Eng', status: 'done', fitBadge: 'Strong Fit', cognitivePercentile: 80, eiPercentile: 70, integrityFlag: false },
    ];

    // Act
    const csv = buildCandidatesCsv(candidates);
    const lines = csv.split('\n');

    // Assert
    expect(lines[0]).toBe('name,email,appliedRole,status,created,cognitivePercentile,eiPercentile,fitBadge,integrityFlag');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('a@a.com');
    expect(lines[1]).toContain('Strong Fit');
  });

  it('Export CSV button triggers createObjectURL and anchor click', async () => {
    // Arrange — mock URL APIs
    const createObjectURLMock = vi.fn(() => 'blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    let callCount = 0;
    vi.mocked(getDocs).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) } as any);
      }
      return Promise.resolve({
        docs: [{ id: 'cand_1', data: () => ({ name: 'Alice', email: 'a@a.com', appliedRole: 'Eng', status: 'done', clientIds: ['user_1'] }) }]
      } as any);
    });

    // Mock anchor click
    const clickMock = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === 'a') { el.click = clickMock; }
      return el;
    });

    renderAdmin();
    await screen.findByText('Acme Corp');
    fireEvent.click(screen.getByText('Acme Corp'));

    // Wait for Export CSV to become enabled (candidates loaded)
    const exportBtn = await screen.findByRole('button', { name: /Export CSV/i });
    await waitFor(() => expect(exportBtn).not.toBeDisabled());
    fireEvent.click(exportBtn);

    // Assert
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
