import { I18nProvider } from '@/contexts/I18nContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentPage } from '../pages/PaymentPage';
import { TooltipProvider } from '../components/ui/tooltip';

const createSessionMock = vi.fn();
const getDocMock = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: () => createSessionMock,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: (...args: any[]) => getDocMock(...args),
}));


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('PaymentPage', () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    getDocMock.mockReset();
    localStorage.clear();
  });

  it('renders pricing UI correctly on fresh visit with empty fields', async () => {
    getDocMock.mockResolvedValue({ exists: () => false });

    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <PaymentPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    expect(screen.getByText(/Simple, transparent pricing/i)).toBeTruthy();
    expect(screen.getByText(/Pay-As-You-Go Credits/i)).toBeTruthy();
    expect(screen.getByText(/€5/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Berlin, Germany/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Checkout — €25\.00/i })).toBeTruthy();
    expect(screen.queryByTestId('signed-in-badge')).toBeNull();
    expect(screen.getByText(/Register account →/i)).toBeTruthy();
  });

  it('pre-fills form fields and displays signed-in badge when registered recruiter profile exists', async () => {
    localStorage.setItem('presift_uid', 'registered_recruiter_abc');

    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Jane Recruiter',
        email: 'jane@enterprise.com',
        companyName: 'Enterprise Hiring Inc',
        vatId: 'DE999888777',
        billingAddress: '42 Tech Avenue, Munich',
      }),
    });

    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <PaymentPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    await waitFor(() => {
      const companyInput = screen.getByPlaceholderText(/Acme Corp/i) as HTMLInputElement;
      expect(companyInput.value).toBe('Enterprise Hiring Inc');
      const emailInput = screen.getByPlaceholderText(/billing@acme\.com/i) as HTMLInputElement;
      expect(emailInput.value).toBe('jane@enterprise.com');
      const vatInput = screen.getByPlaceholderText(/DE123456789/i) as HTMLInputElement;
      expect(vatInput.value).toBe('DE999888777');
      const addressInput = screen.getByPlaceholderText(/Berlin, Germany/i) as HTMLInputElement;
      expect(addressInput.value).toBe('42 Tech Avenue, Munich');
    });

    const badge = screen.getByTestId('signed-in-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('Jane Recruiter (jane@enterprise.com)');
    expect(badge.textContent).not.toContain('undefined');
  });

  it('handles missing name gracefully and falls back to email / company name without rendering undefined', async () => {
    localStorage.setItem('presift_uid', 'recruiter_no_name');

    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'billing@nameless.com',
        companyName: 'Nameless Corp',
      }),
    });

    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <PaymentPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    await waitFor(() => {
      const badge = screen.getByTestId('signed-in-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toContain('Nameless Corp (billing@nameless.com)');
      expect(badge.textContent).not.toContain('undefined');
    });
  });

  it('starts a Stripe checkout session with stepper quantity and prefilled/overridden details', async () => {
    localStorage.setItem('presift_uid', 'user_123');

    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Bob Recruiter',
        email: 'bob@hiring.com',
        companyName: 'Hiring Co',
        vatId: 'VAT123',
        billingAddress: '123 Initial St',
      }),
    });

    createSessionMock.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/test_123' } });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost:5174/', origin: 'http://localhost:5174' },
    });

    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <PaymentPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText(/billing@acme\.com/i) as HTMLInputElement;
      expect(emailInput.value).toBe('bob@hiring.com');
    });

    // increase credits to 15 (click +5 twice)
    const plusFiveBtn = screen.getByRole('button', { name: /\+5/i });
    fireEvent.click(plusFiveBtn);
    fireEvent.click(plusFiveBtn);

    // override billing address manually
    const addressInput = screen.getByPlaceholderText(/Berlin, Germany/i);
    fireEvent.change(addressInput, { target: { value: '456 Updated St, City' } });

    // click checkout (15 * 5 = 75)
    fireEvent.click(screen.getByRole('button', { name: /Checkout — €75\.00/i }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 15,
          uid: 'user_123',
          email: 'bob@hiring.com',
          companyName: 'Hiring Co',
          vatId: 'VAT123',
          billingAddress: '456 Updated St, City',
          origin: 'http://localhost:5174',
        })
      );
    });
    expect((window.location as any).href).toBe('https://checkout.stripe.com/c/pay/test_123');
  });
});
