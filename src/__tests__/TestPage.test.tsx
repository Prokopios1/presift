import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { TestPage } from '../pages/TestPage';
import { TooltipProvider } from '../components/ui/tooltip';

const renderTest = () =>
  render(
    <TooltipProvider>
      <MemoryRouter initialEntries={['/test/assess_1']}>
        <Routes>
          <Route path="/test/:assessmentId" element={<TestPage />} />
        </Routes>
      </MemoryRouter>
    </TooltipProvider>
  );


vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('@/contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));


describe('TestPage pre-test gate', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('blocks start until GDPR consent is checked', async () => {
    renderTest();
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    fireEvent.click(btn);
    expect(screen.getByText(/Psychometric Assessment/)).toBeTruthy();
  });

  it('starts the test after consent and runs the 45s timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTest();
    
    const checkbox = await screen.findByRole('checkbox');
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    
    fireEvent.click(checkbox);
    fireEvent.click(btn);
    
    expect(screen.getByText(/Question 1 of 32/)).toBeTruthy();
    expect(screen.getByText('00:45')).toBeTruthy();
    
    act(() => { vi.advanceTimersByTime(45000); });
    
    expect(screen.getByText(/Question 2 of 32/)).toBeTruthy();
    vi.useRealTimers();
  });

  it('extends the timer to 67s in accessibility mode', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTest();
    
    const checkbox = await screen.findByRole('checkbox');
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    const switchBtn = await screen.findByRole('switch');
    
    fireEvent.click(checkbox);
    fireEvent.click(switchBtn);
    fireEvent.click(btn);
    
    expect(screen.getByText('00:67')).toBeTruthy();
    vi.useRealTimers();
  });

  it('renders Smile Stage A instructions after completing ICAR and WLEIS', async () => {
    vi.mocked(httpsCallable).mockReturnValueOnce((() => Promise.resolve({
      data: {
        sessionId: 'sess_smile_123',
        items: [], // Skip to end of ICAR
        wleisItems: [], // Skip to end of WLEIS
        smileTask: {
          videoId: 'smile.mp4',
          videoUrl: 'http://example.com/smile.mp4',
          totalTrials: 1,
          trials: [{ trialId: 's1', start: 0, end: 1, groundTruth: 'genuine' }]
        }
      }
    })) as any);

    renderTest();
    
    const checkbox = await screen.findByRole('checkbox');
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    
    fireEvent.click(checkbox);
    fireEvent.click(btn);
    
    expect(await screen.findByText(/Stage 3: Smile Perception Assessment/i)).toBeTruthy();
    expect(screen.getAllByText(/Genuine/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Fake/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Start Smile Assessment/i })).toBeTruthy();
  });
});