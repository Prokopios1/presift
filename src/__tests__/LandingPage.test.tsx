import { I18nProvider } from '@/contexts/I18nContext';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { TooltipProvider } from '../components/ui/tooltip';


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ 
    user: localStorage.getItem('presift_uid') ? { uid: localStorage.getItem('presift_uid') } : null 
  }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the hero section without navigation but with footer', () => {
    // Arrange
    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <LandingPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    // Act & Assert
    // Core hero elements
    expect(screen.queryByText(/B2B Psychometric Screening Engine/i)).toBeNull();
    expect(screen.getByText(/often wrong about themselves/i)).toBeTruthy();
    
    // Nav items are removed
    expect(screen.queryByRole('button', { name: /Register/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /Pricing/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /🌙 Dark|☀️ Light/i })).toBeNull();

    // Get Started CTA is present and links to /register for unauthenticated users
    const getStartedLink = screen.getByRole('link', { name: /Get Started/i });
    expect(getStartedLink.getAttribute('href')).toBe('/register');
    
    // Benchmark Your Team CTA is present
    const benchmarkLink = screen.getByRole('link', { name: /Benchmark Your Team/i });
    expect(benchmarkLink.getAttribute('href')).toBe('/register?intent=benchmark');
    expect(screen.getByText(/Skeptical\? Test preSift on your top performers first/i)).toBeTruthy();
    
    expect(screen.queryByRole('button', { name: /View Demo Dashboard/i })).toBeNull();
    
    // Footer
    expect(screen.getByText(/All rights reserved/i)).toBeTruthy();
    // Ensure removed elements are not present
    expect(screen.queryByText(/Pay-As-You-Go Credits/i)).toBeNull();
    expect(screen.queryByText(/Start Free Trial/i)).toBeNull();
    expect(screen.queryByText(/ICAR-16 Cognitive/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/Berlin, Germany/i)).toBeNull();
  });

  it('links Get Started to /dashboard for registered users', () => {
    // Arrange
    localStorage.setItem('presift_uid', 'recruiter-123');

    // Act
    render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <LandingPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    // Assert
    const getStartedLink = screen.getByRole('link', { name: /Get Started/i });
    expect(getStartedLink.getAttribute('href')).toBe('/dashboard');
    const benchmarkLink = screen.getByRole('link', { name: /Benchmark Your Team/i });
    expect(benchmarkLink.getAttribute('href')).toBe('/dashboard?mode=benchmark');
  });

  it('renders as standalone page with no nav and no theme toggle', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <I18nProvider><MemoryRouter>
          <LandingPage />
        </MemoryRouter></I18nProvider>
      </TooltipProvider>
    );

    // Act
    const nav = container.querySelector('main nav');
    const themeBtn = screen.queryByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(nav).toBeNull();
    expect(themeBtn).toBeNull();
  });
});
