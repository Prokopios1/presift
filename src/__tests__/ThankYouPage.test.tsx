import { I18nProvider } from '@/contexts/I18nContext';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { ThankYouPage } from '../pages/ThankYouPage';

const calls: { name: string; payload: unknown }[] = [];
const installCallable = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(httpsCallable).mockImplementation(((_f: unknown, name: string) =>
    async (payload: unknown) => {
      calls.push({ name, payload });
      if (overrides[name] !== undefined) return { data: overrides[name] };
      if (name === 'getCandidateSelf') return { data: { name: 'Jane Doe', email: 'jane@example.com', status: 'Completed' } };
      if (name === 'deleteCandidateSelf') return { data: { deleted: true } };
      return { data: {} };
    }) as never);
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: null }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));

const renderThankYou = (initialPath = '/thank-you') =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <ThankYouPage />
      </MemoryRouter>
    </I18nProvider>
  );

describe('ThankYouPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the EN confirmation when the UI language is 'en'", () => {
    // Arrange
    localStorage.setItem('presift_language', 'en');
    // Act
    renderThankYou();
    // Assert
    expect(screen.getByText('Thank you for completing the assessment.')).toBeTruthy();
    expect(screen.getByText('Assessment Complete')).toBeTruthy();
    expect(
      screen.getByText(
        'Your responses have been submitted. The recruiter will review your results and contact you if your profile matches the role.'
      )
    ).toBeTruthy();
  });

  it("renders the Greek confirmation for the el language path", () => {
    // Arrange — in test mode I18nContext pins the initial UI language to 'en',
    // so Greek is exercised through the ?lang=el signal (the same setLanguage
    // path a real candidate link uses).
    localStorage.setItem('presift_language', 'en');
    // Act
    renderThankYou('/thank-you?lang=el');
    // Assert
    expect(screen.getByText('Ευχαριστούμε για την ολοκλήρωση της αξιολόγησης.')).toBeTruthy();
    expect(
      screen.getByText(
        'Οι απαντήσεις σας υποβλήθηκαν. Ο υπεύθυνος προσλήψεων θα εξετάσει τα αποτελέσματά σας και θα επικοινωνήσει μαζί σας εφόσον το προφίλ σας ταιριάζει με τη θέση.'
      )
    ).toBeTruthy();
    expect(screen.queryByText('Επιστροφή στην αρχή')).toBeNull();
  });

  it('renders in Greek when arrived with ?lang=el even if the UI is English', () => {
    // Arrange
    localStorage.setItem('presift_language', 'en');
    // Act
    renderThankYou('/thank-you?lang=el');
    // Assert
    expect(screen.getByText('Ευχαριστούμε για την ολοκλήρωση της αξιολόγησης.')).toBeTruthy();
  });

  it('shows NO scores, calibration, or accuracy', () => {
    // Arrange
    localStorage.setItem('presift_language', 'en');
    // Act
    renderThankYou();
    // Assert
    expect(screen.queryByText(/Perceptual Calibration/i)).toBeNull();
    expect(screen.queryByText(/% Correct/i)).toBeNull();
    expect(screen.queryByText(/Alignment Level/i)).toBeNull();
    expect(screen.queryByText(/OEA Score/i)).toBeNull();
  });

  it('renders no link back to the home page', () => {
    // Arrange
    localStorage.setItem('presift_language', 'en');
    // Act
    renderThankYou();
    // Assert
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  // --- Candidate data rights (GDPR): download / delete my data ---
  it('renders NO data buttons when the candidate id (?c=) is absent', () => {
    localStorage.setItem('presift_language', 'en');
    renderThankYou('/thank-you?lang=en');
    expect(screen.queryByRole('button', { name: /Download my data/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete my data/i })).toBeNull();
  });

  it('renders both data buttons when ?c= is present', () => {
    localStorage.setItem('presift_language', 'en');
    renderThankYou('/thank-you?lang=en&c=cand_123');
    expect(screen.getByRole('button', { name: /Download my data/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Delete my data/i })).toBeTruthy();
  });

  it('"Download my data" calls getCandidateSelf with the candidate id', async () => {
    localStorage.setItem('presift_language', 'en');
    (URL as any).createObjectURL = vi.fn(() => 'blob:mock');
    (URL as any).revokeObjectURL = vi.fn();
    calls.length = 0;
    installCallable();
    renderThankYou('/thank-you?lang=en&c=cand_123');

    fireEvent.click(screen.getByRole('button', { name: /Download my data/i }));

    await waitFor(() => expect(calls.some(c => c.name === 'getCandidateSelf')).toBe(true));
    const call = calls.find(c => c.name === 'getCandidateSelf');
    expect(call?.payload).toEqual({ candidateId: 'cand_123' });
  });

  it('"Delete my data" confirms, calls deleteCandidateSelf, shows success and disables both', async () => {
    localStorage.setItem('presift_language', 'en');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    calls.length = 0;
    installCallable();
    renderThankYou('/thank-you?lang=en&c=cand_123');

    fireEvent.click(screen.getByRole('button', { name: /Delete my data/i }));

    await waitFor(() => expect(calls.some(c => c.name === 'deleteCandidateSelf')).toBe(true));
    expect(calls.find(c => c.name === 'deleteCandidateSelf')?.payload).toEqual({ candidateId: 'cand_123' });
    expect(await screen.findByText('Your data has been successfully deleted.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Delete my data/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Download my data/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('"Delete my data" does NOT call the function when the user cancels', async () => {
    localStorage.setItem('presift_language', 'en');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    calls.length = 0;
    installCallable();
    renderThankYou('/thank-you?lang=en&c=cand_123');

    fireEvent.click(screen.getByRole('button', { name: /Delete my data/i }));
    await new Promise(r => setTimeout(r, 20));
    expect(calls.some(c => c.name === 'deleteCandidateSelf')).toBe(false);
  });
});
