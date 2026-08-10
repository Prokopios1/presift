import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../pages/AdminPage';
import { addDoc } from 'firebase/firestore';

const { docs } = vi.hoisted(() => ({
  docs: [
    { id: 'user_1', companyName: 'Acme Corp', email: 'hello@acme.com', credits: 10, totalSpent: 0, vatId: 'DE123' },
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
    updateDoc: vi.fn(),
    addDoc: vi.fn(() => Promise.resolve({ id: 'new_user_123' })),
    serverTimestamp: vi.fn(() => 'mock-timestamp'),
  };
});

describe('AdminPage Add Client Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders table + Add Client button', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Client/i })).toBeInTheDocument();
  });

  it('submit disabled without company/email', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    
    // Open dialog
    const addButton = await screen.findByRole('button', { name: /Add Client/i });
    fireEvent.click(addButton);
    
    // Dialog should be open
    expect(await screen.findByText('Add New Client')).toBeInTheDocument();
    
    const submitBtn = screen.getByRole('button', { name: /Create Client/i });
    expect(submitBtn).toBeDisabled();
    
    const companyInput = screen.getByPlaceholderText('e.g. Acme Corp');
    fireEvent.change(companyInput, { target: { value: 'New Test Corp' } });
    
    // Still disabled because email is empty
    expect(submitBtn).toBeDisabled();
    
    const emailInput = screen.getByPlaceholderText('hello@acme.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    // Now enabled
    expect(submitBtn).not.toBeDisabled();
  });

  it('valid submit calls addDoc and refreshes', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    
    const addButton = await screen.findByRole('button', { name: /Add Client/i });
    fireEvent.click(addButton);
    
    const companyInput = await screen.findByPlaceholderText('e.g. Acme Corp');
    const emailInput = screen.getByPlaceholderText('hello@acme.com');
    const submitBtn = screen.getByRole('button', { name: /Create Client/i });
    
    fireEvent.change(companyInput, { target: { value: 'New Test Corp' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      // 1 call for user, 1 call for audit log
      expect(addDoc).toHaveBeenCalledTimes(2);
    });
    
    // Check list refresh
    expect(await screen.findByText('New Test Corp')).toBeInTheDocument();
  });
});
