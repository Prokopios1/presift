import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../pages/AdminPage';
import { TooltipProvider } from '../components/ui/tooltip';
import { getDocs } from 'firebase/firestore';

// ─── Hoisted fixtures ────────────────────────────────────────────────────────
const { docs, mockNavigate, mockHttpsCallableFn } = vi.hoisted(() => ({
  docs: [
    { id: 'user_1', companyName: 'Acme Corp', email: 'hello@acme.com', credits: 10, totalSpent: 0, vatId: 'DE123' },
  ],
  mockNavigate: vi.fn(),
  mockHttpsCallableFn: vi.fn(() => Promise.resolve({ data: { id: 'new_user_123' } })),
}));

// ─── firebase/functions mock ─────────────────────────────────────────────────
vi.mock('firebase/functions', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    httpsCallable: vi.fn(() => mockHttpsCallableFn),
  };
});

// ─── react-dom mock for createPortal ─────────────────────────────────────────
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    createPortal: (node: any) => node, // Just render inline for tests
  };
});

// ─── react-router-dom mock for navigation ───────────────────────────────────
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
  };
});

// ─── firebase/firestore mock ─────────────────────────────────────────────────
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 2 }) })),
    getDocs: vi.fn(() => Promise.resolve({ docs: docs.map(d => ({ id: d.id, data: () => d })) })),
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({ role: 'admin' }) })),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new_user_123' })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  };
});

// ─── Suite helper ─────────────────────────────────────────────────────────────
const renderAdmin = () =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/admin']}>
        <AdminPage />
      </MemoryRouter>
    </TooltipProvider>
  );

// helper: make getDocs return a specific docs list for this test
const setGetDocs = (docList: Array<{ id: string; data: () => Record<string, unknown> }>) => {
  vi.mocked(getDocs).mockResolvedValue({ docs: docList } as any);
};

// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('AdminPage List & Add Client Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGetDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
  });

  it('renders table + Add Client button and tooltips', async () => {
    // Arrange & Act
    renderAdmin();

    // Assert — table headers and row data
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('hello@acme.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Client/i })).toBeInTheDocument();
    expect(screen.getByText('Customer Accounts')).toBeInTheDocument();
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

    // Act — fill name
    const nameInput = screen.getByPlaceholderText('e.g. Jane Doe');
    fireEvent.change(nameInput, { target: { value: 'Test Name' } });

    // Assert - still disabled (no company/email)
    expect(submitBtn).toBeDisabled();

    // Act — fill company
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

  it('valid submit calls addDoc and refreshes table', async () => {
    // Arrange
    renderAdmin();
    const addButton = await screen.findByRole('button', { name: /Add Client/i });
    fireEvent.click(addButton);

    // Act
    const nameInput = await screen.findByPlaceholderText('e.g. Jane Doe');
    const companyInput = screen.getByPlaceholderText('e.g. Acme Corp');
    const emailInput = screen.getByPlaceholderText('hello@acme.com');
    const submitBtn = screen.getByRole('button', { name: /Create Client/i });
    
    fireEvent.change(nameInput, { target: { value: 'Test Name' } });
    fireEvent.change(companyInput, { target: { value: 'New Test Corp' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitBtn);

    // Assert — 1 call for createClient callable
    await waitFor(() => {
      expect(mockHttpsCallableFn).toHaveBeenCalledTimes(1);
      expect(mockHttpsCallableFn).toHaveBeenCalledWith({
        name: 'Test Name',
        companyName: 'New Test Corp',
        email: 'test@example.com',
        vatId: '',
        credits: 5,
        reason: 'Promo / testing'
      });
    });

    // Assert — newly added client row appears in table
    expect(await screen.findByText('New Test Corp')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Archive Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('archived client hidden when Show archived is off (default)', async () => {
    // Arrange — user_1 is archived
    setGetDocs([{ id: 'user_1', data: () => ({ ...docs[0], archived: true } as any) }]);

    // Act
    renderAdmin();

    // Assert — row not visible (Show archived switch is off by default)
    await waitFor(() => {
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    });
  });

  it('archived client visible with Archived badge when Show archived is on', async () => {
    // Arrange — user_1 is archived
    setGetDocs([{ id: 'user_1', data: () => ({ ...docs[0], archived: true } as any) }]);

    // Act
    renderAdmin();
    await waitFor(() => {}); // wait for initial load

    // Act — toggle Show archived
    const toggle = screen.getByRole('switch', { name: /Show archived/i });
    fireEvent.click(toggle);

    // Assert — row appears with Archived badge
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AdminPage Navigation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGetDocs(docs.map(d => ({ id: d.id, data: () => d as any })));
  });

  it('row click navigates to /admin/clients/:clientId', async () => {
    // Arrange
    renderAdmin();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();

    // Act — click row
    fireEvent.click(screen.getByText('Acme Corp'));

    // Assert — navigates to client detail page
    expect(mockNavigate).toHaveBeenCalledWith('/admin/clients/user_1');
  });
});
