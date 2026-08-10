import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the hero section with navigation and footer', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    // Core hero elements
    expect(screen.getByText(/B2B Psychometric Screening Engine/i)).toBeTruthy();
    expect(screen.getByText(/Stop interviewing candidates/i)).toBeTruthy();
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
});
