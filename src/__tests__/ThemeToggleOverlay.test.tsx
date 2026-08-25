import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { LandingPage } from '../pages/LandingPage';
import { PaymentPage } from '../pages/PaymentPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminPage } from '../pages/AdminPage';
import { AdminClientPage } from '../pages/AdminClientPage';
import { DemoPage } from '../pages/DemoPage';
import { Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '../components/ui/tooltip';

// Mock Firebase for dashboard/admin rendering
vi.mock('@/lib/firebase', () => ({
  db: {},
  functions: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({
    exists: () => true,
    data: () => ({ companyName: 'Acme Global', email: 'test@acme.com', credits: 10, archived: false }),
  })),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  getCountFromServer: vi.fn(() => Promise.resolve({ data: () => ({ count: 0 }) })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'mock-timestamp'),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => vi.fn(() => Promise.resolve({ data: {} }))),
}));


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() })),
  ImpersonationProvider: ({ children }: { children: React.ReactNode }) => children
}));


describe('ThemeToggle Overlay & Navigation Placement', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    vi.clearAllMocks();
  });

  it('proves App root does not render any fixed top-4 right-4 z-50 viewport overlay', () => {
    // Arrange & Act
    const { container } = render(<App />);

    // Assert
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');
    expect(fixedOverlay).toBeNull();
    const fixedTopRightElements = container.querySelectorAll('.fixed.top-4.right-4');
    expect(fixedTopRightElements.length).toBe(0);
  });

  it('renders ThemeToggle in LandingPage nav alongside the Pricing CTA without collision', () => {
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
    const themeButtons = screen.getAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(nav).not.toBeNull();
    expect(nav?.contains(pricingCta)).toBe(true);
    expect(nav?.contains(themeButtons[0])).toBe(true);
  });

  it('renders ThemeToggle in PaymentPage nav in normal flow', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <PaymentPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const nav = container.querySelector('main nav');
    const homeLink = screen.getByRole('link', { name: /Back to Home/i });
    const themeButtons = screen.getAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(nav).not.toBeNull();
    expect(nav?.contains(homeLink)).toBe(true);
    expect(nav?.contains(themeButtons[0])).toBe(true);
  });

  it('renders ThemeToggle in DashboardPage header in normal flow', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const nav = container.querySelector('main nav');
    const themeButtons = screen.getAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(nav).not.toBeNull();
    expect(nav?.contains(themeButtons[0])).toBe(true);
  });

  it('renders ThemeToggle in AdminPage header in normal flow', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const nav = container.querySelector('main nav');
    const themeButtons = screen.getAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(nav).not.toBeNull();
    expect(nav?.contains(themeButtons[0])).toBe(true);
  });

  it('renders ThemeToggle in AdminClientPage header in normal flow', async () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter initialEntries={['/admin/clients/client123']}>
          <Routes>
            <Route path="/admin/clients/:clientId" element={<AdminClientPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const themeButtons = await screen.findAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const nav = container.querySelector('main nav');
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(nav).not.toBeNull();
    expect(nav?.contains(themeButtons[0])).toBe(true);
  });

  it('renders ThemeToggle in DemoPage in normal flow', () => {
    // Arrange
    const { container } = render(
      <TooltipProvider>
        <MemoryRouter>
          <DemoPage />
        </MemoryRouter>
      </TooltipProvider>
    );

    // Act
    const themeButtons = screen.getAllByRole('button', { name: /🌙 Dark|☀️ Light/i });
    const fixedOverlay = container.querySelector('.fixed.top-4.right-4.z-50');

    // Assert
    expect(fixedOverlay).toBeNull();
    expect(themeButtons.length).toBe(1);
    expect(container.contains(themeButtons[0])).toBe(true);
  });

  it('toggles light and dark themes correctly when clicked', () => {
    // Arrange
    render(
      <TooltipProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </TooltipProvider>
    );
    const themeBtn = screen.getByRole('button', { name: /🌙 Dark/i });

    // Act - Click to toggle to dark mode
    fireEvent.click(themeBtn);

    // Assert - switched to dark
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: /☀️ Light/i })).toBeTruthy();

    // Act - Click to toggle back to light mode
    fireEvent.click(screen.getByRole('button', { name: /☀️ Light/i }));

    // Assert - switched back to light
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(screen.getByRole('button', { name: /🌙 Dark/i })).toBeTruthy();
  });
});
