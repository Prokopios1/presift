import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';
import { TooltipProvider } from '../components/ui/tooltip';

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the hero section with navigation and footer', () => {
    // Arrange
    render(
      <TooltipProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act & Assert
    // Core hero elements
    expect(screen.queryByText(/B2B Psychometric Screening Engine/i)).toBeNull();
    expect(screen.getByText(/Stop interviewing candidates/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Register/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Pricing/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Get Started/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /View Demo Dashboard/i })).toBeNull();
    // Footer
    expect(screen.getByText(/All rights reserved/i)).toBeTruthy();
    // Ensure removed elements are not present
    expect(screen.queryByText(/Pay-As-You-Go Credits/i)).toBeNull();
    expect(screen.queryByText(/Start Free Trial/i)).toBeNull();
    expect(screen.queryByText(/ICAR-16 Cognitive/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/Berlin, Germany/i)).toBeNull();
  });

  it('renders theme toggle inside nav alongside pricing CTA in normal flow with no fixed overlay', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const nav = container.querySelector('main nav');
    const pricingCta = screen.getByRole('link', { name: /Pricing/i });
    const themeBtn = screen.getByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(nav).not.toBeNull();
    expect(nav?.contains(pricingCta)).toBe(true);
    expect(nav?.contains(themeBtn)).toBe(true);
  });
});
