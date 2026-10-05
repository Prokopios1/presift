import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider, useI18n } from '@/contexts/I18nContext';
import { RecruiterGuidePage } from '../pages/RecruiterGuidePage';

vi.mock('@/lib/firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  signOut: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: 'recruiter_test_123' }, role: 'recruiter', loading: false })),
}));

// Helper component to force language setting inside I18nProvider
const LanguageSetter = ({ lang, children }: { lang: 'en' | 'gr'; children: ReactNode }) => {
  const { setLanguage } = useI18n();
  useEffect(() => {
    setLanguage(lang);
  }, [lang, setLanguage]);
  return <>{children}</>;
};

const renderGuidePage = (lang: 'en' | 'gr' = 'en') => {
  return render(
    <TooltipProvider>
      <I18nProvider>
        <LanguageSetter lang={lang}>
          <MemoryRouter initialEntries={['/recruiter/guide']}>
            <RecruiterGuidePage />
          </MemoryRouter>
        </LanguageSetter>
      </I18nProvider>
    </TooltipProvider>
  );
};

describe('RecruiterGuidePage (§1–§7 Headings & Bilingual Support)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders all §1–§7 section headings in English when language is EN', () => {
    // Arrange
    const expectedHeadings = [
      'What preSift is',
      'The three modules',
      'How it works, step by step',
      'Rules of use',
      'Legal duties',
      'Practicalities',
      'Frequently asked questions',
    ];

    // Act
    renderGuidePage('en');

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Recruiter Guide' })).toBeInTheDocument();
    expectedHeadings.forEach((headingText) => {
      expect(screen.getByText(headingText)).toBeInTheDocument();
    });
    expect(expectedHeadings.length).toBe(7);
  });

  it('renders all §1–§7 section headings in Greek when language is GR', () => {
    // Arrange
    const expectedGreekHeadings = [
      'Τι είναι το preSift',
      'Οι τρεις ενότητες',
      'Πώς λειτουργεί, βήμα βήμα',
      'Κανόνες χρήσης',
      'Νομικές υποχρεώσεις',
      'Πρακτικά',
      'Συχνές ερωτήσεις',
    ];

    // Act
    renderGuidePage('gr');

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Οδηγίες για Στελέχη Αξιολόγησης' })).toBeInTheDocument();
    expectedGreekHeadings.forEach((headingText) => {
      expect(screen.getByText(headingText)).toBeInTheDocument();
    });
    expect(expectedGreekHeadings.length).toBe(7);
  });

  it('toggles headings between English and Greek when LanguageSwitcher is clicked', () => {
    // Arrange
    renderGuidePage('en');
    expect(screen.getByText('What preSift is')).toBeInTheDocument();
    const switchButton = screen.getAllByText(/^en$/i)[0].closest('button')!;

    // Act — click the language switch button
    fireEvent.click(switchButton);

    // Assert — headings flip to Greek
    expect(screen.getByText('Τι είναι το preSift')).toBeInTheDocument();
    expect(screen.getByText('Οι τρεις ενότητες')).toBeInTheDocument();
  });

  it('renders all section body contents in Greek', () => {
    // Arrange
    const greekSnippets = [
      'Το preSift δίνει δύο εικόνες για το ίδιο άτομο',
      'Λογική & Συλλογισμός — 11 σύντομα έργα',
      'Συναισθηματική Νοημοσύνη — 16 δηλώσεις αυτοαναφοράς',
      'Αντίληψη Συναισθήματος — σύντομα βίντεο',
      'Δημιουργείτε έναν σύνδεσμο αξιολόγησης για συγκεκριμένη θέση',
      'Ο άνθρωπος αποφασίζει. Το preSift δεν είναι ποτέ το μοναδικό κριτήριο',
      'Ως εργοδότης/πελάτης, εσείς είστε ο υπεύθυνος επεξεργασίας',
      'Credits: 1 credit ανά σύνδεσμο αξιολόγησης',
      'Ο υποψήφιος βλέπει το σκορ του; Όχι — μόνο εσείς.',
    ];

    // Act
    renderGuidePage('gr');

    // Assert
    greekSnippets.forEach((snippet) => {
      expect(screen.getByText(new RegExp(snippet, 'i'))).toBeInTheDocument();
    });
    expect(greekSnippets.length).toBe(9);
  });

  it('handles boundary value: empty or missing language gracefully defaults safely', () => {
    // Arrange
    localStorage.setItem('presift_language', '');

    // Act
    render(
      <TooltipProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={['/recruiter/guide']}>
            <RecruiterGuidePage />
          </MemoryRouter>
        </I18nProvider>
      </TooltipProvider>
    );

    // Assert
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
