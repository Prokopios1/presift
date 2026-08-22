import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '../pages/RegisterPage';
import { TooltipProvider } from '../components/ui/tooltip';

const registerRecruiterMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('firebase/functions', () => ({
  httpsCallable: () => registerRecruiterMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('RegisterPage', () => {
  beforeEach(() => {
    registerRecruiterMock.mockReset();
    navigateMock.mockReset();
    localStorage.clear();
  });

  it('renders all registration form fields and buttons', () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    expect(screen.getByRole('heading', { name: /Recruiter Registration/i })).toBeTruthy();
    expect(screen.getByLabelText(/Full Name/i)).toBeTruthy();
    expect(screen.getByLabelText(/Business Email/i)).toBeTruthy();
    expect(screen.getByLabelText(/Company Name/i)).toBeTruthy();
    expect(screen.getByLabelText(/VAT \/ Tax ID/i)).toBeTruthy();
    expect(screen.getByLabelText(/Billing Address/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Register as Recruiter/i })).toBeTruthy();
  });

  it('shows inline validation errors when submitting empty required fields', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Register as Recruiter/i }));

    expect(screen.getByText(/Full name is required/i)).toBeTruthy();
    expect(screen.getByText(/Business email is required/i)).toBeTruthy();
    expect(screen.getByText(/Company name is required/i)).toBeTruthy();
    expect(registerRecruiterMock).not.toHaveBeenCalled();
  });

  it('shows inline validation error for malformed email', async () => {
    render(
      <TooltipProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Alice Recruiter' } });
    fireEvent.change(screen.getByLabelText(/Business Email/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Acme Corp' } });

    fireEvent.click(screen.getByRole('button', { name: /Register as Recruiter/i }));

    expect(screen.getByText(/Please enter a valid email address/i)).toBeTruthy();
    expect(registerRecruiterMock).not.toHaveBeenCalled();
  });

  it('successfully registers recruiter, persists identity to localStorage, and navigates to /dashboard', async () => {
    registerRecruiterMock.mockResolvedValue({
      data: {
        uid: 'recruiter_generated_123',
        created: true,
        profile: {
          uid: 'recruiter_generated_123',
          name: 'Sarah Connor',
          email: 'sarah@skynet-defence.com',
          companyName: 'Skynet Defence Inc',
          vatId: 'US987654321',
          billingAddress: '100 Cyberdyne Way, LA',
          credits: 0,
        },
      },
    });

    render(
      <TooltipProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sarah Connor' } });
    fireEvent.change(screen.getByLabelText(/Business Email/i), { target: { value: 'sarah@skynet-defence.com' } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Skynet Defence Inc' } });
    fireEvent.change(screen.getByLabelText(/VAT \/ Tax ID/i), { target: { value: 'US987654321' } });
    fireEvent.change(screen.getByLabelText(/Billing Address/i), { target: { value: '100 Cyberdyne Way, LA' } });

    fireEvent.click(screen.getByRole('button', { name: /Register as Recruiter/i }));

    await waitFor(() => {
      expect(registerRecruiterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Sarah Connor',
          email: 'sarah@skynet-defence.com',
          companyName: 'Skynet Defence Inc',
          vatId: 'US987654321',
          billingAddress: '100 Cyberdyne Way, LA',
        })
      );
    });

    await waitFor(() => {
      expect(localStorage.getItem('presift_uid')).toBe('recruiter_generated_123');
      const session = JSON.parse(localStorage.getItem('presift_demo_session') || '{}');
      expect(session.name).toBe('Sarah Connor');
      expect(session.email).toBe('sarah@skynet-defence.com');
      expect(session.companyName).toBe('Skynet Defence Inc');
      expect(navigateMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles backend error gracefully and displays server error message', async () => {
    registerRecruiterMock.mockRejectedValue(new Error('Email already registered or network failure'));

    render(
      <TooltipProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sarah Connor' } });
    fireEvent.change(screen.getByLabelText(/Business Email/i), { target: { value: 'sarah@skynet-defence.com' } });
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: 'Skynet Defence Inc' } });

    fireEvent.click(screen.getByRole('button', { name: /Register as Recruiter/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText(/Email already registered or network failure/i)).toBeTruthy();
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
