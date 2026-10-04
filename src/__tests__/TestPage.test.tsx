import { I18nProvider } from '@/contexts/I18nContext';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { TestPage } from '../pages/TestPage';
import { TooltipProvider } from '../components/ui/tooltip';

const renderTest = () =>
  render(
    <TooltipProvider>
      <I18nProvider><MemoryRouter initialEntries={['/test/assess_1']}>
        <Routes>
          <Route path="/test/:assessmentId" element={<TestPage />} />
        </Routes>
      </MemoryRouter></I18nProvider>
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

  it('does not display Total Items or Total Trials on the landing screen', async () => {
    renderTest();
    expect(await screen.findByText(/Psychometric Assessment/)).toBeTruthy();
    expect(screen.queryByText(/Total Items/i)).toBeNull();
    expect(screen.queryByText(/Total Trials/i)).toBeNull();
  });

  it('starts the test after consent, presents ICAR instructions, then starts 45s timer on Go', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderTest();
    
    const checkbox = await screen.findByRole('checkbox');
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    
    fireEvent.click(checkbox);
    fireEvent.click(btn);
    
    // ICAR instructions screen
    expect(screen.getByText(/Stage 1: Cognitive Reasoning \(ICAR\)/i)).toBeTruthy();
    expect(screen.getByText(/11 short reasoning questions — numbers, words, shapes/i)).toBeTruthy();
    
    const goBtn = screen.getByRole('button', { name: /Go/i });
    const ack = await screen.findByRole('checkbox', { name: /I have read/i });
    fireEvent.click(ack);
    fireEvent.click(goBtn);

    expect(screen.getByText(/Question 1 of 32/)).toBeTruthy();
    expect(screen.getByText('00:45')).toBeTruthy();
    
    act(() => { vi.advanceTimersByTime(45000); });
    
    expect(screen.getByText(/Question 2 of 32/)).toBeTruthy();
    vi.useRealTimers();
  });



  it('renders Smile Stage 3 instructions with Go button after completing ICAR and WLEIS', async () => {
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
    
    expect(await screen.findByText(/Stage 3: Emotion Perception \(EPA\)/i)).toBeTruthy();
    expect(screen.getByText(/In this short task you'll see a series of facial expressions/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Go/i })).toBeTruthy();
  });

  it('renders WLEIS 1-5 buttons on WLEIS questions', async () => {
    vi.mocked(httpsCallable).mockReturnValueOnce((() => Promise.resolve({
      data: {
        sessionId: 'sess_wleis_123',
        items: [], // Skip ICAR
        wleisItems: [{ itemId: 'w1', domain: 'wleis', prompt: 'I have a good sense of why I have certain feelings most of the time.', options: [] }],
      }
    })) as any);

    renderTest();

    const checkbox = await screen.findByRole('checkbox');
    const btn = await screen.findByRole('button', { name: /Begin Assessment/i });
    fireEvent.click(checkbox);
    fireEvent.click(btn);

    // WLEIS instructions
    expect(await screen.findByText(/Stage 2: Emotional Intelligence \(WLEIS\)/i)).toBeTruthy();
    expect(screen.getByText(/16 statements — choose how much you agree on a 1–5 scale/i)).toBeTruthy();

    const goBtn = screen.getByRole('button', { name: /Go/i });
    const ack = await screen.findByRole('checkbox', { name: /I have read/i });
    fireEvent.click(ack);
    fireEvent.click(goBtn);

    // 1-5 buttons
    expect(await screen.findByRole('button', { name: /1 Strongly disagree/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /2 Disagree/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /3 Neutral/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /4 Agree/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /5 Strongly agree/i })).toBeTruthy();
  });

  it('renders Genuine and Fake buttons on SMILE trials', async () => {
    vi.mocked(httpsCallable).mockReturnValueOnce((() => Promise.resolve({
      data: {
        sessionId: 'sess_smile_trials',
        items: [],
        wleisItems: [],
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

    const goBtn = await screen.findByRole('button', { name: /Go/i });
    const ack = await screen.findByRole('checkbox', { name: /I have read/i });
    fireEvent.click(ack);
    fireEvent.click(goBtn);

    expect(await screen.findByRole('button', { name: /Spontaneous/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Posed/i })).toBeTruthy();
  });
});