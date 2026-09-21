import { I18nProvider } from '@/contexts/I18nContext';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThankYouPage } from '../pages/ThankYouPage';

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
});
