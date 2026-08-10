import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PaymentPage } from '../pages/PaymentPage';

const createSessionMock = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: () => createSessionMock,
}));

describe('PaymentPage', () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    localStorage.clear();
  });

  it('renders pricing UI correctly', async () => {
    render(
      <MemoryRouter>
        <PaymentPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Simple, transparent pricing/i)).toBeTruthy();
    expect(screen.getByText(/Pay-As-You-Go Credits/i)).toBeTruthy();
    expect(screen.getByText(/€5/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Berlin, Germany/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Checkout — €25\.00/i })).toBeTruthy();
  });

  it('starts a Stripe checkout session with stepper quantity and billing address', async () => {
    createSessionMock.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/c/pay/test_123' } });
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost:5174/', origin: 'http://localhost:5174' },
    });

    render(
      <MemoryRouter>
        <PaymentPage />
      </MemoryRouter>
    );

    // increase credits to 15 (click +5 twice)
    const plusFiveBtn = screen.getByRole('button', { name: /\+5/i });
    fireEvent.click(plusFiveBtn);
    fireEvent.click(plusFiveBtn);

    // set billing address
    const addressInput = screen.getByPlaceholderText(/Berlin, Germany/i);
    fireEvent.change(addressInput, { target: { value: '123 Fake St, City' } });

    // click checkout (15 * 5 = 75)
    fireEvent.click(screen.getByRole('button', { name: /Checkout — €75\.00/i }));

    await waitFor(() => {
      expect(createSessionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 15,
          uid: 'demo_user',
          origin: 'http://localhost:5174',
          billingAddress: '123 Fake St, City',
        })
      );
    });
    expect((window.location as any).href).toBe('https://checkout.stripe.com/c/pay/test_123');
  });
});
