import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TestPage } from '../pages/TestPage';

const renderTest = () =>
  render(
    <MemoryRouter initialEntries={['/test/assess_1']}>
      <Routes>
        <Route path="/test/:assessmentId" element={<TestPage />} />
      </Routes>
    </MemoryRouter>
  );

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
});